# student-h5-ai-assistant Specification

## Purpose
Define the student H5 AI chat surfaces, including direct composer-first root chat, contextual detail chat, optional starter behavior, unsupported-control boundaries, and local conversation history.
## Requirements
### Requirement: Mobile assistant starter surface
The student H5 AI root SHALL prioritize a direct mobile chat composer before any structured starter surface; starter prompts, if present, SHALL be secondary and MUST NOT block free-form asking.

#### Scenario: Student opens global assistant with no prior messages
- **WHEN** an authenticated student opens the `/ai` root with the default `learning_home` context and no chat turns
- **THEN** the app MUST render a mobile chat shell with a visible free-form composer
- **AND** the page MUST NOT require the student to choose a starter prompt, point, or intent before asking.

#### Scenario: Optional starter appears without occupying the primary flow
- **WHEN** optional starter prompts or question directions are shown before the first turn
- **THEN** they MUST remain visually secondary to the free-form composer
- **AND** they MUST NOT reoccupy the entire chat area after the first sent question.

#### Scenario: Starter copy stays student-facing
- **WHEN** optional starter copy renders labels, descriptions, status, or preview text
- **THEN** the copy MUST use student-facing learning language
- **AND** it MUST NOT expose teacher/admin diagnostics, policy codes, raw retrieval traces, or implementation jargon.

### Requirement: Starter intent choices
When the student H5 assistant exposes compact learning-intent choices inspired by the teacher learning assistant, those choices SHALL remain optional secondary controls that preserve direct free-form asking.

#### Scenario: Optional structured starter intents are exposed
- **WHEN** the implementation exposes optional starter intents for `learning_profile`, `catalog_profile`, `catalog_point`, or `learning_point` contexts
- **THEN** the starter surface MUST offer student-readable choices such as observation, phenomenon explanation, principle explanation, or mistake review
- **AND** it MUST include experiment design or comparison intents only when the context contains experiment or point information.

#### Scenario: Intent choice is selected
- **WHEN** the student taps an optional starter intent
- **THEN** the app MUST mark that intent as selected
- **AND** it MUST make the text that will be sent unambiguous before submission.

#### Scenario: Student chooses custom asking
- **WHEN** the student selects a custom asking intent
- **THEN** the app MUST preserve the active assistant context
- **AND** it MUST guide the student to type their own question rather than sending an empty or generic prompt.

### Requirement: Starter question preview and launch
The student H5 assistant SHALL only show starter previews when an optional structured starter is active, and the preview MUST NOT replace the direct composer as the default first-screen action.

#### Scenario: Preview is available for selected optional intent
- **WHEN** the active context and selected optional intent can produce a starter question
- **THEN** the app MUST display a student-readable preview region
- **AND** the preview MUST include the relevant context title or point title when available.

#### Scenario: Student launches optional starter question
- **WHEN** the student activates the optional starter launch action
- **THEN** the app MUST submit the previewed question through the existing student assistant stream endpoint
- **AND** the request MUST include the active `AssistantContext` fields already used by the student assistant.

#### Scenario: Preview and composer both contain text
- **WHEN** a starter preview exists and the student has also typed free-form input
- **THEN** the app MUST make the sent text unambiguous
- **AND** it MUST either send the typed input with the active context or clearly label separate actions for sending the preview versus the typed input.

### Requirement: Active context header
The student H5 assistant SHALL make active contextual chat understandable and dismissible without duplicating separate "current content" cards on the first screen.

#### Scenario: Global context is active
- **WHEN** the assistant context is the default `learning_home`
- **THEN** the root chat shell MUST identify the assistant as a global course Q&A entry
- **AND** it MUST avoid implying that a chapter, experiment, or point is bound.

#### Scenario: Learning or catalog context is active
- **WHEN** the assistant context is provided by a chapter, catalog profile, catalog point, point handoff, video result, or assessment report
- **THEN** the contextual chat shell MUST show the context title and a concise context type cue
- **AND** the subsequent assistant request MUST include available `chapter_id`, `experiment_id`, `point_key`, and `context_summary` values.

#### Scenario: Student clears context
- **WHEN** the student activates the context clear action
- **THEN** the app MUST return to the default `learning_home` assistant context
- **AND** the UI MUST make clear whether existing chat turns were preserved or a new global chat state was started.

### Requirement: Optional experiment starter data
The student H5 assistant SHALL remain useful without loading optional experiment starter data in the global AI root.

#### Scenario: Experiment starter data is not loaded
- **WHEN** the global AI root opens before experiment starter data is available or if an experiment request fails
- **THEN** the direct chat composer MUST remain usable
- **AND** student asking MUST NOT be blocked on experiment data loading.

#### Scenario: Experiment module starter is exposed later
- **WHEN** a later implementation exposes an optional experiment-question path using student-visible modules
- **THEN** the starter MUST load those modules through existing student APIs
- **AND** it MUST NOT introduce a new backend starter-suggestion contract unless a later change explicitly adds one.

### Requirement: Grok-like root assistant visual target
The student H5 `AI` root SHALL visually approximate the provided Grok-style mobile chat target while remaining consistent with the chemistry course visual system.

#### Scenario: Root assistant fills available phone space
- **WHEN** the `AI` root renders at 360px to 430px CSS-pixel phone widths
- **THEN** the assistant canvas MUST occupy the available route width and height without appearing as a floating card
- **AND** the `/ai` root MUST NOT render the normal fixed root-page `StudentAppHeader` above the assistant canvas
- **AND** the route content and root assistant panel MUST begin at the top of the student page frame while still respecting safe-area and bottom-navigation constraints
- **AND** the chat composer MUST remain above the bottom navigation with visible separation.

#### Scenario: Root assistant top identity is lightweight
- **WHEN** the root assistant first screen renders
- **THEN** the top identity area MUST render as a minimal chat-app title bar centered on `AI 学习助手` or an equivalent student-facing assistant name
- **AND** the history and new-chat actions MUST appear as compact icon-only actions near the top-right of the chat canvas and inline with the title row
- **AND** those actions MUST blend into the assistant canvas background rather than appearing as framed cards
- **AND** the root top identity MUST NOT show the previous `课程 AI` label, duplicated context title, global-course description, or explanatory summary block
- **AND** the identity area MUST NOT become a framed intro card.

#### Scenario: Context description is not duplicated on root
- **WHEN** the root assistant first screen renders with no messages
- **THEN** the page MUST NOT show a separate fixed header or descriptive intro section above the empty chat canvas
- **AND** any first-screen starter copy MUST be limited to the low prompt block near the composer.

#### Scenario: Student starts a new root chat
- **WHEN** the student activates the root top-bar new-chat action
- **THEN** the root chat shell MUST clear the visible conversation turns and composer state
- **AND** it MUST return to the default global `learning_home` assistant context
- **AND** it MUST NOT delete existing local history entries.

#### Scenario: Unsupported controls are absent
- **WHEN** the root assistant composer renders
- **THEN** the composer MUST expose only supported text-entry and send controls
- **AND** it MUST NOT show upload, attachment, model picker, microphone, voice waveform, image generation, or external X/Grok controls.

#### Scenario: Send action is embedded in composer
- **WHEN** the root assistant composer renders
- **THEN** the send action MUST sit visually inside the composer container rather than as a separate external button beside it
- **AND** the composer MUST still expose a clear text input area and one supported send action.

### Requirement: Root AI chat history entry
The student H5 AI root SHALL provide a history entry point for reviewing prior student AI conversations from the AI root page.

#### Scenario: Student opens history from AI root
- **WHEN** an authenticated student opens the `/ai` root route
- **THEN** the page MUST show a student-readable history action in the root chat top area
- **AND** activating the action MUST open a history list, panel, or sheet without leaving the AI root route.

#### Scenario: Contextual chat omits history entry
- **WHEN** a student opens the contextual `/ai/chat` detail route from another page
- **THEN** the contextual chat page MUST NOT show the root history action
- **AND** history review MUST remain reachable by returning to the `/ai` root route.

### Requirement: First-round local conversation history
The student H5 AI chat SHALL persist first-round conversation history in client-side browser storage without requiring a backend chat-session migration.

#### Scenario: Root chat is saved
- **WHEN** a student sends a question from the `/ai` root chat shell
- **THEN** the app MUST create or update a local history entry for that conversation
- **AND** the entry MUST include enough information to restore visible user and assistant turns.

#### Scenario: Contextual chat is saved without exposing local history chrome
- **WHEN** a student sends a question from `/ai/chat`
- **THEN** the app MAY save the contextual conversation into the same local history store
- **AND** the contextual page MUST still omit the root history action.

#### Scenario: Student restores a local history entry
- **WHEN** a student selects a history entry from the `/ai` root history list
- **THEN** the root chat shell MUST restore the saved conversation turns
- **AND** follow-up questions MUST send recent restored turns as `conversation_history`.

#### Scenario: No local history exists
- **WHEN** the student opens the history panel and no local conversations are available
- **THEN** the app MUST show an empty state that explains there are no recent AI conversations
- **AND** the student MUST be able to return to the root chat composer.

### Requirement: History rows identify context
The student H5 AI history SHALL identify whether a conversation was global or contextual without exposing teacher/admin diagnostics.

#### Scenario: History row comes from global root chat
- **WHEN** a history entry was created from the `/ai` root route
- **THEN** the row MUST label it as a global course assistant conversation or equivalent student-facing copy.

#### Scenario: History row comes from contextual chat
- **WHEN** a history entry was created from a point, chapter, video result, or assessment context
- **THEN** the row MUST show a concise context title or context type cue
- **AND** it MUST NOT expose raw RAG traces, policy codes, internal node diagnostics, or admin-only metadata.
