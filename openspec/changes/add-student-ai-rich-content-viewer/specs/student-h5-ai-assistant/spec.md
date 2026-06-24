## MODIFIED Requirements

### Requirement: Completed AI answers expose rich-content detail viewing
The student H5 Atom assistant SHALL let students open completed AI-generated table and Mermaid artifacts into a mobile detail viewer while preserving inline chat readability.

#### Scenario: Completed answer contains a GFM table
- **WHEN** a completed assistant answer contains a rendered GFM table
- **THEN** the inline chat answer MUST continue to render the table preview in place
- **AND** the table preview MUST expose a touch-friendly detail affordance
- **AND** activating the affordance MUST open a student AI rich-content detail view for that table.

#### Scenario: Completed answer contains a Mermaid diagram
- **WHEN** a completed assistant answer contains a rendered Mermaid flowchart or graph
- **THEN** the inline chat answer MUST continue to render the diagram preview in place
- **AND** the Mermaid preview MUST expose a touch-friendly detail affordance
- **AND** activating the affordance MUST open a student AI rich-content detail view for that diagram.

#### Scenario: Answer is still streaming
- **WHEN** the latest assistant answer is still streaming or has incomplete Markdown
- **THEN** the custom route-backed rich-content detail affordance SHOULD remain hidden or disabled
- **AND** partial tables or partial Mermaid blocks MUST NOT be opened as final rich-content artifacts
- **AND** any Streamdown-native active-turn controls MUST NOT corrupt the final completed-answer viewer state.

#### Scenario: Inline preview remains usable
- **WHEN** the student does not open the detail view
- **THEN** inline tables and Mermaid previews MUST remain readable and scrollable within the chat surface
- **AND** the detail affordance MUST NOT obscure table cells, diagram labels, formulas, the assistant action row, follow-up chips, or the composer.

### Requirement: AI rich-content artifacts are identified from local Markdown history
The student H5 Atom assistant SHALL identify table and Mermaid detail artifacts from plain Markdown chat history rather than persisted rendered HTML or SVG.

#### Scenario: New assistant messages are created
- **WHEN** the frontend creates user and assistant messages for a student AI conversation
- **THEN** it MAY attach local-only message identifiers for UI routing
- **AND** those identifiers MUST NOT be sent to the backend as part of `conversation_history`.

#### Scenario: Rich artifact route opens
- **WHEN** a rich-content detail route is opened with a history id, message id, and artifact id
- **THEN** the app MUST read the local AI history entry
- **AND** it MUST locate the assistant message by message id or a documented legacy fallback
- **AND** it MUST derive the target table or Mermaid artifact from the message's plain Markdown content.

#### Scenario: Legacy history lacks message identifiers
- **WHEN** a restored local AI history entry was created before message ids existed
- **THEN** the app MUST continue to render the conversation
- **AND** it SHOULD derive stable local fallback ids from the history entry and message position
- **AND** opening rich content SHOULD work when the target message and artifact can be unambiguously resolved.

#### Scenario: Artifact cannot be resolved
- **WHEN** the requested history entry, assistant message, or artifact cannot be found
- **THEN** the rich-content detail view MUST show a student-safe fallback state
- **AND** the student MUST have a clear back action
- **AND** the UI MUST NOT expose parser internals, local-storage keys, stack traces, raw route params, or implementation diagnostics.

### Requirement: Table detail viewer supports mobile reading
The student H5 Atom assistant SHALL render AI-generated table details as a read-only mobile table reader optimized for comparison and inspection.

#### Scenario: Student opens a table detail
- **WHEN** a student opens a table artifact detail view
- **THEN** the view MUST render the table content as a read-only learning artifact
- **AND** it MUST preserve semantic table structure where practical
- **AND** it MUST provide enough spacing and contrast for chemistry-learning prose, formulas, and observations.

#### Scenario: Table is wider than the phone viewport
- **WHEN** the table width exceeds the available detail-view width
- **THEN** horizontal scrolling MUST remain available
- **AND** persistent desktop scrollbar chrome SHOULD be hidden in phone preview contexts
- **AND** hiding scrollbar chrome MUST NOT disable touch, pointer, wheel, keyboard, or programmatic scrolling.

#### Scenario: Table has many rows
- **WHEN** the table extends vertically beyond the visible detail area
- **THEN** vertical scrolling MUST remain available
- **AND** table header cells SHOULD remain visible through sticky header behavior where it improves reading
- **AND** the detail header and controls MUST NOT cover table content.

#### Scenario: First column provides row labels
- **WHEN** the first column contains row labels, steps, reagents, or comparison categories
- **THEN** the table detail viewer MAY keep the first column sticky
- **AND** sticky first-column behavior MUST NOT overlap formulas, hide adjacent content, or create unreadable stacked cells.

### Requirement: Mermaid detail viewer supports pan and zoom
The student H5 Atom assistant SHALL render AI-generated Mermaid diagrams in a detail viewer that supports mobile pan, zoom, fit, and reset interactions.

#### Scenario: Student opens a Mermaid detail
- **WHEN** a student opens a Mermaid artifact detail view
- **THEN** the app MUST render the diagram as SVG using the Atom assistant Mermaid theme
- **AND** the diagram MUST remain sharp when zoomed
- **AND** the view MUST provide drag or pan inspection for diagrams larger than the visible area.

#### Scenario: Student uses touch gestures
- **WHEN** the student's browser supports touch gestures
- **THEN** the Mermaid detail viewer SHOULD support pinch-to-zoom and drag-to-pan inside the diagram area
- **AND** the gesture handling MUST remain scoped to the viewer area
- **AND** normal page back/navigation behavior MUST remain available.

#### Scenario: Student uses explicit controls
- **WHEN** the Mermaid detail viewer renders
- **THEN** it MUST provide explicit controls for zooming in, zooming out, and fitting or resetting the diagram
- **AND** each control MUST have a phone-appropriate hit target and accessible name
- **AND** the controls MUST remain readable over the light Atom viewer surface.

#### Scenario: Reduced motion is requested
- **WHEN** the device or browser requests reduced motion
- **THEN** pan/zoom functionality MUST remain available
- **AND** animated transform transitions SHOULD be reduced or disabled.

#### Scenario: Mermaid rendering fails
- **WHEN** the Mermaid source cannot be rendered
- **THEN** the detail viewer MUST show a student-safe fallback for the diagram
- **AND** it MUST NOT expose raw stack traces, Mermaid parser internals, or development diagnostics as ordinary student content.

### Requirement: Rich-content viewer preserves assistant privacy and copy boundaries
The student H5 Atom assistant SHALL keep rich-content viewer controls separate from answer content, backend history, copied text, and student-safe role boundaries.

#### Scenario: Student copies an assistant answer
- **WHEN** the student activates the answer copy action on a message that contains rich-content controls
- **THEN** the copied text MUST contain the original assistant answer Markdown
- **AND** it MUST NOT include rendered table controls, Mermaid viewer controls, hidden route ids, HTML, SVG, pan/zoom state, parser diagnostics, or detail-view labels.

#### Scenario: Conversation history is sent to backend
- **WHEN** a follow-up assistant request sends recent conversation history
- **THEN** each history item MUST include only the expected role and content fields
- **AND** it MUST NOT include local message ids, artifact ids, route params, rendered HTML, rendered SVG, zoom state, or detail-view UI state.

#### Scenario: Role-boundary metadata is present
- **WHEN** assistant metadata includes sources, retrieval details, guardrail decisions, tool traces, or other internal fields
- **THEN** the rich-content viewer MUST NOT expose those fields as visible student content
- **AND** it MUST NOT make those fields available through table, Mermaid, copy, route, or fallback UI.

### Requirement: Rich-content detail navigation preserves chat context
The student H5 Atom assistant SHALL open rich-content detail views without losing the student's chat context, root/detail route semantics, or local history.

#### Scenario: Rich content opens from the root AI route
- **WHEN** the student opens a rich artifact from `/ai`
- **THEN** the app MUST navigate to a student detail route or equivalent route-backed second-level view
- **AND** the route MUST hide the root bottom navigation according to detail-route rules
- **AND** the back action MUST return the student to the root AI conversation.

#### Scenario: Rich content opens from contextual AI chat
- **WHEN** the student opens a rich artifact from contextual `/ai/chat`
- **THEN** the app MUST preserve enough source context to return the student to the contextual chat flow
- **AND** the detail viewer MUST NOT introduce the root history action or root-only empty-state chrome.

#### Scenario: New chat is started after returning
- **WHEN** the student returns from a rich-content detail view and starts a new chat
- **THEN** the existing new-chat behavior MUST continue to clear visible turns and context binding according to the established root/detail rules
- **AND** the rich-content route state MUST NOT keep stale artifact content alive in the new chat.
