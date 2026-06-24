## ADDED Requirements

### Requirement: AI artifact details use one canvas detail page
The student H5 Atom assistant SHALL render completed AI-generated table and Mermaid artifacts through one route-backed second-level canvas detail page model.

#### Scenario: Student opens a completed rich artifact
- **WHEN** a student opens a completed assistant answer's table or Mermaid artifact detail
- **THEN** the app MUST use the existing route-backed artifact detail flow
- **AND** the detail page MUST use the shared AI artifact canvas shell for both table and Mermaid artifact kinds
- **AND** the page title or accessible heading MUST identify whether the student is viewing a table detail or flowchart detail.

#### Scenario: Artifact detail remains a second-level destination
- **WHEN** a student is viewing an AI artifact detail page
- **THEN** the page MUST behave as a second-level/detail route
- **AND** the bottom navigation MUST remain hidden according to the existing route-stack rules
- **AND** the back action MUST return to the assistant route or history context that opened the artifact when that context is still available.

#### Scenario: Inline previews remain normal answer content
- **WHEN** a completed assistant answer contains a table or Mermaid artifact
- **THEN** the inline chat answer MUST remain readable without requiring navigation
- **AND** the inline artifact affordance MUST open the shared canvas detail page
- **AND** inline chat preview styles MUST NOT inherit the full-page canvas grid or floating detail controls.

### Requirement: AI Mermaid detail renders as a canvas object
The student H5 Atom assistant SHALL render completed Mermaid flowchart artifacts directly on the artifact canvas workspace instead of inside an inner card or framed panel.

#### Scenario: Student opens a Mermaid flowchart detail
- **WHEN** a student opens a Mermaid artifact detail from a completed assistant answer
- **THEN** the flowchart MUST render as a transparent canvas object on the detail workspace grid
- **AND** the detail view MUST NOT wrap the flowchart in an inner rounded card, bordered panel, framed preview box, or duplicated page background surface.

#### Scenario: Student explores a Mermaid flowchart
- **WHEN** the Mermaid flowchart is larger than the visible phone viewport
- **THEN** the viewer MUST allow the student to pan the canvas and zoom the flowchart with touch gestures
- **AND** the viewer MUST provide explicit controls for zoom in, zoom out, fit-to-view, and reset
- **AND** those controls MUST remain outside the transformed Mermaid SVG layer.

#### Scenario: Mermaid detail cannot render
- **WHEN** the Mermaid artifact cannot be rendered from the completed assistant Markdown
- **THEN** the detail page MUST show a student-safe fallback
- **AND** it MUST NOT expose raw exceptions, parser internals, route internals, RAG traces, guardrail details, or backend diagnostics as normal student-facing text.

### Requirement: AI table detail adapts to the canvas page
The student H5 Atom assistant SHALL render completed Markdown table artifacts inside the same AI artifact canvas detail page while preserving table readability and row reading mode.

#### Scenario: Student opens a table artifact detail
- **WHEN** a student opens a completed assistant answer's table artifact detail
- **THEN** the table MUST render inside the shared AI artifact canvas shell
- **AND** the table content MUST be placed as an artifact object on the workspace rather than inside a stretched blank card or page-filling framed panel
- **AND** the table object MUST size to useful table content instead of creating large empty table-detail space.

#### Scenario: Table content remains readable on the canvas
- **WHEN** a table contains dense Chinese text, Markdown emphasis, GFM content, KaTeX math, or mhchem chemistry syntax
- **THEN** the table detail MUST preserve readable cells, table header context, and row/column relationships
- **AND** table cell rendering MUST continue to use the existing static AI Markdown rendering path where rich chemistry content is rendered.

#### Scenario: Student reads one table row
- **WHEN** the student activates a row in the table detail page
- **THEN** the viewer MUST provide the existing focused row reading mode
- **AND** the row reader MUST remain an exact-reading surface that is not distorted by the current canvas zoom transform
- **AND** closing the row reader MUST return to the same table artifact detail page.

### Requirement: AI artifact canvas preserves assistant boundaries
The student H5 Atom assistant SHALL keep canvas detail state separate from assistant messages, copied answer text, local history content, and backend conversation history.

#### Scenario: Student copies an answer after opening artifact detail
- **WHEN** the student opens table or Mermaid detail, pans or zooms the artifact, and then copies the assistant answer
- **THEN** the copied content MUST be the original plain assistant Markdown answer
- **AND** it MUST NOT include artifact route ids, canvas labels, zoom values, pan transforms, row-reader state, rendered SVG, rendered HTML, or detail control text.

#### Scenario: Student asks a follow-up after using artifact detail
- **WHEN** the student opens artifact detail, changes zoom or pan state, returns to chat, and asks a follow-up question
- **THEN** the backend request MUST continue to send `conversation_history` as plain `{ role, content }` turns only
- **AND** it MUST NOT include artifact metadata, rendered table DOM, rendered Mermaid SVG, canvas state, route state, row ids, or control labels.

#### Scenario: Local history restores a previous answer
- **WHEN** a student restores a local assistant history entry containing completed table or Mermaid artifacts
- **THEN** the inline completed answer MUST still be able to open the shared artifact canvas detail page
- **AND** any initial canvas transform or row-reader state MUST be recomputed locally rather than restored from assistant message content.
