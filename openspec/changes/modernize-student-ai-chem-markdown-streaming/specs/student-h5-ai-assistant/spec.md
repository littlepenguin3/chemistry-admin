## ADDED Requirements

### Requirement: Student assistant distinguishes streaming and completed answer rendering
The student H5 AI assistant SHALL route active and completed assistant answer content through the appropriate Markdown rendering mode while preserving the existing chat state model.

#### Scenario: Active answer turn is the only streaming Markdown turn
- **WHEN** the assistant is loading and the latest visible message is an assistant answer with non-empty content
- **THEN** only that latest assistant answer MUST use the streaming Markdown renderer
- **AND** earlier assistant answers MUST remain completed static Markdown turns
- **AND** user messages MUST remain plain user-authored chat bubbles.

#### Scenario: Final completion converts answer to stable turn
- **WHEN** the active assistant turn completes successfully
- **THEN** the visible assistant message MUST become a completed static Markdown turn
- **AND** successful root replies MUST continue using the established flat root assistant answer surface and action row
- **AND** contextual detail replies MUST continue using the established contextual assistant surface.

#### Scenario: Local history is renderer-agnostic
- **WHEN** a root or detail assistant conversation is saved to local history
- **THEN** the stored messages MUST include plain message content and supported metadata only
- **AND** stored messages MUST NOT include Streamdown component state, smooth-stream scheduler state, animation flags, Mermaid render output, or DOM-derived content.

#### Scenario: Follow-up prompt behavior is unchanged
- **WHEN** the latest assistant turn is still streaming
- **THEN** dynamic follow-up prompt chips MUST remain hidden or disabled according to existing loading behavior
- **WHEN** the turn completes successfully
- **THEN** dynamic follow-up prompt chips MUST still be derived only from the latest successful final metadata.

### Requirement: Root first-answer visual state survives modern streaming
The student H5 Atom root assistant SHALL preserve the approved first-answer background glow behavior while changing answer text rendering.

#### Scenario: First submitted root answer is waiting
- **WHEN** the `/ai` root has exactly the first user turn and an active first assistant turn waiting or streaming
- **THEN** the approved dynamic background glow MUST remain tied to the first-answer loading state
- **AND** switching the answer body to Streamdown MUST NOT prematurely remove or restart the glow.

#### Scenario: First answer completes
- **WHEN** the first root assistant answer finishes and the assistant turn becomes completed
- **THEN** the glow MUST still perform the established rapid disappearance behavior
- **AND** subsequent completed chat content MUST render on the theme background without recurring glow interference.

#### Scenario: Empty and draft root states remain static
- **WHEN** the root assistant is on the welcome screen or the student is editing the first message before submission
- **THEN** the background MUST remain in the established static state
- **AND** Streamdown or smooth-stream code MUST NOT introduce background animation before the first answer is actually waiting.

### Requirement: Assistant stream state handles smoothing without changing API semantics
The student H5 AI assistant SHALL integrate smooth answer display as frontend state only and SHALL NOT change request or response contracts.

#### Scenario: Request payload is unchanged
- **WHEN** the student submits a question after this change
- **THEN** the frontend MUST call the existing student assistant stream endpoint with the existing active `AssistantContext`, question, and `conversation_history` fields
- **AND** it MUST NOT require a new backend payload field for smoothing or renderer mode.

#### Scenario: Stream events keep existing meanings
- **WHEN** the frontend receives `status`, `thinking`, `delta`, `replace`, `final`, or `error` events
- **THEN** each event MUST keep its established semantic meaning
- **AND** smoothing MUST only affect how `delta` or replacement answer text is released to the visible answer body.

#### Scenario: User sends a follow-up after smoothed answer
- **WHEN** the student sends a follow-up after a smoothed rich Markdown answer completes
- **THEN** `conversation_history` MUST include the final plain answer text
- **AND** it MUST NOT include partially displayed text, omitted timer buffers, or rendered HTML.

#### Scenario: New chat clears active smoothing state
- **WHEN** the student activates the new-chat action or resets context
- **THEN** any active smoothing timer, raw answer buffer, display buffer, and streaming renderer state for the previous turn MUST be cleared
- **AND** the new chat MUST begin from the established empty or contextual state.

### Requirement: Student assistant rich Markdown remains mobile layout-safe
The student H5 AI assistant SHALL contain rich Markdown inside the assistant route without breaking mobile chat ergonomics.

#### Scenario: Rich answer appears on root flat canvas
- **WHEN** a root assistant answer contains tables, formulas, task lists, or Mermaid diagrams
- **THEN** the content MUST remain visually part of the flat answer turn
- **AND** it MUST not reintroduce a white card shell around the entire completed root assistant answer.

#### Scenario: Rich answer appears on contextual route
- **WHEN** a contextual assistant answer contains tables, formulas, task lists, or Mermaid diagrams
- **THEN** the content MUST remain within the contextual assistant message boundary
- **AND** it MUST not inherit root-only flat reply spacing unless explicitly scoped.

#### Scenario: Rich content reaches the bottom area
- **WHEN** a long rich Markdown answer scrolls near the composer and bottom navigation
- **THEN** tables, formula scroll containers, Mermaid containers, and plugin controls MUST not overlap the composer or bottom navigation
- **AND** the student MUST be able to continue scrolling, reading, and typing.

#### Scenario: Keyboard-active chat remains usable
- **WHEN** the soft keyboard is active while rich Markdown content exists in the conversation
- **THEN** the composer MUST remain reachable according to the existing keyboard-aware layout
- **AND** rich Markdown overflow containers MUST not steal layout height in a way that hides the input field.
