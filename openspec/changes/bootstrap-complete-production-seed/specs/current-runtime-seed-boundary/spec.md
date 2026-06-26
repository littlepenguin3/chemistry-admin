## MODIFIED Requirements

### Requirement: Authoritative current seed whitelist
The repository SHALL treat `data/seed` as a strict whitelist of current runtime, import, rebuild, and validation data.

#### Scenario: Seed whitelist is validated
- **WHEN** production resource validation inspects `data/seed`
- **THEN** it MUST allow only current seed resources required to restore or validate the application baseline
- **AND** it MUST fail if unclassified historical reports, audit drafts, generated review artifacts, retired old point/evidence/question-bank artifacts, local BGE embedding artifacts, or unreviewed media dumps remain under `data/seed`.

#### Scenario: Current seed resources are listed
- **WHEN** the current seed manifest is generated or checked
- **THEN** it MUST include formal experiments, knowledge framework JSON, catalog tree seed, full catalog point content seed, catalog point textbook evidence seed, current real catalog-node question-bank seed, canonical textbook chunks, precomputed Qwen textbook RAG Elasticsearch documents, search dictionaries, ES/IK analyzer assets, student learning profiles, seed teacher/class/student identity data, media seed manifests, seeded media file artifacts or checksummed media package references, point-video binding seed data, and current manifests
- **AND** it MUST include `data/seed/search/chemistry_vocabulary.json` because runtime chemistry search reads it.

#### Scenario: Historical provenance is encountered
- **WHEN** files such as normalized three-element drafts, semantic mapping reports, chemistry review notes, import reports, validation reports, embedding QA reports, old rebuilt-bank reports, or raw unreviewed video folders are encountered
- **THEN** validation MUST classify them as non-current seed
- **AND** cleanup MUST remove them or move them to a non-seed artifact location rather than protect them as operational seed data.

### Requirement: Current catalog-node question bank seed
The current published question bank SHALL be exportable, importable, and validated as catalog-node seed data.

#### Scenario: Current question bank seed is exported
- **WHEN** the accepted current question-bank baseline is exported
- **THEN** the export MUST contain 78 published question banks and 2,311 published questions
- **AND** each question MUST preserve objective payload, experiment references, bank references, source chunk ids, source references, status, and generation/review lineage needed by teacher browsing, student assessment, duplicate checks, and AI repair.
- **AND** questions with newer point bindings MUST preserve primary catalog point node ids and primary canonical point ids.
- **AND** legacy point-aware real questions that do not yet have primary point ids MUST preserve source references, source chunk ids, and point-aware metadata.

#### Scenario: Current question bank seed is imported
- **WHEN** a fresh database imports current seed resources
- **THEN** the import MUST recreate the current published catalog-node question-bank baseline
- **AND** it MUST import required supporting rows such as supplemental formal experiments, generation lineage, and question semantic fingerprints when present
- **AND** it MUST reject mock/fake question rows, malformed objective payloads, missing source references, missing source chunks, and references to non-existent experiments, banks, chunks, catalog nodes, or canonical points.

#### Scenario: Current question bank seed is validated
- **WHEN** production readiness validates question-bank data
- **THEN** it MUST verify bank/question counts, valid experiment ids, valid bank ids, objective question payloads, source chunk ids, resolvable source references, point-aware metadata for legacy questions, semantic fingerprint counts, and published status
- **AND** it MUST fail if the current question bank is silently treated as empty or if mock/fake question data is included.
