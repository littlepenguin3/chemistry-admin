## 1. Route And Data Model Foundations

- [x] 1.1 Add a route-backed AI rich-content detail page for student H5, scoped to AI-generated artifacts.
- [x] 1.2 Define the route parameters/search shape for history id, message id, artifact id/kind, and source-route restoration.
- [x] 1.3 Add local-only message ids for new student AI chat messages without changing backend `conversation_history`.
- [x] 1.4 Normalize legacy local history entries that lack message ids so restored messages can still open artifacts.
- [x] 1.5 Ensure contextual `/ai/chat` conversations saved in local history can open rich-content artifacts and return to the expected route.

## 2. Markdown Artifact Extraction

- [x] 2.1 Add a shared helper to identify completed-answer GFM table artifacts from normalized Markdown.
- [x] 2.2 Add a shared helper to identify completed-answer Mermaid artifacts from fenced `mermaid` code blocks.
- [x] 2.3 Generate deterministic artifact ids from message id, artifact kind, and ordinal.
- [x] 2.4 Keep artifact extraction renderer-agnostic so local history stores only plain Markdown and not rendered HTML/SVG.
- [x] 2.5 Add student-safe fallback behavior when an artifact id cannot be resolved.

## 3. Inline Completed-Answer Affordances

- [x] 3.1 Update static Markdown table rendering to show a compact detail-open control on completed assistant answers.
- [x] 3.2 Update `AiMermaidBlock` to show a compact detail-open control after Mermaid renders or beside its preview.
- [x] 3.3 Ensure detail controls do not appear inside copied answer text, Markdown source, backend conversation history, or visible thinking.
- [x] 3.4 Ensure active streaming answers do not expose custom route-backed artifact controls until final completion.
- [x] 3.5 Keep inline previews scrollable and readable when the student does not open the detail viewer.

## 4. Table Detail Viewer

- [x] 4.1 Build an Atom-themed read-only table detail viewer using semantic table markup.
- [x] 4.2 Support sticky header behavior for vertical inspection.
- [x] 4.3 Support optional sticky first-column behavior when it does not overlap or obscure formulas.
- [x] 4.4 Preserve horizontal and vertical scrolling while hiding persistent desktop scrollbar chrome in phone previews.
- [x] 4.5 Ensure long Chinese text, formulas, and chemistry notation wrap or scroll in a readable way.
- [x] 4.6 Add optional reset or font-size controls only if they improve mobile reading without clutter.

## 5. Mermaid Detail Viewer

- [x] 5.1 Install and wire `react-zoom-pan-pinch` in `apps/web-student`.
- [x] 5.2 Render Mermaid source to SVG in the detail page using the existing Atom Mermaid theme.
- [x] 5.3 Wrap the SVG in a pan/zoom viewer with pinch, drag, wheel/trackpad support, and fit/reset controls.
- [x] 5.4 Provide zoom in, zoom out, reset/fit, and back controls with accessible names and phone-sized hit targets.
- [x] 5.5 Respect `prefers-reduced-motion` by disabling animated transform transitions while preserving pan/zoom.
- [x] 5.6 Fall back gracefully when Mermaid rendering fails, without exposing raw stack traces or parser internals.

## 6. Mobile Styling And Route Integration

- [x] 6.1 Add assistant CSS for inline artifact affordances that matches Atom's green visual language.
- [x] 6.2 Add detail-route CSS for table and Mermaid viewers, safe areas, headers, control rows, and hidden scrollbars.
- [x] 6.3 Ensure the rich-content detail route is treated as a student detail route and hides bottom navigation.
- [x] 6.4 Ensure root `/ai` background, header veil, composer, action rows, and follow-up chips are not visually disturbed.
- [x] 6.5 Ensure contextual `/ai/chat` keeps its distinct detail route chrome.

## 7. Tests

- [x] 7.1 Add renderer tests for completed Markdown with multiple tables and Mermaid blocks producing stable artifact controls.
- [x] 7.2 Add tests that streaming answers do not open incomplete custom artifact routes.
- [x] 7.3 Add tests that local message ids are generated/restored and not sent in backend conversation history.
- [x] 7.4 Add route tests for opening a table artifact, rendering detail content, and returning back.
- [x] 7.5 Add route tests for opening a Mermaid artifact and showing pan/zoom controls.
- [x] 7.6 Extend role-boundary tests to ensure rich-content viewer controls do not expose diagnostics or copy into answer text.
- [x] 7.7 Add CSS/source tests for scrollability with hidden scrollbar chrome.

## 8. Verification And Deployment

- [x] 8.1 Run focused Markdown/rich-content renderer tests.
- [x] 8.2 Run `npm run test:e2e` in `apps/web-student`.
- [x] 8.3 Run `npm run build` in `apps/web-student`.
- [x] 8.4 Manually verify `/ai` at 360x780, 390x844, and 430x932 with a chemistry answer containing a wide table and tall Mermaid flowchart.
- [x] 8.5 Verify back navigation, bottom-nav hiding, no page-level horizontal overflow, and touch reachability.
- [x] 8.6 Deploy preview by copying `apps/web-student/dist/.` into `chemistry-admin-web-student-1:/usr/share/nginx/html` when the user asks to update the container.
