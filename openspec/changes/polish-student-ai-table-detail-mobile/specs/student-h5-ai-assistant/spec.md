## ADDED Requirements

### Requirement: AI table detail uses a mobile table reader
The student H5 Atom assistant SHALL render completed AI-generated Markdown table artifacts in a dedicated mobile table reader instead of a bare desktop-style grid.

#### Scenario: Student opens a completed table artifact
- **WHEN** a student opens a table artifact from a completed assistant answer
- **THEN** the app MUST show the table in the existing route-backed artifact detail flow
- **AND** the detail view MUST provide a polished mobile table reader surface with table canvas and row reading affordances.

#### Scenario: Other rich artifacts remain unchanged
- **WHEN** a student opens a Mermaid artifact from a completed assistant answer
- **THEN** the app MUST continue to use the existing Mermaid detail viewer behavior
- **AND** the table reader changes MUST NOT alter Mermaid rendering, Mermaid pan/zoom controls, or Mermaid fallback behavior.

#### Scenario: Table artifact cannot be resolved
- **WHEN** the table artifact id no longer maps to a table in the local assistant message history
- **THEN** the app MUST show the existing student-safe unavailable state
- **AND** it MUST NOT expose route internals, parser diagnostics, stack traces, or hidden artifact metadata.

### Requirement: AI table canvas supports touch exploration
The student H5 Atom assistant SHALL provide a touch-friendly canvas mode for wide AI-generated tables so students can inspect table structure on mobile screens.

#### Scenario: Student explores a wide table
- **WHEN** the table detail view contains more columns or cell width than the mobile viewport can comfortably display
- **THEN** the viewer MUST allow the student to drag or scroll within the table area to inspect offscreen cells
- **AND** the page itself MUST NOT gain horizontal document overflow.

#### Scenario: Student zooms the table canvas
- **WHEN** the student pinches the table canvas or uses explicit zoom controls
- **THEN** the viewer MUST scale the table content within the detail surface
- **AND** it MUST provide explicit controls for zoom in, zoom out, fit, and reset.

#### Scenario: Student needs table context while exploring
- **WHEN** the student pans or zooms a table in canvas mode
- **THEN** the viewer MUST preserve enough header or first-column context for the student to understand which row and column they are inspecting
- **AND** it MUST provide row reading mode as a non-transformed fallback for exact text reading.

#### Scenario: Reduced motion is enabled
- **WHEN** the device or browser indicates reduced motion preferences
- **THEN** table canvas transitions MUST avoid nonessential animation
- **AND** zoom/reset state changes MUST remain functional.

### Requirement: AI table row reading preserves chemistry Markdown
The student H5 Atom assistant SHALL let students focus a single AI table row as labeled fields while preserving the existing chemistry Markdown rendering stack.

#### Scenario: Student opens a row reader
- **WHEN** the student taps or activates a row in the table detail view
- **THEN** the viewer MUST open a focused row reading surface
- **AND** the first column value MUST be presented as the row title when available
- **AND** each remaining cell MUST be presented with its column header as the field label.

#### Scenario: Row cells contain chemistry content
- **WHEN** a row cell contains Markdown, GFM emphasis, inline math, block math, or mhchem syntax
- **THEN** the row reader MUST render that cell through the existing static AI Markdown rendering path
- **AND** formulas such as `\\ce{Cl2 + 2Br- -> 2Cl- + Br2}` MUST be readable without leaking raw renderer implementation details.

#### Scenario: Student closes the row reader
- **WHEN** the student closes the focused row reading surface
- **THEN** the viewer MUST return to the same table detail artifact
- **AND** the selected row state MUST remain local UI state only.

### Requirement: AI table detail preserves assistant answer boundaries
The student H5 Atom assistant SHALL keep enhanced table viewer state separate from assistant messages, copying, and backend conversation history.

#### Scenario: Student copies an assistant answer with a table
- **WHEN** the student copies a completed assistant answer that contains a table artifact
- **THEN** the copied content MUST be the original plain assistant Markdown answer
- **AND** it MUST NOT include table reader labels, row reader labels, route ids, row ids, zoom state, rendered HTML, or control text.

#### Scenario: Student asks a follow-up after using table detail
- **WHEN** the student opens table detail, pans or zooms the table, opens a row reader, and then asks a follow-up
- **THEN** the backend request MUST continue to send `conversation_history` as plain `{ role, content }` turns only
- **AND** it MUST NOT include table viewer state, rendered table HTML, pan/zoom transforms, or artifact metadata.

#### Scenario: Table rendering fails
- **WHEN** the enhanced table reader cannot render a parsed table
- **THEN** the app MUST show a student-safe fallback that preserves access to the original table content when possible
- **AND** it MUST NOT present development diagnostics as normal answer text.
