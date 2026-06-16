## ADDED Requirements

### Requirement: RAG-gated workbench access
The system SHALL require a healthy RAG runtime before a teacher can start or continue AI-assisted question creation or repair in the point-aware question workbench.

#### Scenario: Teacher opens AI creation when RAG is healthy
- **WHEN** a teacher selects an experiment or experiment point and the RAG runtime is enabled, hybrid BGE is enabled, query generation is enabled, and BGE health is healthy
- **THEN** the workbench SHALL allow the teacher to start an AI create session
- **AND** it SHALL show that generated candidates will use reranked evidence.

#### Scenario: Teacher opens AI repair when RAG is unhealthy
- **WHEN** a teacher selects AI repair for an existing question while RAG is disabled, BGE is unreachable, or query generation is disabled
- **THEN** the workbench SHALL prevent starting the AI repair session
- **AND** it SHALL show the missing RAG condition in teacher-readable language.

#### Scenario: Teacher sends a prompt after RAG becomes unhealthy
- **WHEN** a teacher has an open workbench session and sends a follow-up prompt after the RAG runtime is no longer healthy
- **THEN** the backend SHALL reject candidate generation
- **AND** the UI SHALL preserve prior turns and candidates while showing the gate failure.

### Requirement: Evidence-first workbench context
The workbench SHALL show the selected experiment, target point context, source evidence package, and RAG health before or alongside teacher prompts.

#### Scenario: Create workbench targets multiple points
- **WHEN** a teacher starts AI creation for multiple points under one experiment
- **THEN** the workbench SHALL record all selected point keys in the session context
- **AND** the context panel SHALL show those target points before generation.

#### Scenario: Repair workbench uses bound points
- **WHEN** a teacher starts AI repair from an existing point-aware question
- **THEN** the workbench SHALL derive target points from the question's bound primary point metadata
- **AND** the teacher prompt SHALL refine intent without directly editing the original question structure.

#### Scenario: Workbench shows evidence diagnostics
- **WHEN** a workbench session has source references or retrieval diagnostics
- **THEN** the workbench SHALL show the evidence package, source count, and whether the evidence came from reranked RAG or static fallback context.

### Requirement: Teacher prompt controls intent, not structure mutation
The workbench SHALL treat teacher text as refinement instructions for AI-generated candidates rather than direct mutation of published question structure.

#### Scenario: Teacher requests a revision
- **WHEN** a teacher asks the AI to change wording, diagnostic options, difficulty, or explanation
- **THEN** the system SHALL generate a new candidate version
- **AND** it SHALL keep the previous candidate and the published question unchanged until explicit validated publication.

#### Scenario: Candidate fails structural validation
- **WHEN** an AI candidate lacks deterministic answer shape, point bindings, source audit, lineage, or required option diagnostics
- **THEN** the workbench SHALL prevent publication
- **AND** it SHALL guide the teacher to request another AI revision.
