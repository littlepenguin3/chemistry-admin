## ADDED Requirements

### Requirement: Student H5 assistant presentation
The student H5 assistant SHALL present model answers, point context, and source summaries in a student-readable form while preserving existing student guardrail enforcement.

#### Scenario: Student chat renders chemistry answer
- **WHEN** the student assistant streams a markdown or chemistry-formatted answer
- **THEN** the H5 app MUST render the answer with markdown-compatible formatting
- **AND** it MUST keep the streaming fallback behavior for plain text answers

#### Scenario: Student chat receives final response metadata
- **WHEN** the student assistant stream emits a final response with sources
- **THEN** the H5 app MUST retain the final response metadata for that turn
- **AND** it MUST show a compact source or evidence summary suitable for students

#### Scenario: Student chat starts from point context
- **WHEN** a student opens the assistant from a property section or experiment point
- **THEN** the H5 app MUST include the selected chapter, experiment, point, and context summary in the request
- **AND** quick prompts MUST be relevant to the active property or point

#### Scenario: Student AI switch is disabled
- **WHEN** student AI entry or student AI capability is disabled by admin settings
- **THEN** the H5 app MUST hide or disable the student assistant entry after app-config refresh
- **AND** the backend MUST continue to reject stale student assistant requests
