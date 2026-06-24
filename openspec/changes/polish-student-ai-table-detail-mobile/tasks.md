## 1. Dependency And Table Model

- [x] 1.1 Add `@tanstack/react-table` to `apps/web-student` and update the package lock.
- [x] 1.2 Create or extend a table artifact model helper that converts parsed Markdown table headers and rows into stable column, row, and cell data for TanStack Table.
- [x] 1.3 Preserve the existing artifact identity flow so table detail still derives from completed local assistant message Markdown.
- [x] 1.4 Verify follow-up requests still send only plain `{ role, content }` turns through `conversation_history`.

## 2. Enhanced Table Detail Viewer

- [x] 2.1 Refactor the table branch in `AiArtifactDetailPage` into a dedicated enhanced table detail component.
- [x] 2.2 Implement a table canvas mode that reuses `react-zoom-pan-pinch` for drag, pinch zoom, fit, and reset behavior.
- [x] 2.3 Add explicit mobile controls for zoom in, zoom out, fit, and reset with accessible labels.
- [x] 2.4 Add table context affordances for headers or first-column meaning while the student pans or zooms.
- [x] 2.5 Ensure the table detail surface sizes to useful content and removes the current stretched blank grid behavior for small tables.

## 3. Row Reading Mode

- [x] 3.1 Add a row activation affordance so tapping or keyboard-activating a table row opens focused row reading mode.
- [x] 3.2 Render the focused row as an iOS-style labeled reading surface with the first column as the row title when available.
- [x] 3.3 Render every row-reader cell through the existing static AI Markdown path so GFM, KaTeX, and mhchem content remain readable.
- [x] 3.4 Keep selected row state local to the detail viewer and reset it when the artifact changes or the detail view closes.

## 4. Mobile Visual Polish

- [x] 4.1 Update `assistant.css` detail-view styles for a lightweight Apple/Numbers-like table canvas: subtle header fill, hairline grid, compact density, and restrained controls.
- [x] 4.2 Add overflow affordances such as edge fades, shadows, or peeking content while keeping permanent scrollbar chrome hidden.
- [x] 4.3 Ensure hidden scrollbar rules preserve actual horizontal and vertical scrolling or panning.
- [x] 4.4 Ensure the detail route respects top and bottom safe areas and the bottom navigation never covers table controls or row reading.
- [x] 4.5 Add reduced-motion handling for table canvas transitions and control-driven zoom/reset changes.

## 5. Tests And QA Coverage

- [x] 5.1 Add unit or focused component tests for table model conversion, stable row/cell identity, and empty-cell handling.
- [x] 5.2 Extend the existing AI rich-content route test to cover opening a table detail viewer, using canvas controls, opening row reading mode, and closing it.
- [x] 5.3 Add regression tests proving copy behavior and `conversation_history` payloads do not include table viewer labels, route ids, row ids, rendered HTML, or pan/zoom state.
- [x] 5.4 Add source/CSS regression coverage for hidden-scrollbar-but-scrollable behavior and removal of the stretched blank table panel.
- [x] 5.5 Extend mobile viewport QA with a wide chemistry table artifact at 360px, 390px, and 430px widths.

## 6. Verification And Delivery

- [x] 6.1 Run the focused student frontend tests that cover AI Markdown, AI artifact detail, and role/boundary regressions.
- [x] 6.2 Run the student frontend typecheck and production build.
- [x] 6.3 Manually verify a chemistry prompt containing a wide table, row text, formulas, and a Mermaid diagram in the student mobile preview.
- [x] 6.4 When the user wants to update the running demo, copy the local build output into the existing student container instead of rebuilding the container image.
