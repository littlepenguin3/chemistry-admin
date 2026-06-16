## ADDED Requirements

### Requirement: Teacher workbench retrieval contract
The system SHALL expose hybrid RAG health and retrieval diagnostics for teacher-side question-bank AI workbench requests.

#### Scenario: Workbench checks RAG runtime
- **WHEN** the question-bank page renders AI workbench actions
- **THEN** it SHALL use the same runtime health contract as the learning assistant to decide whether RAG-backed AI actions are available
- **AND** it SHALL distinguish RAG disabled, BGE unavailable, query generation disabled, and healthy hybrid rerank states.

#### Scenario: Workbench builds an evidence package
- **WHEN** a teacher starts or continues an AI workbench session under a healthy RAG runtime
- **THEN** the backend SHALL build an evidence package for the selected experiment, point context, original question when present, and teacher prompt
- **AND** the package SHALL include source references and retrieval diagnostics when available.

#### Scenario: Workbench records reranked evidence
- **WHEN** hybrid BGE reranking succeeds for a workbench request
- **THEN** the evidence package SHALL preserve final evidence order, chunk identifiers, source metadata, and rerank score where available
- **AND** the workbench SHALL show that the candidate was grounded in reranked RAG chunks.

#### Scenario: Workbench RAG fails closed
- **WHEN** hybrid RAG cannot provide healthy reranked evidence for a workbench request
- **THEN** the system SHALL block AI candidate generation rather than silently falling back to ungrounded local generation
- **AND** it SHALL return a diagnostic reason that the UI can display.
