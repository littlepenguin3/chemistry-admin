## Why

The Atom student assistant can now render modern chemistry Markdown with GFM tables, KaTeX/mhchem formulas, and Mermaid flowcharts. The inline chat rendering is already useful, but large tables and flowcharts are cramped on phone widths: hidden horizontal scrolling preserves layout, yet it does not provide a comfortable way for students to inspect relationships, compare rows, or zoom a diagram.

This change adds a dedicated mobile rich-content detail viewer for AI-generated tables and Mermaid diagrams. The chat remains the primary answer surface, while complex rendered artifacts can be opened as a second-level learning view with drag, pan, zoom, fit/reset, and table-reading affordances.

## What Changes

- Add a student AI rich-content viewer for completed assistant answers containing GFM tables or Mermaid diagrams.
- Keep inline chat previews lightweight and readable; add a small "view details" affordance only when the content benefits from a larger surface.
- Open rich content through a route-backed second-level view rather than a desktop modal, so mobile back navigation, detail-route chrome, and bottom-nav hiding remain consistent with the student H5 app.
- Use `react-zoom-pan-pinch` for Mermaid SVG inspection: pinch zoom, drag pan, wheel/trackpad zoom where available, and explicit fit/reset controls.
- Render table details through an Atom-themed full-screen table reader with sticky header, optional sticky first column, horizontal and vertical scrolling, readable cell wrapping, and no persistent desktop scrollbar chrome.
- Preserve the existing Markdown stack: Streamdown for the active streaming turn, `react-markdown` static rendering after completion, GFM, math, mhchem, and Mermaid.
- Store only plain Markdown chat history and lightweight local message/artifact identifiers; do not persist rendered HTML, SVG, pan/zoom state, or plugin internals.
- Keep Streamdown's active-turn controls acceptable during streaming, but use the custom Atom viewer for completed static answers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `student-h5-ai-assistant`: Completed AI answers that contain rich Markdown artifacts must expose mobile-friendly detail viewing without changing the backend answer stream or local conversation-history contract.
- `student-h5-mobile-design-system`: Student H5 detail routes must support touch-first rich-content inspection surfaces with safe-area, keyboard, route-stack, and mobile QA constraints.

## Impact

- Frontend code likely affected:
  - `apps/web-student/src/app/router/router.tsx`
  - `apps/web-student/src/app/router/routeTypes.ts`
  - `apps/web-student/src/routes/ai/*`
  - `apps/web-student/src/features/assistant/StudentAiChatPanel.tsx`
  - `apps/web-student/src/features/assistant/assistantHistoryStore.ts`
  - `apps/web-student/src/shared/markdown/AiMessageMarkdown.tsx`
  - `apps/web-student/src/shared/markdown/AiMermaidBlock.tsx`
  - `apps/web-student/src/components/AiMarkdown.tsx`
  - new shared rich-content helpers under `apps/web-student/src/shared/markdown/`
  - `apps/web-student/src/styles/assistant.css`
- New npm dependency expected:
  - `react-zoom-pan-pinch`
- Existing dependencies retained:
  - `streamdown`
  - `@streamdown/math`
  - `@streamdown/mermaid`
  - `@streamdown/cjk`
  - `react-markdown`
  - `remark-gfm`
  - `remark-math`
  - `rehype-katex`
  - `katex`
  - `mermaid`
- Backend API impact:
  - None expected.
- Local storage impact:
  - Existing `student-ai-chat-history:v1` entries remain readable.
  - New optional local-only message identifiers may be added to future history entries, but `conversation_history` sent to the backend must remain `{ role, content }`.
