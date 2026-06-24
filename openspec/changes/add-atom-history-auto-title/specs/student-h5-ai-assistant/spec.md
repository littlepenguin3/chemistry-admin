## ADDED Requirements

### Requirement: Atom history generated first-turn title
The student H5 Atom assistant SHALL support an optional sanitized `conversation_title` final metadata field for first-turn local history entries while preserving the existing local fallback title behavior.

#### Scenario: First turn saves generated title
- **WHEN** a student sends the first question in an Atom conversation and the final assistant metadata includes a valid `conversation_title`
- **THEN** the app MUST save that title on the same local history entry for the conversation
- **AND** the history row MUST display the generated title instead of the raw first-question truncation.

#### Scenario: Generated title is requested only for first turn
- **WHEN** the backend prepares final metadata for an assistant response whose request has empty `conversation_history`
- **THEN** the backend MUST attempt to include a concise student-readable `conversation_title` in the final metadata
- **AND** the title MUST be based on the latest student question, completed answer, active assistant context, and safe recent metadata inputs available to the existing final-metadata generation path.

#### Scenario: Follow-up turns do not rename history
- **WHEN** a student sends a follow-up question in a restored or ongoing Atom conversation
- **THEN** the backend MUST NOT require a new `conversation_title` for that turn
- **AND** the frontend MUST keep the existing local history title unless the conversation is still using the first-turn fallback and receives a valid first-turn title for the same history entry.

#### Scenario: Missing or invalid generated title falls back
- **WHEN** the final metadata omits `conversation_title`, metadata generation fails, or the returned title is invalid
- **THEN** the app MUST keep using the existing local fallback title derived from the conversation messages
- **AND** the chat answer, history persistence, and follow-up prompts MUST continue normally.

#### Scenario: Generated title stays out of answer and request history
- **WHEN** a generated `conversation_title` is accepted for a local history entry
- **THEN** the app MUST NOT append it to visible assistant answer text, copied answer text, visible thinking, source summaries, quick prompt chips, or backend `conversation_history`
- **AND** restoring the history entry MUST continue sending only recent `{ role, content }` turns as conversation history.

#### Scenario: Legacy local history remains readable
- **WHEN** the app reads an existing local history entry that does not contain a generated title
- **THEN** the app MUST continue to render the entry with its stored title or the existing message-derived fallback
- **AND** no localStorage migration or backend chat-session record MUST be required.
