## Context

The student Atom assistant recently gained a modern Markdown renderer:

- `AiMessageMarkdown` chooses between active streaming and completed static rendering.
- `AiStreamingMarkdown` uses Streamdown for the latest active assistant turn.
- `AiMarkdownBlock` / `AiStaticMarkdown` use `react-markdown`, GFM, math, KaTeX, mhchem, and a custom Mermaid block for completed content.
- `StudentAiChatPanel` persists plain Markdown messages in local history and sends only `{ role, content }` conversation history to the backend.
- `.ai-markdown` styles now make tables, formulas, and Mermaid overflow-safe on phones.

The remaining problem is not parsing correctness. It is inspection ergonomics:

- A table can be wider than the chat canvas.
- A Mermaid flowchart can be taller or wider than a phone viewport.
- Hidden scrollbars avoid ugly chrome, but students may still need a larger, intentional inspection mode.
- The user explicitly wants a second-level page where the student can open a table or diagram and drag/zoom to inspect it.

External research used for this design:

- Streamdown Mermaid controls support fullscreen and pan/zoom, but they are plugin chrome and only partially aligned with this app's static completed-renderer path: <https://streamdown.ai/docs/plugins/mermaid>
- `react-zoom-pan-pinch` is a React library for zooming, panning, and pinching HTML/SVG content with mobile gestures and explicit controls: <https://github.com/BetterTyped/react-zoom-pan-pinch>
- `@panzoom/panzoom` is a lower-level DOM/SVG pan/zoom option if React integration becomes problematic: <https://timmywil.com/panzoom/>
- `svg-pan-zoom` is mature for SVG-only pan/zoom, but mobile pinch usually requires extra gesture handling: <https://github.com/bumbu/svg-pan-zoom/blob/master/README.md>
- TanStack Table is excellent for data grids, but it is overkill for read-only Markdown tables in the first implementation: <https://tanstack.com/table/latest>

## Goals / Non-Goals

**Goals:**

- Let students open AI-generated tables and Mermaid diagrams from completed answers into a route-backed second-level detail view.
- Preserve inline chat previews so answers still read naturally without requiring navigation.
- Make Mermaid diagrams draggable and zoomable on phones while keeping SVG sharp.
- Make tables easier to inspect with sticky headers, optional sticky first column, readable wrapping, and scroll without persistent desktop scrollbar chrome.
- Keep the feature local to student-facing assistant Markdown; do not add a general document viewer framework.
- Keep the backend stream, prompt contract, and answer storage format unchanged.
- Keep copied answers as original Markdown text, not rendered controls or viewer state.

**Non-Goals:**

- Do not build a full spreadsheet/data-grid product.
- Do not add sorting, filtering, formula editing, column resizing, export, or CSV download in this round.
- Do not persist rendered SVG, rendered HTML, pan/zoom transform, scroll position, or table viewport state to local history.
- Do not make streaming partial tables/diagrams navigate to the detail route before the answer has completed.
- Do not use a generic desktop modal that leaves the root bottom navigation visible underneath.
- Do not expose raw Mermaid errors, raw parser internals, model diagnostics, RAG traces, guardrail decisions, or backend metadata to students.

## User Experience

### Inline answer surface

Completed assistant answers continue to render normally in the chat:

```text
Assistant answer
  paragraph
  table preview        [view details]
  formula
  mermaid preview      [view details]
  action row
```

The inline preview remains touch-scrollable and readable. The detail affordance is small and local to the artifact. It should use product language such as "view details" / "expand" in Chinese UI copy, but it must not look like a developer tool or table-export control.

### Detail route

Opening a rich artifact pushes a second-level AI detail route. The exact route can be chosen during implementation, but the route should be explicit rather than an unnamed overlay. A recommended shape:

```text
/ai/artifact/$historyId/$messageId/$artifactId
```

The route reads the local AI history entry, finds the assistant message, extracts the target artifact from the plain Markdown answer, and renders one focused viewer:

```text
┌──────────────────────────────┐
│ Back     Table detail / Flow │
├──────────────────────────────┤
│                              │
│  drag / scroll / zoom area   │
│                              │
├──────────────────────────────┤
│  compact controls if needed  │
└──────────────────────────────┘
```

For contextual `/ai/chat` conversations, the same artifact detail route may be reused as long as local history can identify the entry source and the back action returns to the correct route context. If implementation discovers route restoration is too risky, an explicit route state fallback may be used for current-session navigation, but refresh/back behavior must still degrade gracefully.

## Decisions

### Decision 1: Use route-backed second-level viewing, not a pure modal

The user asked for a second-level page. The student app already treats non-root pages as detail routes through `AuthenticatedAppLayout` and `DetailPageFrame`, with bottom navigation hidden on detail routes. The rich-content viewer should follow that model.

Benefits:

- Browser/mobile back works naturally.
- Bottom navigation hides under existing route-role rules.
- Safe-area and header treatment can reuse detail-page conventions.
- The viewer does not feel like a desktop popup squeezed into a phone.

Trade-off:

- The route must be able to reconstruct the artifact. That requires stable local identifiers and extraction from Markdown/history.

### Decision 2: Store source Markdown and ids, not rendered artifacts

The source of truth remains the assistant message's plain Markdown content. The viewer should derive artifacts from that source at render time.

Recommended local-only additions:

```ts
type StudentAiChatMessage = {
  role: "user" | "assistant";
  content: string;
  id?: string;
  metadata?: StudentAssistantFinalMetadata;
  state?: "error";
};

type AiRichContentArtifact = {
  id: string;              // stable within message content
  messageId: string;
  kind: "table" | "mermaid";
  index: number;           // table-1, mermaid-1, etc.
  title: string;
  source: string;          // Markdown table source or Mermaid source
};
```

Rules:

- Generate ids for new messages when they are created.
- Normalize legacy history entries that lack message ids by deriving stable ids from entry id + message index during read.
- Do not include message ids in backend `conversation_history`.
- Do not persist viewer UI state in local history.

### Decision 3: Extract artifacts from Markdown using structured parsing where practical

For completed static answers, artifact extraction should happen from the normalized Markdown text.

Preferred path:

- Use the Markdown AST tooling already present through the `react-markdown` ecosystem, or a tiny shared helper if direct AST access is simpler.
- Identify GFM table nodes and fenced code nodes with `language-mermaid`.
- Generate deterministic artifact ids from message id + kind + ordinal.
- Pass artifact metadata to inline renderers so they can show the open-detail affordance.

Fallback path:

- If table AST extraction is too expensive for the first pass, inline table components can register their ordinal during render and navigate with `messageId + kind + index`.
- The route must still be able to reconstruct the same ordinal from the message content or show a student-safe fallback.

### Decision 4: Use `react-zoom-pan-pinch` for Mermaid detail viewing

Mermaid renders to SVG. The detail route should render the same SVG inside `TransformWrapper` / `TransformComponent` from `react-zoom-pan-pinch`.

Viewer behavior:

- Pinch zoom on touch devices.
- Drag to pan when zoomed.
- Wheel/trackpad zoom where available without breaking page scroll outside the viewer.
- Explicit buttons for zoom in, zoom out, fit/reset, and close/back.
- Initial fit-to-container so the whole diagram is visible when possible.
- Min/max scale guardrails, for example `0.4` to `4`.
- Reduced-motion mode disables animated transform transitions but keeps zoom/pan usable.

Why not use only Streamdown controls:

- Active streaming can keep Streamdown controls.
- Completed static answers currently use the custom Mermaid renderer.
- Product chrome and accessibility need to match Atom's student UI.

### Decision 5: Build a custom read-only table viewer, not TanStack Table

Markdown tables are read-only teaching artifacts, not datasets. A custom table detail viewer is enough for the first round.

Viewer behavior:

- Full-width detail surface.
- Table header sticky at top when vertical scrolling.
- First column MAY be sticky when it improves row comparison and does not cause overlap.
- Cells wrap readable Chinese and formulas instead of forcing one-line truncation.
- Horizontal and vertical scrolling remain available.
- Persistent desktop scrollbar chrome should be hidden in phone preview, but scrolling must remain functional.
- Optional compact controls may include font size and reset scroll position.
- No sorting/filtering/export in this change.

TanStack Table remains a later option only if future AI answers need real data-grid behavior such as sorting, filtering, column pinning, or column visibility.

### Decision 6: Keep streaming and completed behavior separate

While an answer is still streaming:

- Inline Streamdown rendering may show plugin-native controls if already configured.
- Custom route-backed artifact navigation SHOULD NOT be required until the final answer has completed.
- Partial tables or diagrams should not open the detail route with incomplete content.

After final:

- The completed answer switches to static rendering.
- Static tables and Mermaid blocks receive Atom-native detail affordances.
- The detail route reads complete Markdown from local history.

### Decision 7: Use mobile design-system overlay and scroll rules

The detail viewer is a mobile learning surface:

- Bottom nav hidden.
- Safe-area-aware header and controls.
- Phone-size hit targets.
- No page-level horizontal overflow.
- Scrollbars hidden only where intentional and without disabling touch/wheel/keyboard scrolling.
- Viewer gestures must not trap the entire page after the student backs out.

## Architecture Sketch

```text
StudentAiChatPanel
  ├─ creates/persists local history id
  ├─ creates local message ids
  └─ renders completed assistant content
       ↓
AiMessageMarkdown(streaming=false)
  └─ AiMarkdownBlock / AiStaticMarkdown
       ├─ table component
       │    ├─ inline preview
       │    └─ open artifact route
       └─ AiMermaidBlock
            ├─ inline SVG preview
            └─ open artifact route

AiArtifactDetailPage
  ├─ readStudentAiHistory(historyId)
  ├─ find assistant message by messageId
  ├─ extract artifact by kind/index/id
  ├─ TableDetailViewer OR MermaidDetailViewer
  └─ DetailPageFrame back action returns to source route
```

## Error And Fallback Behavior

- If the history entry is missing, show a student-safe empty state and a back action.
- If the message is missing, show a student-safe empty state and a back action.
- If the artifact ordinal no longer exists because the answer changed, show a student-safe empty state and a back action.
- If Mermaid cannot render, show the existing safe Mermaid fallback in the detail route, not raw exception text.
- If a browser lacks Pointer Events or pinch support, explicit zoom controls must still work.

## Accessibility

- Inline artifact affordances must be buttons with accessible names.
- The detail route title must identify whether the student is viewing a table or flowchart.
- Pan/zoom controls must have accessible names and visible focus states.
- The table viewer should preserve semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, and `<td>` where possible.
- Detail route controls should not rely on hover.
- Reduced motion should preserve functionality while removing animated zoom/fade transitions.

## Test Strategy

- Unit/render tests for Markdown answers containing multiple tables and multiple Mermaid blocks.
- Tests that inline artifact buttons appear only for completed static answers, not incomplete streaming content.
- Tests that local message ids are generated/restored without changing backend `conversation_history`.
- Route tests that opening a table artifact navigates to the detail route and renders the expected table.
- Route tests that opening a Mermaid artifact renders a detail viewer with zoom controls.
- Role-boundary tests that copied answers and visible content do not include hidden metadata, raw RAG traces, guardrail internals, or viewer implementation state.
- CSS/source tests for hidden scrollbar selectors preserving overflow.
- Mobile QA at 360x780, 390x844, and 430x932 for:
  - wide table detail,
  - tall Mermaid flowchart,
  - back navigation,
  - bottom nav hidden,
  - no horizontal page overflow,
  - controls reachable by touch.

## Rollback Strategy

- Keep inline chat rendering as the fallback.
- If the route viewer causes trouble, hide the detail affordance while keeping existing inline table/Mermaid rendering.
- If `react-zoom-pan-pinch` has compatibility issues, replace Mermaid detail pan/zoom with `@panzoom/panzoom` behind the same viewer component API.
- Do not remove the static Markdown renderer or local history format during this change.

## Open Questions

- Should the table viewer include a font-size toggle in the first implementation, or only rely on pinch/scroll-style inspection for Mermaid and native table scroll for tables?
- Should the artifact detail route be shareable/deep-linkable after a page refresh, or is current local-history restoration enough for the demo?
- Should inline table/Mermaid affordances always show, or only show when measured overflow exceeds the chat width/height?
