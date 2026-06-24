## ADDED Requirements

### Requirement: Visible thinking remains separate from rich answer Markdown
The student assistant visible thinking stream SHALL remain a status/progress surface and SHALL NOT be rendered as Markdown answer content by Streamdown or the static renderer.

#### Scenario: Thinking event arrives before answer text
- **WHEN** the stream emits a valid `thinking` event before any answer `delta`
- **THEN** the frontend MUST update the visible thinking line or equivalent running status
- **AND** it MUST NOT append the thinking message to the answer Markdown buffer
- **AND** it MUST NOT pass the thinking message into Streamdown as answer content.

#### Scenario: Thinking event arrives during answer streaming
- **WHEN** the stream emits a valid `thinking` event after answer text has started streaming
- **THEN** the frontend MAY update the running visible thinking line according to existing thinking rules
- **AND** it MUST preserve the answer raw buffer and displayed answer buffer separately
- **AND** it MUST NOT reorder, rewrite, or insert thinking text into the answer body.

#### Scenario: Final answer completes
- **WHEN** the active answer receives final completion
- **THEN** visible thinking text MUST be removed according to the existing completion behavior
- **AND** the completed static Markdown answer MUST contain only answer text and supported answer metadata presentation.

### Requirement: Smooth answer streaming does not fake visible thinking
The student assistant frontend SHALL treat smooth answer display as answer pacing only and SHALL NOT synthesize visible thinking messages from smoothing state.

#### Scenario: Smooth buffer has pending text
- **WHEN** raw answer content is waiting in the smoothing buffer
- **THEN** the frontend MUST NOT convert the pending text into a visible thinking/status message
- **AND** the running line MUST continue to use authentic `thinking` events or established fallback status labels.

#### Scenario: No thinking event is available
- **WHEN** no valid thinking event has arrived for the active turn
- **THEN** the frontend MUST continue using the established status fallback behavior
- **AND** it MUST NOT invent model-reasoning summaries to explain Markdown rendering, smoothing, Mermaid parsing, or formula parsing.

#### Scenario: Mermaid or math rendering is pending
- **WHEN** a streamed formula or Mermaid block is incomplete and cannot yet render fully
- **THEN** the UI MAY show answer-content fallback inside the answer area
- **AND** it MUST NOT present renderer parsing state as model thinking.

### Requirement: Thinking accessibility stays polite with rich streaming answers
The student assistant frontend SHALL keep visible thinking announcements understandable while rich Markdown answer content streams.

#### Scenario: Thinking text changes while answer streams
- **WHEN** the visible thinking text changes during rich Markdown streaming
- **THEN** assistive technology SHOULD receive a polite update for the current thinking text
- **AND** answer Markdown animation MUST NOT cause duplicate announcements of the thinking line.

#### Scenario: Answer content animates
- **WHEN** Streamdown animates newly visible answer content
- **THEN** decorative animation MUST NOT be announced as separate status content
- **AND** reduced-motion preferences MUST reduce or disable motion without removing the current thinking text.

#### Scenario: Error occurs after thinking
- **WHEN** a stream error occurs after visible thinking has been shown
- **THEN** the error path MUST remove or supersede the running thinking line
- **AND** no pending thinking message MAY be appended to the error answer content.
