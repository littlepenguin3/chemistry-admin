## ADDED Requirements

### Requirement: Blank server restores to a usable baseline
The system SHALL provide a complete production seed bootstrap that can restore a blank database, empty media root, and empty Elasticsearch indexes into a directly usable application baseline.

#### Scenario: Complete bootstrap runs
- **WHEN** an operator runs the complete production seed bootstrap on an empty server with required runtime services available
- **THEN** the bootstrap MUST apply migrations and import teacher identity, class roster, student login data, catalog experiments, catalog point descriptions, seeded media assets, point-video bindings, canonical textbook chunks, precomputed textbook RAG documents, point evidence bindings, and published question banks
- **AND** it MUST finish with a validation report that identifies the restored resource counts and any missing runtime configuration.

#### Scenario: Runtime API keys are absent
- **WHEN** API keys or model names for AI providers are not configured during bootstrap
- **THEN** the seed import MUST still restore database, media, RAG index documents, evidence bindings, and question-bank data
- **AND** the validation report MUST identify AI generation as configuration-pending rather than treating seed data as missing.

### Requirement: Complete seed bootstrap is idempotent
The seed bootstrap SHALL be safe to rerun for the same seed version without duplicating users, roster rows, media assets, point bindings, evidence bindings, or question rows.

#### Scenario: Bootstrap is rerun
- **WHEN** an operator reruns the same complete production seed bootstrap
- **THEN** rows and files owned by the same seed version MUST be upserted or verified
- **AND** duplicate media assets, duplicate point-video bindings, duplicate class roster entries, duplicate RAG documents, and duplicate published questions MUST NOT be created.

#### Scenario: Seed version changes
- **WHEN** a newer complete seed version is imported
- **THEN** the importer MUST identify rows and files created by the prior seed version
- **AND** it MUST replace or append according to the new manifest without deleting operator-created runtime data outside the seed ownership scope.

### Requirement: Complete seed validation proves cross-resource integrity
The system SHALL validate the restored baseline across database rows, media files, Elasticsearch documents, and seed manifests.

#### Scenario: Validation runs after bootstrap
- **WHEN** production seed validation runs after complete bootstrap
- **THEN** it MUST verify teacher account, class, roster, student account/login state, catalog node counts, full point-content counts, media file checksums, point-video binding targets, source chunk counts, precomputed RAG document counts, evidence binding targets, and real published question-bank counts
- **AND** it MUST fail if required seed files are absent, checksums do not match, references point to missing rows, mock question data is present, or seeded videos are bound to non-point catalog nodes.

#### Scenario: Some points have no real footage
- **WHEN** a catalog point has no real seeded video
- **THEN** bootstrap MUST bind that point to the shared generated placeholder video
- **AND** validation MUST report the point as placeholder-backed rather than missing or failed.
