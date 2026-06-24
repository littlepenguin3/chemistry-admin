## ADDED Requirements

### Requirement: Atom detail plus opens learning-background picker
The student H5 Atom assistant SHALL allow the focused `/ai/chat` composer to open the same learning-background picker used by the Atom root composer.

#### Scenario: Student opens picker from focused detail chat
- **WHEN** an authenticated student is on `/ai/chat`
- **AND** the current chat has no submitted user message or otherwise allows context replacement
- **AND** the student activates the composer context action
- **THEN** the app MUST open the learning-background picker as a bottom sheet inside the focused Atom page
- **AND** the app MUST NOT navigate to `/search`, `/video-library`, `/ai`, or any other route as part of opening the picker.

#### Scenario: Detail picker dismisses without selecting
- **WHEN** the learning-background picker is open on `/ai/chat`
- **AND** the student dismisses the sheet without choosing a point
- **THEN** the current Atom chat MUST keep the existing active context unchanged
- **AND** the composer MUST remain usable for free-form asking.

#### Scenario: Detail picker respects route chrome
- **WHEN** the learning-background picker opens on `/ai/chat`
- **THEN** the detail route MUST continue hiding the bottom navigation
- **AND** the picker MUST remain keyboard-safe and internally scrollable without covering the route's required back affordance or Atom identity area.

### Requirement: Picker initializes from current Atom context
The Atom learning-background picker SHALL make the current selected context visible when the picker is opened for replacement or review.

#### Scenario: Picker opens with selected point context
- **WHEN** the picker opens and the current Atom chat has a selected point context that can be represented in catalog or search data
- **THEN** the picker SHOULD navigate to or highlight the matching row
- **AND** the selected row SHOULD use a subtle Atom-green treatment that distinguishes it from ordinary rows.

#### Scenario: Current context is not present in loaded picker data
- **WHEN** the picker opens and the current selected context cannot be represented in the currently loaded catalog/search data
- **THEN** the picker MUST still render normally
- **AND** absence of a highlighted row MUST NOT clear or replace the current chat context.

## MODIFIED Requirements

### Requirement: Picker binds one point to current chat
The Atom learning-background picker SHALL bind at most one concrete point placement to the current Atom chat, whether the chat is on `/ai` or `/ai/chat`.

#### Scenario: Student selects a point
- **WHEN** the student selects a point from catalog mode or search mode
- **THEN** the picker MUST close
- **AND** the current Atom chat MUST receive an `AssistantContext` for that selected point
- **AND** the context MUST include the best available point title, summary, chapter identity, point placement identity, source node identity, experiment or canonical point identity, and catalog path.

#### Scenario: Student replaces selection before first send
- **WHEN** a point is selected but the current Atom chat has no submitted user message
- **AND** the student selects a different point through the picker
- **THEN** the current Atom chat MUST replace the previous selected point context with the new selected point context.

#### Scenario: Student attempts replacement after first send
- **WHEN** the current Atom chat has submitted at least one user message with a selected point context
- **THEN** the picker MUST NOT silently replace the bound point inside the same chat
- **AND** the UI MUST require starting a new chat before binding a different point.

#### Scenario: Student sends without selecting
- **WHEN** the student submits a question without selecting a point
- **THEN** the assistant request MUST continue to use the current global or restored active context
- **AND** the app MUST NOT require point selection before asking.

### Requirement: Bound point displays as learning-background chip
The Atom assistant SHALL display the selected point as an attachment-like learning-background chip near the composer across full-control Atom routes.

#### Scenario: Point selected before first send
- **WHEN** the current Atom chat has a selected point and no submitted user message
- **THEN** the composer area MUST show a visible selected-point chip
- **AND** the chip MUST include the selected point title and concise path or context cue when space allows
- **AND** the chip MUST expose remove or replace affordance.

#### Scenario: Bound chat has messages
- **WHEN** the current Atom chat has at least one submitted user message with a selected point context
- **THEN** the selected-point chip MUST remain visible as the chat's bound learning background
- **AND** the chip MUST no longer allow silently changing or removing the bound point inside the same chat.

#### Scenario: Student starts a new Atom chat
- **WHEN** the student activates the new-chat action from a full-control Atom route
- **THEN** the visible conversation, composer draft, active local history id, and selected-point binding MUST reset according to that route's initial context policy
- **AND** existing local history entries MUST remain available.
