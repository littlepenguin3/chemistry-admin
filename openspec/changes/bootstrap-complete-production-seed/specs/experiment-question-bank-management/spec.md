## ADDED Requirements

### Requirement: Complete seed imports only real published questions
The question bank system SHALL import the production question baseline from seed without mock/fake questions.

#### Scenario: Published question baseline imports
- **WHEN** complete production seed bootstrap imports the current question-bank seed
- **THEN** it MUST create or update 78 generated published banks and 2,311 published objective questions
- **AND** all imported questions MUST be `single_choice`, `true_false`, or `fill_blank` with machine-gradable answer payloads.

#### Scenario: Mock question row is present
- **WHEN** question-bank seed validation sees mock/fake metadata, mock/fake explanation text, malformed objective payloads, or missing source references
- **THEN** validation MUST fail before publishing the row
- **AND** the importer MUST NOT silently coerce mock/fake rows into published questions.

#### Scenario: Legacy point-aware real questions are present
- **WHEN** real legacy point-aware questions lack newer primary point-node fields
- **THEN** the importer MAY accept them only if they preserve point-aware metadata, source chunk ids, source refs, experiment references, and bank references
- **AND** validation MUST report them separately from unresolved or malformed question rows.
