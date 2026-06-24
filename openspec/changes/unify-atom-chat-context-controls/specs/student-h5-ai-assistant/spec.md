## ADDED Requirements

### Requirement: Atom detail route supports full conversation controls
The student H5 Atom assistant SHALL expose the same core Atom conversation controls on the focused `/ai/chat` detail route that it exposes on the `/ai` root route, while preserving detail-route navigation semantics.

#### Scenario: Student opens focused Atom detail chat
- **WHEN** a student opens `/ai/chat` from a point, video, chapter, assessment, history handoff, or future supported learning scene
- **THEN** the page MUST render a modern Atom conversation surface rather than the legacy contextual assistant card layout
- **AND** the page MUST expose supported Atom controls for local history, new chat, free-form asking, send, and context selection.

#### Scenario: Detail chat keeps route role
- **WHEN** `/ai/chat` renders with full Atom controls
- **THEN** the route MUST remain a second-level detail route
- **AND** the bottom navigation MUST remain hidden
- **AND** source-aware back behavior MUST continue to return to the opening source.

#### Scenario: Detail chat does not duplicate old context cards
- **WHEN** `/ai/chat` has an active or seeded context
- **THEN** the context MUST be represented through the Atom composer context chip or equivalent modern Atom binding affordance
- **AND** the page MUST NOT also render the old standalone "current context" card as a parallel context surface.

### Requirement: Atom route seed becomes editable context binding
The student H5 Atom assistant SHALL treat a contextual route seed as an editable initial context before the first submitted user turn.

#### Scenario: Detail route opens with contextKey
- **WHEN** `/ai/chat` opens with a valid `contextKey`
- **THEN** the resolved `AssistantContext` MUST seed the current Atom chat's context chip
- **AND** the student MUST be able to ask immediately using that seeded context.

#### Scenario: Seeded context is editable before first send
- **WHEN** a seeded context is visible and the chat has no submitted user message
- **THEN** the student MUST be able to remove or replace the seeded context
- **AND** replacing the context MUST update the context used for the first submitted question.

#### Scenario: Restored history overrides route seed
- **WHEN** the student restores a local Atom history entry while on `/ai/chat`
- **THEN** the restored history entry's saved context MUST become the active chat context
- **AND** the original route seed MUST NOT overwrite the restored context until the student starts a new chat.

#### Scenario: New chat reseeds from current route when available
- **WHEN** the student activates new chat from `/ai/chat`
- **THEN** visible turns, draft text, loading state, generated suggestions, and active local history id MUST be cleared
- **AND** if the route still has a valid opening context seed, the fresh chat SHOULD show that seed as an editable context chip
- **AND** if no valid route seed exists, the fresh chat MUST use the default global Atom context.

### Requirement: Atom context binding locks after first user turn
The student H5 Atom assistant SHALL enforce one bound context per chat after the first submitted user message across root and focused detail entry points.

#### Scenario: Selected context before first send
- **WHEN** the current Atom chat has a selected context and no submitted user message
- **THEN** the context chip MUST communicate the selected learning background
- **AND** the chip MUST allow removal or replacement before submission.

#### Scenario: Selected context after first send
- **WHEN** the current Atom chat has submitted at least one user message with a selected context
- **THEN** the context chip MUST communicate that the chat is bound to that context
- **AND** the app MUST NOT silently replace or remove that bound context inside the same chat
- **AND** the student MUST start a new chat before binding a different context.

#### Scenario: Global chat remains valid
- **WHEN** the student submits from an Atom chat without selecting a context
- **THEN** the assistant request MUST use the current global or restored context
- **AND** the UI MUST NOT require context selection before asking.

### Requirement: Atom first-turn context prompts are separate from follow-up prompts
The student H5 Atom assistant SHALL use context-start prompts for selected-context empty chats and keep them distinct from model-generated post-answer follow-up prompts.

#### Scenario: Empty selected-context chat shows start prompts
- **WHEN** an Atom chat has a selected experiment or point context
- **AND** no user message has been submitted
- **THEN** the app SHOULD show compact first-turn prompt options tied to that context
- **AND** those prompts SHOULD include student-facing directions such as observation, phenomenon explanation, principle, design reason, comparison, or common mistakes.

#### Scenario: Start prompt is selected
- **WHEN** the student activates a first-turn context prompt
- **THEN** the app MUST submit a concrete question using the currently selected context
- **AND** the selected context MUST become locked for that chat after submission.

#### Scenario: Post-answer suggestions remain latest-turn metadata
- **WHEN** a successful assistant turn returns sanitized `suggested_prompts`
- **THEN** those prompts MUST remain post-answer next-turn suggestions
- **AND** they MUST NOT be confused with the empty-chat context-start prompt stack.

## MODIFIED Requirements

### Requirement: Root AI chat history entry
The student H5 AI root and focused Atom detail routes SHALL provide a history entry point for reviewing prior student AI conversations without requiring backend chat-session storage.

#### Scenario: Student opens history from AI root
- **WHEN** an authenticated student opens the `/ai` root route
- **THEN** the page MUST show a student-readable history action in the Atom chat top area
- **AND** activating the action MUST open a history list, panel, or sheet without leaving the AI root route.

#### Scenario: Student opens history from focused detail chat
- **WHEN** a student opens the contextual `/ai/chat` detail route
- **THEN** the page MUST show the same student-readable Atom history action
- **AND** activating the action MUST open the local Atom history list without promoting the route into the `/ai` root tab.

#### Scenario: Student restores history on either Atom route
- **WHEN** the student selects a local history entry from the Atom history list on `/ai` or `/ai/chat`
- **THEN** the current Atom surface MUST restore the saved conversation turns and saved active context
- **AND** follow-up questions MUST send recent restored turns as `conversation_history`.

### Requirement: First-round local conversation history
The student H5 AI chat SHALL persist first-round conversation history in client-side browser storage without requiring a backend chat-session migration.

#### Scenario: Root chat is saved
- **WHEN** a student sends a question from the `/ai` root chat shell
- **THEN** the app MUST create or update a local history entry for that conversation
- **AND** the entry MUST include enough information to restore visible user and assistant turns.

#### Scenario: Contextual detail chat is saved and restorable
- **WHEN** a student sends a question from `/ai/chat`
- **THEN** the app MUST create or update a local history entry in the same Atom history store
- **AND** the entry MUST include enough saved context to restore the context chip, visible turns, and follow-up request behavior.

#### Scenario: Student restores a local history entry
- **WHEN** a student selects a history entry from the Atom history list
- **THEN** the current Atom chat shell MUST restore the saved conversation turns
- **AND** follow-up questions MUST send recent restored turns as `conversation_history`.

#### Scenario: No local history exists
- **WHEN** the student opens the history panel and no local conversations are available
- **THEN** the app MUST show an empty state that explains there are no recent AI conversations
- **AND** the student MUST be able to return to the current Atom composer.
