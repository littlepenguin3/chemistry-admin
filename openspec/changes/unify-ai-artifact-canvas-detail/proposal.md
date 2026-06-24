## Why

The Atom assistant's rich artifact detail pages now render tables and Mermaid diagrams, but the detail experience still reads as content placed inside a framed card rather than as a native mobile canvas. The desired direction is a Figma-like second-level artifact viewer: the grid is the workspace, and AI-generated artifacts sit directly on that infinite workspace with touch pan/zoom controls.

## What Changes

- Replace the current framed artifact-detail presentation with a shared second-level AI artifact canvas shell.
- Render Mermaid flowcharts directly on an infinite-feeling grid workspace, without an inner card, rounded panel, or duplicated background surface.
- Adapt table detail to the same second-level canvas language while preserving table readability, row reading mode, chemistry Markdown rendering, and the existing TanStack table model.
- Make artifact controls float above the canvas as page chrome instead of living inside a content card.
- Preserve the completed-answer artifact flow: artifacts still derive from plain assistant Markdown in local history, and no rendered SVG/HTML, zoom state, row state, route ids, or control text is sent back through `conversation_history`.
- Keep inline chat previews unchanged except for opening into the unified detail canvas.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `student-h5-ai-assistant`: AI table and Mermaid artifact details should use one route-backed, Figma-like canvas detail experience while preserving artifact extraction, local history, copy behavior, and backend request boundaries.
- `student-h5-mobile-design-system`: Student mobile second-level artifact viewers should support an infinite-grid canvas pattern with floating controls, safe-area handling, touch pan/zoom, and no nested card background for canvas-native artifacts.

## Impact

- Affected frontend area: `apps/web-student` AI Markdown/artifact rendering, `AiArtifactDetailPage`, assistant CSS, and mobile viewport QA.
- Existing dependencies should be reused: `react-zoom-pan-pinch` for pan/zoom, `@tanstack/react-table` for table model, and the existing static AI Markdown renderer for table cell/row content.
- No backend API, stream protocol, prompt, guardrail, database, or local-history schema migration is required.
- Existing completed-answer copy behavior and follow-up `conversation_history` payloads must remain plain Markdown/text only.
