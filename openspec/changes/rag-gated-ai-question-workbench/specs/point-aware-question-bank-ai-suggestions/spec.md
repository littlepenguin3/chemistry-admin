## ADDED Requirements

### Requirement: RAG-grounded AI suggestions
AI question-bank suggestions SHALL be generated only from usable RAG-grounded evidence for the selected experiment and point context.

#### Scenario: AI creates questions from selected points
- **WHEN** a teacher requests AI question creation for one or more selected video points
- **THEN** the suggestion request SHALL include the formal experiment id and selected point keys
- **AND** generated drafts SHALL include source audit metadata derived from the evidence package used for that request.

#### Scenario: AI repairs a bound question
- **WHEN** a teacher requests AI repair for an existing question with bound point metadata
- **THEN** the suggestion request SHALL include the original question id, formal experiment id, bound point keys, original answer shape, source audit, and option diagnostics
- **AND** generated repair drafts SHALL record lineage to the original question and evidence package.

#### Scenario: No usable evidence is available
- **WHEN** the selected experiment and point context cannot produce usable source evidence under the healthy RAG route
- **THEN** the system SHALL refuse AI suggestion generation
- **AND** it SHALL NOT create local-template candidates that appear publishable.

### Requirement: Prompt refinement preserves machine-valid question shape
Teacher prompts SHALL refine AI generation intent while the system preserves deterministic objective question structure.

#### Scenario: Prompt asks for direct manual structure changes
- **WHEN** a teacher prompt asks to directly overwrite answer JSON, point keys, or source audit fields
- **THEN** the system SHALL treat the prompt as an AI revision instruction
- **AND** the returned candidate SHALL still pass objective validation before publication is allowed.

#### Scenario: Prompt asks for unsupported subjective grading
- **WHEN** a teacher prompt asks for a subjective or AI-judged item type
- **THEN** the system SHALL keep suggestions limited to `single_choice`, `true_false`, or `fill_blank`
- **AND** it SHALL require machine-gradable answer metadata.
