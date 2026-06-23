## MODIFIED Requirements

### Requirement: RAG evidence refresh is asynchronous
The system SHALL refresh catalog-node evidence bindings through asynchronous jobs rather than blocking teacher saves or question generation.

#### Scenario: Point context changes
- **WHEN** point title, catalog path, normalized equations, phenomenon explanation, safety note, video readiness, or related point context changes
- **THEN** the system MUST mark catalog-node evidence as stale or enqueue a refresh according to configured trigger policy
- **AND** teacher save/publish actions MUST not wait for Qwen embedding, Elasticsearch recall, Qwen rerank, or evidence refresh completion.
- **AND** evidence refresh queries MUST NOT use teacher-only video resource titles, media file names, or media asset metadata as point semantics.

#### Scenario: Evidence refresh runs
- **WHEN** a RAG evidence refresh job runs
- **THEN** it MUST generate retrieval queries from catalog node context
- **AND** it MUST use the configured Qwen/Elasticsearch textbook RAG pipeline to select source chunks by principle, phenomenon, and safety section
- **AND** output bindings MUST target catalog node id or stable catalog seed key, not legacy `(experiment_id, point_key)`.

#### Scenario: Qwen or Elasticsearch service is unavailable
- **WHEN** Elasticsearch, the Qwen embedding endpoint, or the Qwen rerank endpoint is disabled, unreachable, or too slow during evidence refresh
- **THEN** the job MUST fail or defer with a diagnostic reason
- **AND** existing fresh or partial evidence bindings MUST remain usable for question generation when the final chat model is available.

## ADDED Requirements

### Requirement: Question-bank evidence refresh enqueues point jobs
The system SHALL allow teachers to enqueue textbook evidence refresh work from the question-bank page without blocking the page request.

#### Scenario: Teacher refreshes current chapter evidence
- **WHEN** a teacher confirms refresh for the currently selected question-bank chapter
- **THEN** the backend SHALL enqueue one `rag_evidence_refresh` job per eligible point in that chapter
- **AND** the response SHALL summarize enqueued, skipped, pending, running, succeeded, partial, missing, and failed point counts.

#### Scenario: Teacher refreshes current point evidence
- **WHEN** a teacher confirms refresh for the selected question-bank point
- **THEN** the backend SHALL enqueue or update a `rag_evidence_refresh` job for that point
- **AND** the response SHALL identify the point evidence state and job state.

#### Scenario: Fresh points are not forced
- **WHEN** chapter evidence refresh is requested without force
- **THEN** the backend SHALL skip points whose current evidence is fresh for the active content and retrieval configuration
- **AND** it SHALL include skipped counts in the response.

#### Scenario: Force refresh is requested
- **WHEN** chapter or point evidence refresh is requested with force
- **THEN** the backend SHALL enqueue refresh work for selected points even if evidence is currently fresh
- **AND** the UI SHALL show that existing selected evidence may be overwritten.

### Requirement: Evidence refresh records selected bindings by textbook section
The system SHALL persist textbook evidence bindings with section roles that can be consumed by question generation.

#### Scenario: Selected section evidence is written
- **WHEN** a point evidence refresh selects chunks for a section
- **THEN** the backend SHALL write fresh evidence bindings with evidence role `principle`, `phenomenon`, or `safety`
- **AND** each binding SHALL include rank, recall score, rerank score, source boundary, ES index name, source metadata, and preview text.

#### Scenario: Old automatic bindings are replaced
- **WHEN** a point evidence refresh writes new selected section evidence
- **THEN** the backend SHALL replace prior automatic textbook evidence bindings for that point
- **AND** it SHALL not retain previous selected bindings as generation evidence.

#### Scenario: Duplicate chunks support multiple sections
- **WHEN** the same chunk is selected for multiple sections
- **THEN** the backend SHALL preserve the section relationship for each selected role
- **AND** the question-generation evidence package SHALL deduplicate repeated chunk text while retaining all supported roles.

### Requirement: Evidence freshness uses point and retrieval fingerprints
The system SHALL determine whether precomputed evidence is current by comparing point-context and retrieval-configuration fingerprints.

#### Scenario: Point content changes
- **WHEN** point title, catalog path, principle text, phenomenon explanation, safety note, or normalized reaction equations change
- **THEN** existing evidence SHALL be considered stale until the point is refreshed with the new content fingerprint.

#### Scenario: Retrieval configuration changes
- **WHEN** textbook index name, embedding model, embedding dimension, rerank model, selected count, candidate count, or score threshold changes
- **THEN** existing evidence SHALL be considered stale until refreshed with the new configuration fingerprint.

#### Scenario: Stale evidence is encountered by generation
- **WHEN** a teacher tries to generate questions for a point whose evidence fingerprints are stale
- **THEN** the backend SHALL block generation for that point
- **AND** it SHALL tell the teacher to refresh evidence first.
