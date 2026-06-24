## 1. Dependency And Renderer Foundations

- [x] 1.1 Add `streamdown`, `@streamdown/math`, `@streamdown/mermaid`, `@streamdown/cjk`, and `rehype-katex` to `apps/web-student/package.json` and `package-lock.json`.
- [x] 1.2 Verify the installed dependency graph supports React 19 and does not introduce install-time warnings that block `npm run build`.
- [x] 1.3 Extract shared Markdown normalization into a helper under `apps/web-student/src/shared/markdown/` so both static and streaming renderers normalize `\(...\)` and `\[...\]` consistently.
- [x] 1.4 Refactor the existing static Markdown renderer into an explicit `AiStaticMarkdown` path while preserving current `AiMarkdownBlock` call sites.
- [x] 1.5 Add `rehype-katex` to the static renderer and preserve `katex/dist/katex.min.css` plus `katex/contrib/mhchem` support.
- [x] 1.6 Keep or adapt the existing custom KaTeX fallback so failed formulas degrade to readable sanitized text instead of breaking answer rendering.

## 2. Streamdown Streaming Renderer

- [x] 2.1 Create `AiStreamingMarkdown` or equivalent, scoped to active assistant answer content.
- [x] 2.2 Configure Streamdown with math support using single-dollar inline math for chemistry-learning answers.
- [x] 2.3 Configure Streamdown with the CJK plugin so Chinese Markdown edge cases and strikethrough behavior remain friendly.
- [x] 2.4 Configure Streamdown with Mermaid support for flowchart/graph learning diagrams.
- [x] 2.5 Configure Streamdown animation to be subtle and readable, and disable or reduce motion under `prefers-reduced-motion: reduce`.
- [x] 2.6 Configure Streamdown controls and translations so visible table/Mermaid controls have student-readable accessible names and do not look like unrelated developer-tool chrome.
- [x] 2.7 Verify whether Streamdown math renders `\ce{...}` after importing `katex/contrib/mhchem`; if not, add a targeted fallback or completion-time static handoff that prevents raw chemistry command leakage.
- [x] 2.8 Import only required Streamdown CSS and avoid introducing Tailwind/shadcn runtime assumptions into the student app.

## 3. Smooth Answer Streaming State

- [x] 3.1 Implement `useSmoothAssistantStream` or equivalent helper that keeps raw answer text, displayed answer text, timers, and cleanup isolated from the chat component.
- [x] 3.2 Use `Intl.Segmenter("zh", { granularity: "word" })` when available for Chinese answer segmentation.
- [x] 3.3 Add fallback segmentation using Chinese/English punctuation, whitespace, newlines, Markdown block boundaries, and maximum buffer thresholds.
- [x] 3.4 Integrate smoothing with `delta` events so raw text accumulates exactly while visible text releases in readable segments.
- [x] 3.5 Integrate `replace` events so replacement text resets raw and displayed answer state correctly.
- [x] 3.6 Integrate `final` events so all pending text flushes before the assistant turn becomes completed and local history is persisted.
- [x] 3.7 Integrate `error` handling so timers stop and pending buffers cannot append to a failed turn.
- [x] 3.8 Clear smoothing state on unmount, new chat, context reset, history restore, and any request cancellation path.

## 4. Assistant Panel Integration

- [x] 4.1 Replace active assistant message rendering in `StudentAiChatPanel.tsx` with a mode-aware Markdown facade that passes `streaming=true` only for the latest loading assistant turn with answer text.
- [x] 4.2 Ensure completed assistant turns, restored history turns, and assessment AI text render through static Markdown.
- [x] 4.3 Preserve the existing `thinking` event handling so visible thinking updates never enter the answer Markdown buffer.
- [x] 4.4 Preserve root first-answer glow behavior: welcome/draft static, first answer waiting animated, first answer completion fade-out, later chat no glow.
- [x] 4.5 Preserve root flat completed reply styling and action row behavior after switching completed answers to the static renderer.
- [x] 4.6 Preserve contextual `/ai/chat` assistant message boundaries and avoid leaking root-only flat reply styling into detail routes.
- [x] 4.7 Preserve local history save/restore data shape and ensure follow-up `conversation_history` uses final plain Markdown answer text.
- [x] 4.8 Ensure copy-answer action copies only original answer text and not rendered HTML, controls, hidden metadata, visible thinking, or quick prompt chips.

## 5. Atom Markdown Styling

- [x] 5.1 Add `.ai-markdown` table styles for borders, cell padding, headers, compact typography, and mobile horizontal overflow containment.
- [x] 5.2 Add GFM task-list styles that align checkboxes with student-readable labels and do not imply persistent editing.
- [x] 5.3 Add formula overflow styles for inline and display KaTeX so long equations remain readable on phone widths.
- [x] 5.4 Add Mermaid diagram container styles for horizontal scrolling, max-width containment, optional max-height, and fullscreen/control placement.
- [x] 5.5 Add Streamdown/Mermaid/table control styles that match the Atom green visual language and provide visible focus states.
- [x] 5.6 Add safe fallback styles for unsupported fenced blocks that keep code/preformatted content secondary to chemistry-learning prose.
- [x] 5.7 Verify `.ai-markdown` styles do not create cards inside root flat assistant replies or nested-card effects in contextual routes.
- [x] 5.8 Add reduced-motion CSS rules for Streamdown animation, diagram controls, and any local answer reveal effects.

## 6. Regression Tests

- [x] 6.1 Add renderer tests or focused e2e coverage for static Markdown with GFM table, task list, inline math, block math, and `\ce{...}`.
- [x] 6.2 Add streaming coverage where Markdown syntax is split across multiple mocked `delta` events and final completion renders the full static answer.
- [x] 6.3 Add coverage for `replace` events resetting displayed answer text and final persistence.
- [x] 6.4 Add coverage that `thinking` events update the running line but never appear in answer Markdown or copied answer text.
- [x] 6.5 Add coverage that local history stores and restores plain Markdown content without renderer-specific state.
- [x] 6.6 Add Mermaid coverage for a chemistry-identification or experiment-step flowchart, including graceful fallback if the test environment cannot render SVG fully.
- [x] 6.7 Extend role-boundary tests to reject raw RAG/source/tool/guardrail diagnostic rendering through the new Markdown path.
- [x] 6.8 Add mobile QA checks at 360px, 390px, and 430px widths for table, formula, Mermaid, composer, bottom navigation, and horizontal overflow behavior.

## 7. Verification And Deployment

- [x] 7.1 Run `npm run test:e2e` in `apps/web-student` and fix any AI assistant regressions.
- [x] 7.2 Run any focused renderer/unit tests added for Markdown and smooth streaming.
- [x] 7.3 Run `npm run build` in `apps/web-student`.
- [x] 7.4 Preview or inspect `/ai` locally with a representative chemistry answer containing Chinese prose, a GFM table, a task list, math, `mhchem`, and Mermaid.
- [x] 7.5 Verify no destructive horizontal overflow or text/control overlap in mobile viewports.
- [x] 7.6 Deploy for container preview by copying `apps/web-student/dist/.` into `chemistry-admin-web-student-1:/usr/share/nginx/html` instead of rebuilding the container image.
- [x] 7.7 Verify the deployed `/ai` route responds and shows the modern streaming behavior with the same representative chemistry answer fixture.
