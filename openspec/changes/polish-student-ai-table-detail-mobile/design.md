## Context

The student Atom assistant already renders modern AI answers with Streamdown during streaming and static Markdown after completion. The previous rich-content viewer change added route-backed artifact detail pages for completed assistant tables and Mermaid diagrams at the student H5 layer. Mermaid detail already uses `react-zoom-pan-pinch` for a phone-friendly pan/zoom surface.

The current table detail implementation is still close to a desktop grid placed inside a mobile page: it renders a semantic `<table>` in a scroll container with sticky header/first column and hidden scrollbars. That preserves data, but the mobile experience is weak for chemistry learning content. Text-heavy cells clip or feel cramped, horizontal movement is not obvious, the detail page can show large empty table space, and students cannot focus on one experiment row without fighting the grid.

Research direction:

- Apple uses two relevant mobile patterns. iOS table/list views convert dense information into a single-column reading flow, while Numbers on iPhone keeps spreadsheet-like data as a canvas that supports scrolling, pinch zoom, and frozen context.
- Mobile table usability guidance emphasizes keeping header context, making overflow discoverable, and giving users a focused way to inspect subsets of dense data.
- Existing table libraries split into two groups: heavy spreadsheet/data-grid systems such as AG Grid, Handsontable, Tabulator, and DataTables, and lightweight headless systems such as TanStack Table.
- For this app, the table is read-only AI Markdown content, not an editable spreadsheet or enterprise data grid. A headless table model plus a custom student-facing renderer is a better fit than importing a heavy grid UI.

Current implementation constraints:

- The table source must continue to come from the completed assistant message's plain Markdown artifact.
- Rendered HTML, route ids, zoom state, row focus state, or parser metadata must not be sent back through `conversation_history`.
- Chemistry cell content can contain Markdown, GFM, KaTeX math, and mhchem chemical formula syntax, so cell rendering must reuse the existing static AI Markdown renderer.
- This is a student mobile detail viewer, not an admin table or teacher spreadsheet.

## Goals / Non-Goals

**Goals:**

- Make AI-generated table detail feel like a native mobile learning surface rather than a desktop grid squeezed into a phone.
- Support an Apple/Numbers-like table canvas for wide tables: drag, pinch zoom, explicit zoom controls, fit/reset, and persistent table context.
- Add an iOS-style row reading mode so students can tap one experiment row and read it as labeled fields.
- Keep the current route-backed artifact flow, Markdown extraction, copy behavior, and backend request contract.
- Add only a lightweight table dependency: `@tanstack/react-table`; reuse the existing `react-zoom-pan-pinch` dependency already used by Mermaid detail.
- Cover 360px, 390px, and 430px mobile widths with no page-level horizontal overflow.

**Non-Goals:**

- No spreadsheet editing, formulas, column resizing, cell selection, data export, sorting, filtering, or saved user table preferences.
- No backend schema, prompt, stream protocol, database, or guardrail change.
- No replacement of the Mermaid detail viewer.
- No persistence of rendered table HTML, SVG, row focus state, or pan/zoom state.
- No adoption of a heavy table UI suite such as AG Grid, Handsontable, Tabulator, or DataTables for this read-only viewer.

## Decisions

### 1. Keep the Existing Artifact Route and Replace Only the Table Detail Branch

The implementation will keep the current AI artifact detail route and dispatch model. Mermaid artifacts continue to use the existing Mermaid detail viewer. Table artifacts will move from the current bare scroll-table rendering into a dedicated mobile table reader component.

Alternative considered: create a new route just for enhanced tables. That would make navigation and history more complex without solving the visual problem, since the artifact identity and source already exist.

### 2. Use TanStack Table as the Headless Table Model

The table parser already produces headers and rows from Markdown artifacts. `@tanstack/react-table` will sit between parsed data and UI as the row/column model. It gives the implementation stable header groups, row ids, cell accessors, and a future path for column visibility without imposing visual styles.

Alternative considered: keep manually mapping arrays to `<table>`. That is enough for the current basic grid, but it makes row detail mode, future column visibility, and consistent cell identity more fragile.

Alternative considered: use AG Grid, Handsontable, Tabulator, or DataTables. Those libraries provide more spreadsheet/data-grid behavior than this read-only learning viewer needs, and they bring heavier UI opinions that would fight the Atom mobile design language.

### 3. Reuse React Zoom Pan Pinch for the Table Canvas

The enhanced table detail will use `react-zoom-pan-pinch` for the canvas mode, matching the successful Mermaid detail interaction model. Students can drag the wide table, pinch to zoom, and use explicit controls for zoom in, zoom out, fit, and reset.

The canvas should open at a useful fit scale for the current viewport. It must not rely only on gestures; buttons are required for accessibility and desktop preview testing.

Alternative considered: use only native overflow scrolling. Native scroll is simpler, but it does not solve inspection of wide chemistry tables with dense text, and it already produced the cramped result the user reported.

### 4. Add Row Reading Mode for Text-Heavy Tables

The detail viewer will provide a row reading mode. Tapping a row opens a focused sheet or panel where the first column becomes the row title and each remaining column becomes a labeled field. Each value is rendered through the static AI Markdown renderer so formulas, mhchem, bold text, and lists remain readable.

This mode is the mobile-native complement to the table canvas. The canvas is for comparing shape and columns; row reading is for understanding one experiment step.

Alternative considered: show all rows as cards by default. Cards are readable, but they lose the comparison affordance that makes tables useful. The recommended design keeps both modes.

### 5. Make Overflow Discoverable Without Permanent Scrollbar Chrome

The viewer should hide persistent scrollbar chrome in the polished mobile UI, but must preserve actual scrolling and pan gestures. Edge fades, subtle shadows, column peek, and control states will communicate that more content exists.

Alternative considered: leave scrollbars visible. That makes the current implementation more obvious but visually heavy, and it still does not address row-level reading.

### 6. Keep AI Answer and History Boundaries Untouched

All enhanced table state is local UI state. Copying an assistant answer must still copy the original plain Markdown answer. Follow-up requests must still send only recent `{ role, content }` messages as `conversation_history`. The detail viewer must never leak table controls, route ids, row ids, pan/zoom transforms, rendered HTML, or parser diagnostics as assistant content.

## Risks / Trade-offs

- [Risk] CSS sticky headers can behave unpredictably inside transformed pan/zoom content. -> Mitigation: prefer canvas-level context plus row reading mode; if sticky behavior breaks under transform, render header/first-column context as separate non-transformed affordances or limit sticky behavior to non-zoomed table markup.
- [Risk] KaTeX/mhchem output inside zoomed content may become too small or clipped. -> Mitigation: use explicit fit/reset controls, keep row reading mode untransformed, and verify formula rendering in both modes.
- [Risk] Adding a table model dependency increases frontend surface area. -> Mitigation: use only `@tanstack/react-table` core React APIs in the table detail component and keep rendering custom.
- [Risk] A tiny two-column table may feel over-designed. -> Mitigation: adapt the layout so compact tables still look like a clean reader, while wide tables expose canvas and row reading controls more prominently.
- [Risk] Hidden scrollbars can reduce discoverability. -> Mitigation: include edge fades, visible controls, and optional helper affordances that do not become instructional clutter.
- [Risk] The new detail mode could accidentally affect chat inline table rendering. -> Mitigation: scope the change to route-backed table detail; inline `.ai-markdown` table styling remains separate except for shared cell rendering utilities.

## Migration Plan

1. Add `@tanstack/react-table` to `apps/web-student`.
2. Extract or extend the current Markdown table artifact data into a stable table model for headers, rows, and cells.
3. Replace the table branch in `AiArtifactDetailPage` with the enhanced mobile table reader.
4. Reuse `react-zoom-pan-pinch` for canvas mode and add fit/reset/zoom controls.
5. Add row reading mode with static AI Markdown cell rendering.
6. Update assistant CSS for the detail viewer only: compact surface, safe areas, overflow indicators, hidden scrollbar behavior, and non-stretched content.
7. Add focused tests for table model behavior, row reading, route-backed detail opening, copy/history isolation, and mobile overflow rules.
8. Run the student build and mobile viewport QA. When requested, copy the built assets into the running student container instead of rebuilding the container image.

Rollback strategy: keep the existing table artifact route and fallback empty state. If the enhanced component causes a blocker, the table branch can temporarily return to the current semantic scroll table while leaving Mermaid and Markdown rendering unchanged.

## Open Questions

- The recommended default is table canvas first with an obvious row reading affordance. If user testing shows students mostly read rows rather than compare columns, row reading can become the default view for text-heavy tables.
- The recommended row reader presentation is an in-page mobile sheet/panel rather than a separate nested route. A nested route can be added later if deep linking to one table row becomes necessary.
- The viewer should not persist the last zoom level or selected row initially. Persistence can be reconsidered if students repeatedly reopen the same large artifact.
