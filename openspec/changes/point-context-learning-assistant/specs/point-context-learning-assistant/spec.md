## ADDED Requirements

### Requirement: Structured point context request
The learning assistant SHALL accept optional structured video-point context in addition to the student question.

#### Scenario: Prompt suggestion sends point context
- **WHEN** a student or admin selects a video-point prompt suggestion
- **THEN** the request SHALL include the selected `chapter_id`, `experiment_id`, and `point_key`
- **AND** the backend SHALL preserve the original student-facing question text.

#### Scenario: Free-form question without point context
- **WHEN** a student sends a free-form question from a chapter page without selecting a point
- **THEN** the request SHALL still include the selected `chapter_id`
- **AND** the assistant SHALL continue to answer using chapter context and optional RAG behavior.

### Requirement: Fixed point evidence package
The learning assistant SHALL assemble a fixed point evidence package whenever structured point context is provided.

#### Scenario: Point context has manually reviewed evidence
- **WHEN** a request includes an `experiment_id` and `point_key`
- **THEN** the backend SHALL resolve the experiment point metadata
- **AND** it SHALL load the manual-reviewed point evidence binding for that `(experiment_id, point_key)`
- **AND** it SHALL hydrate reviewed `experiment_chunk_ids` and `theory_chunk_ids` from `source_chunks` for the fixed evidence package.

#### Scenario: RAG is disabled for a point request
- **WHEN** a point-context request is submitted with RAG lookup disabled
- **THEN** the assistant SHALL still receive the fixed point evidence package
- **AND** it SHALL answer from point evidence and reliable chemistry knowledge without claiming supplemental RAG evidence was used.

#### Scenario: RAG is enabled for a point request
- **WHEN** a point-context request is submitted with RAG lookup enabled
- **THEN** the fixed point evidence package SHALL be available before supplemental retrieval
- **AND** hybrid RAG SHALL only add broader supporting evidence rather than replacing the fixed point context.

#### Scenario: Point reviewed evidence is weak but available
- **WHEN** the selected point evidence has review grade `weak_but_best_available`
- **THEN** the assistant SHALL still receive the reviewed point evidence
- **AND** diagnostics SHALL expose the review grade
- **AND** the assistant SHALL avoid overstating the strength or completeness of that evidence.

#### Scenario: Point evidence is unavailable
- **WHEN** the backend cannot find a manual-reviewed evidence binding for the selected point
- **THEN** the assistant SHALL keep the structured point metadata in context
- **AND** it SHALL NOT query question-bank `source_audit` as a fallback fixed evidence source
- **AND** it SHALL avoid claiming a specific textbook source that was not found.

### Requirement: Point context diagnostics
The learning assistant response SHALL expose point-context diagnostics for admin inspection.

#### Scenario: Admin inspects point-context turn
- **WHEN** an admin selects a turn that included `point_key`
- **THEN** diagnostics SHALL show the resolved chapter, experiment, point key, point title when available, point evidence count, manual review flag, and review grade
- **AND** diagnostics SHALL distinguish fixed point evidence from supplemental RAG evidence.
