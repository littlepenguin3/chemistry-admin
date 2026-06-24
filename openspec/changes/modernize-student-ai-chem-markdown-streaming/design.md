## Context

The student Atom assistant is a chemistry-learning chat surface, not a general programmer assistant. The current frontend path streams `/api/student/assistant/ask/stream` events into `StudentAiChatPanel.tsx`, accumulates `answer += event.delta`, and immediately updates the last assistant message in React state on every `delta`. The visible content then passes through `AiMarkdownBlock`, which lazy-loads `AiMarkdown`; `AiMarkdown` currently uses `react-markdown`, `remark-gfm`, `remark-math`, and a custom KaTeX render path with `katex/contrib/mhchem`.

That existing setup already proves the app wants chemistry-aware Markdown, but it is not ideal for live AI output:

- Small SSE chunks are reflected directly in the UI, which reads as old typewriter behavior rather than modern AI streaming.
- Markdown may be incomplete while streaming, so headings, tables, formulas, and fenced blocks can flicker or temporarily render incorrectly.
- The same static Markdown renderer is used for both active streaming text and completed/restored content.
- GFM tables and task lists are supported by the parser dependency but do not yet have mobile-first Atom assistant presentation rules.
- Mermaid diagrams are not yet part of the student answer renderer, even though chemistry teaching can use them for experiment steps, substance identification, and reasoning paths.

The change should preserve the current backend stream contract and local-history storage shape. It should focus on rendering, display state, and mobile presentation.

Relevant current integration points:

- `apps/web-student/src/features/assistant/StudentAiChatPanel.tsx`
  - Handles `streamStudentAssistantAsk`.
  - Tracks `messages`, `loading`, `status`, `activeThinking`, local history, root/detail layout state, and first-turn background behavior.
  - Currently applies each `delta` directly to message content.
- `apps/web-student/src/shared/markdown/AiMarkdownBlock.tsx`
  - Public Markdown rendering facade used by assistant and assessment surfaces.
- `apps/web-student/src/components/AiMarkdown.tsx`
  - Static Markdown renderer with KaTeX/mhchem support.
- `apps/web-student/src/styles/assistant.css` and `apps/web-student/src/styles/assessment.css`
  - Current `.ai-markdown` typography and assistant presentation.

## Goals / Non-Goals

**Goals:**

- Make active AI replies feel like modern streaming AI output instead of direct network-chunk typewriter text.
- Use Streamdown for the active assistant turn so incomplete Markdown is parsed and displayed more gracefully during streaming.
- Keep `react-markdown + remark-gfm + remark-math + rehype-katex + katex` for completed/static Markdown surfaces.
- Preserve `mhchem` rendering for chemistry formulas and reactions such as `$\\ce{2H2 + O2 -> 2H2O}$`.
- Support GFM tables, task lists, strikethrough, links, headings, lists, inline code, and fenced blocks.
- Support Mermaid flowcharts for chemistry-learning diagrams on mobile, with overflow-safe and accessible presentation.
- Add Chinese-friendly smooth streaming that releases display text by readable segments instead of every SSE delta.
- Preserve current student assistant SSE event names and payload meanings.
- Preserve current local history structure by storing final answer text, not renderer-specific state.
- Keep visible thinking/status separate from answer Markdown.
- Ensure root and contextual assistant routes continue to honor their existing visual/layout boundaries.
- Provide regression tests and mobile QA scenarios that cover chemistry-specific Markdown examples.

**Non-Goals:**

- Do not migrate the backend assistant API, SSE event contract, or local history schema.
- Do not introduce a backend chat-session model.
- Do not make code highlighting, code copy buttons, or programming-oriented code blocks a primary feature.
- Do not use Mermaid for arbitrary huge diagrams, class diagrams, or complex desktop-only visualizations.
- Do not render raw chain-of-thought, raw RAG traces, policy details, or tool diagnostics in answer Markdown.
- Do not require Tailwind or shadcn styling in the student app.
- Do not replace existing visible-thinking behavior with Streamdown animation.
- Do not animate completed answers after they have settled into static history.

## Decisions

### Decision 1: Use a dual-renderer Markdown facade

Create or evolve a shared Markdown facade, tentatively `AiMessageMarkdown`, that chooses the renderer based on a `streaming` flag:

- `streaming=true`: render with `AiStreamingMarkdown`, built on Streamdown.
- `streaming=false`: render with `AiStaticMarkdown`, built on the existing `react-markdown` path.

Rationale:

- Streaming and completed content have different correctness and performance needs.
- Streamdown is designed to handle incomplete Markdown blocks during live AI output.
- The existing static renderer is already integrated with the app's chemistry style and report surfaces.
- Keeping both avoids forcing Streamdown into every historical/report Markdown surface before it is needed.

Alternatives considered:

- Replace all Markdown rendering with Streamdown.
  - Rejected because assessment summaries/history/static surfaces do not need streaming behavior and already have established rendering expectations.
- Keep only `react-markdown` and add throttling.
  - Rejected because throttling improves pacing but does not solve incomplete Markdown block behavior as cleanly.

### Decision 2: Separate raw answer accumulation from displayed answer text

Introduce a small frontend smoothing layer for assistant answer text:

- `rawAnswerRef`: the exact accumulated answer from `delta`/`replace`/`final`.
- `displayAnswer`: the text currently released to the UI.
- A scheduler drains raw text into display text at a controlled cadence.
- On `replace`, reset both raw and displayed text to the replacement source of truth.
- On `final`, flush all remaining raw text before marking the assistant turn completed.
- On `error`, stop the scheduler and show the student-safe error path.

Rationale:

- The network chunk shape should not dictate visual rhythm.
- Chinese output should release by words, short phrases, punctuation, and Markdown block boundaries.
- The final persisted answer must remain exact and complete.

Suggested smoothing policy:

- Prefer `Intl.Segmenter("zh", { granularity: "word" })` when available.
- Treat Chinese and English punctuation (`，。！？；：,.!?;:`), newlines, list boundaries, table row breaks, and fenced-block boundaries as natural flush points.
- Use a short interval such as 35-70ms for small phrase releases.
- Release larger chunks immediately when the buffer crosses a safety threshold to avoid falling behind long answers.
- Disable or heavily reduce animation for `prefers-reduced-motion: reduce`.

Alternatives considered:

- Use AI SDK `smoothStream` directly.
  - Rejected for the first implementation because the backend stream is already custom and the frontend can smooth display without changing API contracts.
- Add a typing animation independent of actual stream text.
  - Rejected because it would be cosmetic and risks feeling fake; the app should show real answer progress.

### Decision 3: Keep local history renderer-agnostic

History entries continue to store `StudentAiChatMessage[]` with `role`, `content`, optional `metadata`, and optional `state`. No Streamdown state, animation state, parse state, or diagram-render cache is persisted.

Rationale:

- History should remain durable plain answer content.
- Restored conversations should render as completed/static Markdown, not replay old streaming.
- Follow-up requests should keep sending the same `conversation_history` shape.

Alternatives considered:

- Store both raw and displayed answer.
  - Rejected because displayed answer is transient UI state and would create mismatch risk.

### Decision 4: Normalize Markdown once and share semantics where practical

The static and streaming paths should share normalization rules for model output:

- Normalize `\(...\)` to `$...$`.
- Normalize `\[...\]` to `$$...$$`.
- Keep `\ce{...}` inside math delimiters.
- Avoid rewriting fenced code blocks.

The static path should move toward the standard plugin chain:

- `react-markdown`
- `remark-gfm`
- `remark-math`
- `rehype-katex`
- KaTeX CSS and `katex/contrib/mhchem`

The streaming path should configure Streamdown with:

- `@streamdown/math`, with single-dollar inline math enabled.
- `@streamdown/cjk`.
- `@streamdown/mermaid`.
- Controls configured for mobile-friendly table and Mermaid interactions.
- Tailored translations/icons if default controls do not match the Chinese student interface.

Rationale:

- The app already has chemistry formula requirements.
- `rehype-katex` makes the static renderer more conventional while retaining current fallback behavior where needed.
- Streamdown plugins align with live AI rendering needs without making chemistry-specific parsing a one-off.

Risk note:

- The Streamdown math plugin must be tested with `mhchem`. If `\ce{...}` does not render correctly in the streaming path after importing `katex/contrib/mhchem`, keep a custom fallback renderer for math nodes or flush chemistry-heavy formulas to the static renderer once complete.

### Decision 5: Treat Mermaid as a chemistry-learning diagram feature

Mermaid support should focus on `flowchart`/`graph` diagrams that explain:

- experiment steps,
- substance identification branches,
- reaction/reasoning paths,
- safety or observation decision trees.

Mobile behavior:

- Render diagrams in an overflow-safe container.
- Allow horizontal scrolling for wider diagrams.
- Limit initial diagram height on small screens.
- Provide fullscreen viewing when Streamdown controls support it.
- Ensure diagram controls use touch targets and accessible names.
- Prevent Mermaid content from pushing the composer or bottom navigation off-screen.

Rationale:

- Phones can render Mermaid because output is SVG, but the container needs mobile rules.
- Chemistry diagrams are pedagogical; they should not dominate the chat surface.

Alternatives considered:

- Exclude Mermaid to keep scope smaller.
  - Rejected because the user explicitly sees value in mobile-rendered process diagrams for the chemistry demo.
- Add a standalone diagram editor.
  - Rejected as outside chat-answer rendering scope.

### Decision 6: Integrate styles through `.ai-markdown`, not Tailwind assumptions

Streamdown ships minimal animation CSS and many examples assume Tailwind/shadcn. The student app should define its own Atom-themed presentation under `.ai-markdown` and scoped assistant selectors.

Style targets:

- tables and table wrappers,
- task list checkboxes,
- KaTeX display overflow,
- inline formulas,
- Mermaid containers and controls,
- links and external-link treatment,
- blockquotes if the model uses them,
- code block fallback,
- reduced-motion behavior,
- root vs detail assistant spacing.

Rationale:

- The app has an existing visual language.
- Mobile overflow is a correctness requirement, not polish.
- Styling must be predictable in the deployed static build and teacher preview iframe.

### Decision 7: Keep answer Markdown distinct from visible thinking

The visible thinking line remains rendered by the existing assistant state UI, not by the Markdown renderer. `thinking` events update `activeThinking`; `delta`/`replace`/`final` update answer content. Streamdown never receives thinking/status copy as answer content.

Rationale:

- Existing specs forbid mixing thinking text into answer content.
- It preserves the first-turn glow/loading behavior and running-line semantics.

### Decision 8: Verify with chemistry-first fixtures

Regression fixtures should include at least one answer combining:

- Chinese explanation prose,
- GFM table,
- task list,
- inline math,
- block math,
- mhchem formula/reaction,
- Mermaid flowchart,
- a normal fenced block fallback,
- streamed chunks that split Markdown syntax across event boundaries.

Rationale:

- The risk is not a single renderer import; the risk is all supported content interacting under streaming and mobile constraints.

## Risks / Trade-offs

- [Risk] Streamdown and Mermaid increase bundle size.
  Mitigation: lazy-load the streaming renderer and Mermaid path through the existing Markdown facade; keep static history/report paths on `react-markdown`.

- [Risk] Streamdown plugin styling may assume Tailwind/shadcn classes.
  Mitigation: import only required Streamdown styles and define explicit `.ai-markdown` CSS for the student app.

- [Risk] `mhchem` may not work identically in the Streamdown math plugin path.
  Mitigation: add targeted tests for `\ce{...}` during streaming and completion; keep or adapt the existing custom KaTeX fallback.

- [Risk] Smooth streaming can lag behind very long model output.
  Mitigation: cap pending buffer size, flush larger semantic blocks immediately, and always flush on final.

- [Risk] Replacing direct `setMessages` on every delta may introduce stale state bugs.
  Mitigation: keep raw answer in refs, isolate scheduler cleanup, and test `delta`, `replace`, `final`, and `error` sequences.

- [Risk] Mermaid diagrams can overflow or become unreadable on phone widths.
  Mitigation: make diagrams horizontally scrollable, height-limited, fullscreen-capable, and tested at 360px/390px/430px widths.

- [Risk] Static and streaming renderers may diverge visually.
  Mitigation: route both through a shared `.ai-markdown` class and shared Markdown normalization.

- [Risk] Accessibility announcements can become noisy during streaming.
  Mitigation: keep the chat stream polite, avoid announcing decorative animation, and ensure final content remains readable without motion.

## Migration Plan

1. Install dependencies in `apps/web-student`: `streamdown`, `@streamdown/math`, `@streamdown/mermaid`, `@streamdown/cjk`, `rehype-katex`.
2. Extract shared Markdown normalization and renderer components under `apps/web-student/src/shared/markdown/`.
3. Update `AiMarkdownBlock` to support static rendering while preserving current call sites.
4. Add `AiMessageMarkdown` or equivalent for assistant messages, with a `streaming` mode used only for the active assistant turn.
5. Add `useSmoothAssistantStream` or equivalent scheduler and integrate it into `StudentAiChatPanel.tsx`.
6. Add mobile `.ai-markdown` styles for GFM tables/task lists, KaTeX overflow, Mermaid, controls, and reduced motion.
7. Add tests for streaming chunk smoothing, renderer switching, chemistry formulas, Mermaid, and local history preservation.
8. Build locally with `npm run build`.
9. When deploying for preview, copy `apps/web-student/dist/.` into `chemistry-admin-web-student-1:/usr/share/nginx/html`.

Rollback strategy:

- Keep the static `react-markdown` renderer intact.
- If Streamdown integration fails, disable `streaming` mode and fall back to static renderer with throttled `displayAnswer` while retaining the rest of the app.
- If Mermaid causes bundle/runtime issues, leave Mermaid code fences as safe fenced blocks while keeping math/GFM/stream smoothing.

## Open Questions

- Should fullscreen Mermaid viewing ship in the first implementation, or is horizontal scroll plus max-height enough for the first demo?
- Should table copy/download controls be enabled, hidden, or restyled for student chemistry tables?
- Should completed root assistant answers continue using `react-markdown` immediately after final, or should Streamdown remain mounted in `mode="static"` for the last turn until the next navigation?
- Should the backend prompt be updated later to explicitly encourage Mermaid for experiment/identification answers, or should the first implementation only render Mermaid when the model happens to output it?
