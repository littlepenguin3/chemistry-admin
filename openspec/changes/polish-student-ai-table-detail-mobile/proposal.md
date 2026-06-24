## Why

The current student AI table detail view technically opens rich Markdown tables, but it still feels like a desktop grid forced into a phone: cramped cells, heavy borders, unclear horizontal movement, and a large empty panel after short tables. This is especially painful for chemistry answers where tables mix long Chinese explanations, observations, and formulas that need both comparison and careful reading.

We should treat AI table details as a mobile learning viewer, inspired by Apple Numbers for table exploration and iOS lists for row-level reading, rather than continuing to hand-style a basic HTML table.

## What Changes

- Replace the current bare table detail presentation with a polished mobile table reader.
- Reuse the existing route-backed AI artifact detail flow from `add-student-ai-rich-content-viewer`; do not change backend assistant streaming or storage contracts.
- Introduce an Apple/Numbers-like table canvas mode:
  - pinch/drag/fit/reset style inspection using the already installed `react-zoom-pan-pinch`;
  - sticky or visually persistent header/first-column context where it improves comprehension;
  - subtle grid lines, compact row/column labels, and clear edge affordances for horizontal exploration.
- Introduce an iOS-style row reading mode:
  - tapping a table row opens a focused key-value reading surface;
  - the first column acts as the row title when available;
  - remaining cells render as labeled fields with Markdown, KaTeX, mhchem, and Chinese text wrapping intact.
- Add `@tanstack/react-table` as a lightweight headless table engine for row/column modeling, optional column visibility, and future-safe table state without adopting a heavy enterprise data grid UI.
- Avoid AG Grid, Handsontable, Tabulator, and DataTables for this change because the product need is read-only AI answer inspection, not editing, sorting-heavy analytics, or a general spreadsheet.
- Preserve copy/history boundaries:
  - copied answers remain original Markdown;
  - backend `conversation_history` remains `{ role, content }`;
  - viewer zoom, selected row, hidden columns, or UI labels are not persisted into assistant content.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `student-h5-ai-assistant`: AI-generated table artifact details become a mobile-first table reader with canvas exploration and row reading mode.
- `student-h5-mobile-design-system`: Student H5 gains reusable mobile table-viewer rules for touch gestures, edge affordances, density, safe areas, and no page-level horizontal overflow.

## Impact

- `apps/web-student`:
  - AI artifact detail page table branch.
  - shared Markdown table artifact parsing/modeling helpers.
  - assistant/mobile CSS for rich-content detail pages.
  - focused renderer, route, and mobile QA tests.
- Dependencies:
  - add `@tanstack/react-table`;
  - reuse existing `react-zoom-pan-pinch`.
- No backend API changes.
- No database changes.
- No change to AI prompt contract, stream format, local Markdown history content, or answer copy behavior.
