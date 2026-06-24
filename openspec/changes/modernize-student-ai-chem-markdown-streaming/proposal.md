## Why

The Atom student assistant currently streams raw SSE deltas directly into the visible Markdown renderer, which makes answers feel like an old typewriter and causes expensive, fragile re-rendering while Markdown syntax is still incomplete. The chemistry-learning demo now needs a modern AI answer surface that can stream smoothly while still rendering chemistry formulas, math, tables, and mobile-friendly learning diagrams after completion.

## What Changes

- Add a streaming Markdown rendering path for the active assistant turn using Streamdown, scoped to student-facing AI answer content.
- Keep the existing `react-markdown` path for completed/static content, history restores, assessment summaries, and other non-streaming Markdown surfaces.
- Add Chinese-friendly smooth streaming so UI updates are released by readable CJK segments, short phrases, punctuation, and block boundaries rather than every network chunk.
- Preserve the existing student assistant SSE contract (`status`, `thinking`, `delta`, `replace`, `final`, `error`) and local history data shape; this change is frontend rendering/state behavior, not a backend stream migration.
- Extend chemistry answer rendering to cover GFM tables/task lists, KaTeX math, mhchem chemistry notation, and Mermaid learning diagrams.
- Add mobile-first `.ai-markdown` presentation rules for tables, task lists, formula overflow, Mermaid diagrams, Streamdown controls, and reduced-motion behavior.
- Ensure Mermaid is treated as a chemistry-learning visualization tool for experiment steps, identification logic, and reasoning paths, not as a generic programming feature.
- Avoid adding programmer-focused code highlighting as a primary experience; ordinary fenced code blocks may still render safely as fallback Markdown.
- Verify the implementation with representative chemistry answers that combine Chinese prose, GFM tables, `$...$` math, `\ce{...}` chemistry notation, and Mermaid flowcharts.

## Capabilities

### New Capabilities

- `student-ai-chem-markdown-streaming`: Defines the student-facing modern AI answer renderer, including Streamdown live rendering, static Markdown fallback, chemistry/math/GFM/Mermaid support, mobile styling, and Chinese smooth streaming.

### Modified Capabilities

- `student-h5-ai-assistant`: The student AI chat surface must distinguish active streaming answers from completed answers without changing chat history, contextual routing, first-turn glow behavior, visible thinking, or root/detail layout contracts.
- `assistant-chem-latex-rendering`: Chemistry/math rendering must remain robust in both streaming and completed answer states, including `mhchem` support and safe fallback behavior.
- `student-ai-visible-thinking-stream`: Visible thinking remains separate from answer Markdown and must not be mixed into Streamdown or static Markdown answer content.

## Impact

- Affected frontend code:
  - `apps/web-student/src/features/assistant/StudentAiChatPanel.tsx`
  - `apps/web-student/src/shared/markdown/AiMarkdownBlock.tsx`
  - `apps/web-student/src/components/AiMarkdown.tsx`
  - new shared streaming/Markdown helpers under `apps/web-student/src/shared/markdown/`
  - `apps/web-student/src/styles/assistant.css`
  - `apps/web-student/src/styles/assessment.css` if shared Markdown styles remain there
- Affected tests:
  - `apps/web-student/src/App.e2e.test.tsx`
  - `apps/web-student/src/roleBoundaries.test.ts`
  - any focused Markdown renderer tests added for chemistry/GFM/Mermaid behavior
- New npm dependencies expected:
  - `streamdown`
  - `@streamdown/math`
  - `@streamdown/mermaid`
  - `@streamdown/cjk`
  - `rehype-katex`
- Existing dependencies retained:
  - `react-markdown`
  - `remark-gfm`
  - `remark-math`
  - `katex`
- Deployment remains the existing student web flow: build locally, then copy the built `dist` output into the running student web container when requested.
