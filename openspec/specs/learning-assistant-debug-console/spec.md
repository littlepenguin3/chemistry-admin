# learning-assistant-debug-console Specification

## Purpose
TBD - created by archiving change upgrade-learning-assistant-debug-rag. Update Purpose after archive.
## Requirements
### Requirement: Admin multi-turn debug console
The system SHALL provide an admin-only learning assistant debug console that supports multi-turn chat testing with persistent turn history for the current page session.

#### Scenario: Admin opens learning assistant debug console
- **WHEN** an authenticated admin opens `/admin/learning-assistant`
- **THEN** the page SHALL show a chat-oriented debug console with context controls, a message timeline, and a per-turn diagnostics inspector
- **AND** it SHALL retain submitted turns in the current page session until the admin clears the conversation.

#### Scenario: Admin submits a follow-up question
- **WHEN** the admin sends a new question after one or more previous turns
- **THEN** the request SHALL include the relevant prior conversation context
- **AND** the new assistant answer SHALL appear as a new assistant turn rather than replacing the prior result.

### Requirement: Streaming Markdown answers without admin hard truncation
The admin debug console SHALL stream assistant answers and render Markdown without applying the student mobile hard truncation by default.

#### Scenario: Assistant response streams
- **WHEN** the backend emits partial answer events
- **THEN** the page SHALL append the new content to the active assistant turn
- **AND** it SHALL show the turn as running until the final event is received.

#### Scenario: Assistant response contains Markdown
- **WHEN** the final or streaming answer contains Markdown headings, lists, bold text, code, or paragraph breaks
- **THEN** the page SHALL render the Markdown as formatted content without enabling raw HTML execution.

#### Scenario: Admin debug answer exceeds student mobile cap
- **WHEN** an admin debug run produces an answer longer than the student mobile cap
- **THEN** the backend SHALL NOT hard-truncate it solely because of the student mobile policy
- **AND** any admin-requested length control SHALL be explicit in the request or admin settings.

### Requirement: Turn-level diagnostics inspector
The system SHALL expose guardrail, classification, tool-call, RAG, source, and raw response diagnostics for each assistant turn.

#### Scenario: Admin selects a completed turn
- **WHEN** the admin selects a completed assistant turn
- **THEN** the inspector SHALL show the answer status, classification, guardrail decisions, tool calls, selected sources, and raw structured response for that turn.

#### Scenario: Retrieval diagnostics are available
- **WHEN** a turn uses RAG
- **THEN** the inspector SHALL show the generated retrieval queries, recall sources, rerank scores when available, and final evidence selected for the answer.

#### Scenario: Runtime performance is available
- **WHEN** hybrid BGE RAG is enabled
- **THEN** the debug console SHALL show whether the optional BGE service is reachable
- **AND** it SHALL show useful runtime metrics such as model loaded state, container memory, process/container CPU time, request counts, and service probe latency when available.

#### Scenario: BGE warmup status is available
- **WHEN** the optional BGE service is configured to warm up on startup
- **THEN** the debug console SHALL show whether warmup is disabled, not started, running, succeeded, or failed
- **AND** it SHALL show warmup duration or error details when available.

#### Scenario: Retrieval diagnostics are unavailable
- **WHEN** a turn does not use RAG or diagnostics are not returned
- **THEN** the inspector SHALL show an explicit empty state rather than stale diagnostics from a previous turn.

### Requirement: Chapter-scoped experiment point intent starter
The admin learning assistant debug console SHALL present a chat empty state that lets the user choose an experiment, a video point under that experiment, and a question intent for the currently selected chapter before starting normal multi-turn chat.

#### Scenario: Empty chat shows experiment point intent panel
- **WHEN** an authenticated admin opens the learning assistant debug console with no chat turns
- **AND** a chapter is selected in the left-side context controls
- **THEN** the central chat area SHALL show experiments associated with that chapter
- **AND** selecting an experiment SHALL show its video points
- **AND** selecting a point SHALL show available question intents.

#### Scenario: Chapter selection remains outside the chat starter
- **WHEN** the admin changes the selected chapter in the left-side context controls
- **THEN** the empty-state starter panel SHALL refresh its experiment and point options from the new chapter
- **AND** stale experiment, point, and intent selections from the previous chapter SHALL NOT be submitted.

#### Scenario: Intent prepares a point-context question
- **WHEN** the admin selects an experiment, a video point, and a question intent
- **THEN** the console SHALL automatically prepare and sync a natural-language student question for that point and intent into the normal composer
- **AND** the starter preview SHALL expose one prominent primary action to start with that question
- **AND** that primary action SHALL use an open-source designed animated button component pattern rather than page-local bespoke animation markup
- **AND** the action copy SHALL read `从这个问题开始`
- **AND** the action SHALL keep a visible, slow, non-orbiting green AI glow by default
- **AND** the default glow SHALL use internal shimmer, subtle text shine, and a soft breathing backlight instead of rotating border motion
- **AND** the default glow SHALL include multiple larger irregular green light clusters with independent slow motion and shape variation
- **AND** hover or keyboard focus SHALL preserve the glow and add a slower left-to-right green ink-wash lightening pass rather than a white glare
- **AND** submitting it SHALL include the selected `chapter_id`, `experiment_id`, and stable `point_key`.

#### Scenario: Chat behavior continues after first send
- **WHEN** the first question is submitted from the starter panel
- **THEN** the central area SHALL switch to the normal multi-turn chat timeline
- **AND** streaming answers, follow-up questions, turn selection, clearing turns, and diagnostics SHALL continue to work as in the existing chat console.

#### Scenario: Manual questions can use or clear selected point context
- **WHEN** a point context is active after a starter-panel submission
- **THEN** typed follow-up questions SHALL continue to include that point context
- **AND** the console SHALL provide a visible way to clear the active point context before sending a chapter-only question.

#### Scenario: Chapter has no video points
- **WHEN** the selected chapter has no experiments with video points
- **THEN** the empty-state starter panel SHALL show an explicit empty state
- **AND** the normal composer SHALL remain available for chapter-only questions.

