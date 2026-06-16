## ADDED Requirements

### Requirement: Structured point prompt suggestions
The admin debug console SHALL present empty-chat video-point prompt suggestions as centered starting prompts and submit their structured point context.

#### Scenario: Empty chat shows point suggestions
- **WHEN** the admin opens the learning assistant debug console with no chat turns
- **THEN** the chat area SHALL show centered video-point prompt suggestions for the selected chapter
- **AND** the admin SHALL still be able to type a custom question instead.

#### Scenario: Admin selects a point prompt
- **WHEN** the admin clicks a video-point prompt suggestion
- **THEN** the debug console SHALL submit the prompt question with `chapter_id`, `experiment_id`, and `point_key`
- **AND** the resulting turn SHALL retain diagnostics that identify the selected point context.

#### Scenario: Point diagnostics show reviewed evidence source
- **WHEN** a turn includes a fixed point evidence package
- **THEN** the debug console SHALL show that the evidence came from manual-reviewed point bindings
- **AND** it SHALL show experiment evidence count, theory evidence count, manual review status, and review grade separately from supplemental RAG.

#### Scenario: Platform resource miss is not shown as a learning refusal
- **WHEN** a true platform-resource availability query finds no ready and published resource
- **THEN** the debug console SHALL label the result as resource unavailable or platform not found
- **AND** it SHALL NOT present that state as an unsafe, out-of-course, or generic guardrail refusal.

#### Scenario: Chapter changes before first prompt
- **WHEN** the admin changes the chapter before starting a chat
- **THEN** the prompt suggestions SHALL update to the new chapter's experiment video points
- **AND** suggestions from the previous chapter SHALL NOT be submitted accidentally.
