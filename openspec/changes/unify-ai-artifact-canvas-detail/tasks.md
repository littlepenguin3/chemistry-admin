## 1. Shared Canvas Detail Shell

- [x] 1.1 Inspect the current `AiArtifactDetailPage` table and Mermaid branches and identify duplicated page/header/control/container markup.
- [x] 1.2 Extract a shared AI artifact canvas page component that owns the second-level page layout, floating back/title chrome, floating tool area, and workspace grid.
- [x] 1.3 Preserve the existing artifact route params, local-history lookup, artifact resolution, unavailable-state fallback, and back-navigation behavior.
- [x] 1.4 Ensure the shared shell keeps controls outside the transformed artifact layer and scopes all new classes to AI artifact detail.

## 2. Infinite Grid Workspace Styling

- [x] 2.1 Replace the current framed artifact-detail background with a viewport-filling grid workspace scoped to the artifact detail page.
- [x] 2.2 Implement minor and optional major grid lines using lightweight CSS backgrounds or an equivalent non-heavy DOM technique.
- [x] 2.3 Add translucent header/tool veils that fade over the real grid instead of painting opaque strips or duplicated page backgrounds.
- [x] 2.4 Ensure the workspace has no page-level horizontal overflow at 360px, 390px, and 430px widths.
- [x] 2.5 Add reduced-motion handling for canvas transform transitions and fit/reset animations.

## 3. Mermaid Canvas Object

- [x] 3.1 Move the existing Mermaid detail renderer into the shared canvas shell without changing Mermaid source extraction.
- [x] 3.2 Remove the inner Mermaid rounded card, border, panel background, preview-box padding, and stretched container styling.
- [x] 3.3 Render the Mermaid SVG as a transparent canvas object centered on the grid with a useful initial fit scale.
- [x] 3.4 Keep explicit zoom out, zoom in, fit-to-view, and reset controls wired to `react-zoom-pan-pinch`.
- [x] 3.5 Preserve the existing student-safe Mermaid render fallback without exposing raw parser/runtime diagnostics.

## 4. Table Canvas Adaptation

- [x] 4.1 Move the enhanced table detail viewer into the shared canvas shell while preserving the TanStack table model.
- [x] 4.2 Restyle the table as a bounded canvas object rather than a large card or stretched blank page panel.
- [x] 4.3 Keep local table readability treatments: header tint, hairline grid, readable cell wrapping, and chemistry Markdown cell rendering.
- [x] 4.4 Preserve table pan/zoom controls, fit/reset behavior, and useful initial scale for wide tables.
- [x] 4.5 Preserve row reading mode as an untransformed exact-reading surface and reset selected-row state when the artifact changes or closes.

## 5. Assistant Boundary Protection

- [x] 5.1 Verify copied assistant answers still contain only the original plain Markdown answer.
- [x] 5.2 Verify follow-up requests after opening, panning, zooming, or row-reading an artifact still send only plain `{ role, content }` conversation history.
- [x] 5.3 Ensure canvas state, route ids, row ids, rendered SVG, rendered HTML, zoom values, and control labels are not persisted into assistant message content or local history message content.
- [x] 5.4 Ensure inline chat Markdown previews do not inherit full-page canvas grid or detail toolbar styles.

## 6. Tests And Mobile QA

- [x] 6.1 Update route/component tests for opening a Mermaid artifact into the shared canvas detail page.
- [x] 6.2 Update route/component tests for opening a table artifact into the shared canvas detail page and entering/exiting row reading mode.
- [x] 6.3 Add or update CSS/source regression coverage for absence of the Mermaid inner artifact card and absence of page-level horizontal overflow.
- [x] 6.4 Extend mobile viewport QA to cover one Mermaid flowchart artifact and one Markdown table artifact at 360px, 390px, and 430px widths.
- [x] 6.5 Verify bottom navigation remains hidden, floating controls are reachable, and the grid workspace is visible around the artifact in mobile QA screenshots.

## 7. Build And Demo Update

- [x] 7.1 Run the focused student frontend tests that cover AI Markdown, artifact detail routing, table model behavior, and role/boundary regressions.
- [x] 7.2 Run the student frontend typecheck and production build.
- [x] 7.3 Run the student mobile QA script for the updated artifact canvas detail experience.
- [x] 7.4 When updating the running demo, copy the local build output into the existing student container instead of rebuilding the container image.
- [x] 7.5 Manually verify a chemistry answer containing both a wide table and a tall Mermaid flowchart in the phone preview.
