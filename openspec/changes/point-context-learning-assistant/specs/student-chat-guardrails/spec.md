## ADDED Requirements

### Requirement: Context-aware policy classification
The student learning assistant SHALL classify policy decisions using resolved multi-turn context, not only the latest raw question text.

#### Scenario: Short follow-up inherits prior course context
- **WHEN** the student asks a short follow-up such as "why", "this one?", or "explain the second point" after an in-scope chemistry answer
- **THEN** the policy gate SHALL evaluate the request against the prior course topic and structured context
- **AND** it SHALL NOT refuse the request solely because the latest text is ambiguous.

#### Scenario: Structured point context guides policy
- **WHEN** a request includes `chapter_id`, `experiment_id`, or `point_key`
- **THEN** the policy gate SHALL receive those fields or an equivalent resolved question
- **AND** ordinary point explanation SHALL be classified as a normal learning answer unless another safety or assessment rule applies.

#### Scenario: Risky follow-up still protected
- **WHEN** a follow-up asks for unsafe experiment steps or direct assessment answers
- **THEN** the safety or assessment guardrail SHALL still apply
- **AND** inherited context SHALL NOT override the risky-request policy.

## MODIFIED Requirements

### Requirement: Platform resource grounding
The student learning assistant SHALL require platform lookup only for claims about published platform resource availability, playback, download, or upload status.

#### Scenario: Student asks for a published resource
- **WHEN** the student asks whether a video, file, link, download, or platform material has been uploaded, published, or is available to watch
- **THEN** the assistant SHALL only report ready and published resources found by platform lookup
- **AND** it SHALL state unavailable when no matching published resource exists.

#### Scenario: Student asks to explain a video point
- **WHEN** the student asks to explain a current video point, experiment phenomenon, source figure, or material content
- **THEN** the assistant SHALL treat the request as a learning answer
- **AND** it SHALL NOT route the request to platform resource availability solely because the words "video", "material", or "resource" appear.

#### Scenario: Student asks about an evidence image or figure
- **WHEN** the student asks what a source figure, evidence image, or figure-backed point shows
- **THEN** the assistant SHALL keep the request on the learning evidence rail
- **AND** it SHALL NOT treat the request as a platform resource availability query unless the student explicitly asks whether an uploaded platform resource exists.

#### Scenario: No published resource exists
- **WHEN** a true platform-resource availability query finds no ready and published resources
- **THEN** the assistant SHALL answer with the factual unavailable state
- **AND** the turn SHALL NOT be presented as an unsafe or out-of-course refusal.
