## MODIFIED Requirements

### Requirement: RAG-gated workbench access
The system SHALL require usable precomputed catalog-point textbook evidence, rather than live Qwen retrieval availability, before a teacher can start or continue AI-assisted question creation or repair in the point-aware question workbench.

#### Scenario: Teacher opens AI creation when precomputed evidence is available
- **WHEN** a teacher selects an experiment or experiment point and the selected point has fresh or partial textbook evidence bindings
- **THEN** the workbench SHALL allow the teacher to start an AI create session when the final chat-generation service is available
- **AND** it SHALL show that generated candidates will use precomputed textbook evidence.

#### Scenario: Teacher opens AI repair when point evidence is missing
- **WHEN** a teacher selects AI repair for an existing question while the target point has no fresh or partial evidence bindings
- **THEN** the workbench SHALL prevent starting the AI repair session
- **AND** it SHALL show that the teacher must refresh point or chapter evidence before generation.

#### Scenario: Teacher sends a prompt after refresh service becomes unhealthy
- **WHEN** a teacher has an open workbench session, selected point evidence remains fresh or partial, and Qwen/Elasticsearch/rerank later becomes unhealthy
- **THEN** the backend SHALL still allow candidate generation when the final chat-generation service is available
- **AND** it SHALL NOT perform live Qwen retrieval during generation.

#### Scenario: Teacher sends a prompt after evidence becomes stale
- **WHEN** a teacher has an open workbench session and the selected point evidence becomes stale or missing
- **THEN** the backend SHALL reject candidate generation
- **AND** the UI SHALL preserve prior turns and candidates while showing the evidence freshness failure.

### Requirement: Evidence-first workbench context
The workbench SHALL show the selected experiment, target point context, precomputed source evidence package, and generation readiness before or alongside teacher prompts.

#### Scenario: Create workbench targets multiple points
- **WHEN** a teacher starts AI creation for multiple points under one experiment
- **THEN** the workbench SHALL record all selected point keys in the session context
- **AND** the context panel SHALL show those target points before generation.

#### Scenario: Repair workbench uses bound points
- **WHEN** a teacher starts AI repair from an existing point-aware question
- **THEN** the workbench SHALL derive target points from the question's bound primary point metadata
- **AND** the teacher prompt SHALL refine intent without directly editing the original question structure.

#### Scenario: Workbench shows precomputed evidence diagnostics
- **WHEN** a workbench session has precomputed textbook evidence bindings
- **THEN** the workbench SHALL show the evidence package grouped by principle, phenomenon, and safety section
- **AND** it SHALL show source count, supported sections, missing sections, evidence freshness, and whether evidence came from Qwen-reranked textbook chunks.

#### Scenario: Workbench passes point content and evidence to LLM
- **WHEN** candidate generation is requested
- **THEN** the backend SHALL include the point three-part content and selected precomputed textbook evidence in the final chat model prompt
- **AND** it SHALL deduplicate repeated chunk text while preserving the section roles each chunk supports.

## ADDED Requirements

### Requirement: Generation uses precomputed evidence only
The workbench SHALL use precomputed selected evidence bindings as the only textbook evidence source for AI candidate generation.

#### Scenario: Selected evidence exists
- **WHEN** selected point evidence bindings are fresh or partial
- **THEN** the backend SHALL build the workbench evidence package from those bindings
- **AND** it SHALL call the final chat-generation model with that evidence.

#### Scenario: Selected evidence is unavailable
- **WHEN** selected point evidence bindings are missing, stale, failed, disabled, or unavailable
- **THEN** the backend SHALL block generation
- **AND** it SHALL NOT fall back to live Qwen embedding, Elasticsearch recall, or Qwen rerank.

#### Scenario: Candidate diagnostics exist
- **WHEN** candidate evidence diagnostics exist for the selected point
- **THEN** the backend MAY expose those diagnostics in admin inspection payloads
- **AND** it SHALL NOT send candidate-only chunks to the final chat-generation model.
