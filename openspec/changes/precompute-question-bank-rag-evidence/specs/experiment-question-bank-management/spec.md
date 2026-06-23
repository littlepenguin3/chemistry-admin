## ADDED Requirements

### Requirement: Question bank evidence refresh controls
The question-bank management page SHALL expose teacher-controlled textbook evidence refresh actions for the current chapter and selected point.

#### Scenario: Teacher views evidence refresh readiness
- **WHEN** a teacher opens the question-bank management page
- **THEN** the page SHALL show evidence refresh service readiness separately from AI question-generation readiness
- **AND** evidence refresh readiness SHALL describe Qwen embedding, Elasticsearch textbook index, and Qwen rerank availability.

#### Scenario: Teacher views generation readiness
- **WHEN** a teacher selects a point in the question-bank page
- **THEN** the page SHALL show whether AI generation is available for that point based on final chat service availability and fresh or partial selected evidence bindings
- **AND** it SHALL not claim generation is unavailable merely because Qwen refresh dependencies are currently down.

#### Scenario: Teacher refreshes current chapter evidence
- **WHEN** a teacher clicks refresh current chapter evidence
- **THEN** the page SHALL show a confirmation that includes affected point count, skipped fresh point count, estimated maximum Qwen embedding calls, estimated maximum Qwen rerank calls, and that DeepSeek will not be called
- **AND** the refresh SHALL start only after teacher confirmation.

#### Scenario: Teacher refreshes selected point evidence
- **WHEN** a teacher clicks refresh selected point evidence
- **THEN** the page SHALL show a confirmation for that point
- **AND** the backend SHALL enqueue evidence refresh for the selected point.

#### Scenario: Refresh progress is visible
- **WHEN** chapter or point evidence refresh jobs are pending, running, or complete
- **THEN** the page SHALL show point-level evidence status and chapter-level summary counts
- **AND** it SHALL distinguish succeeded, partial, missing, stale, failed, pending, and running evidence states.

### Requirement: Question bank generation consumes prepared evidence
Question-bank AI generation SHALL require prepared point evidence and SHALL not hide Qwen retrieval work inside the generate action.

#### Scenario: Teacher generates questions for a prepared point
- **WHEN** the selected point has fresh or partial selected textbook evidence
- **THEN** the AI workbench SHALL allow generation when the final chat-generation service is available
- **AND** generation SHALL use selected evidence bindings and point three-part content.

#### Scenario: Teacher generates questions for an unprepared point
- **WHEN** the selected point lacks usable selected evidence
- **THEN** the page SHALL block opening or sending generation prompts
- **AND** it SHALL show an action to refresh selected point or current chapter evidence.

#### Scenario: Teacher inspects evidence basis
- **WHEN** a teacher or administrator expands point evidence details
- **THEN** the page SHALL show selected evidence by section and MAY show candidate diagnostics
- **AND** candidate diagnostics SHALL be presented as inspection data rather than generation evidence.
