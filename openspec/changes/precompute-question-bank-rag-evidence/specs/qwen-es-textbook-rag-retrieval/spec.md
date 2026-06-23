## ADDED Requirements

### Requirement: Qwen ES textbook retrieval prepares point evidence
The system SHALL prepare catalog point textbook evidence by using configured Qwen-compatible embedding, Elasticsearch textbook chunk recall, and configured Qwen-compatible rerank.

#### Scenario: Point evidence refresh runs
- **WHEN** a catalog point evidence refresh job runs for textbook evidence
- **THEN** the backend SHALL build separate queries for `principle`, `phenomenon`, and `safety`
- **AND** each query SHALL include point title, chapter, catalog path, section label, section description, and available reaction equations.

#### Scenario: Query embedding and recall run
- **WHEN** a section query is non-empty
- **THEN** the backend SHALL call the configured Qwen embedding endpoint for that query
- **AND** it SHALL query the configured Elasticsearch textbook chunk index with keyword recall and vector recall.

#### Scenario: Candidate rerank runs
- **WHEN** Elasticsearch returns candidates for a section
- **THEN** the backend SHALL call the configured Qwen rerank endpoint with the candidate texts
- **AND** selected evidence order SHALL follow rerank score while preserving recall score and source metadata.

### Requirement: Selected evidence and candidate diagnostics are separated
The system SHALL distinguish selected evidence used for question generation from candidate diagnostics used for inspection.

#### Scenario: Selected evidence is persisted
- **WHEN** reranked section evidence is available
- **THEN** the backend SHALL persist at most three selected chunks per section as fresh evidence bindings
- **AND** those selected bindings SHALL be the only textbook chunks sent to the LLM for question generation.

#### Scenario: Candidate diagnostics are persisted
- **WHEN** reranked candidates are available for a section
- **THEN** the backend SHALL persist up to twenty candidate summaries per section in evidence-state diagnostics
- **AND** candidate diagnostics SHALL include chunk id, section, rank, recall score, rerank score, source metadata, and text preview.
- **AND** candidate diagnostics SHALL NOT be treated as selected generation evidence.

#### Scenario: Candidate diagnostics omit full text
- **WHEN** candidate diagnostics are stored
- **THEN** the backend SHALL store preview text and source metadata
- **AND** it SHALL NOT duplicate full textbook chunk text for every diagnostic candidate.

### Requirement: Sectioned evidence supports partial readiness
The system SHALL treat sectioned point evidence as usable when at least one section has selected textbook evidence.

#### Scenario: All sections have selected evidence
- **WHEN** principle, phenomenon, and safety sections each have selected evidence
- **THEN** the point evidence state SHALL be `succeeded`
- **AND** generation SHALL be allowed for that point when the AI generation service is available.

#### Scenario: Some sections have selected evidence
- **WHEN** at least one section has selected evidence and another section has none
- **THEN** the point evidence state SHALL be `partial`
- **AND** generation SHALL be allowed only with supported and missing section diagnostics.

#### Scenario: No section has selected evidence
- **WHEN** no section has selected evidence
- **THEN** the point evidence state SHALL be `missing`
- **AND** question generation SHALL be blocked for that point until evidence is refreshed successfully.

### Requirement: Textbook evidence refresh does not call the final question LLM
The system SHALL keep evidence refresh separate from final question generation.

#### Scenario: Evidence refresh prepares chunks
- **WHEN** a teacher refreshes current point or chapter evidence
- **THEN** the backend SHALL call only retrieval dependencies needed for evidence preparation
- **AND** it SHALL NOT call DeepSeek or another final chat-generation model.

#### Scenario: Question generation runs later
- **WHEN** a teacher sends an AI question-generation prompt
- **THEN** the backend SHALL read selected precomputed evidence bindings
- **AND** it SHALL call the configured final chat-generation model only for candidate generation.
