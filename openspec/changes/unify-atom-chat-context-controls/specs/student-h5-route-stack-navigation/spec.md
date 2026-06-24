## ADDED Requirements

### Requirement: AI chat detail is a focused Atom route
The authenticated student H5 route stack SHALL keep `/ai/chat` as a non-tab detail route while allowing it to render the full Atom conversation feature set.

#### Scenario: Focused Atom detail opens from a learning source
- **WHEN** a student opens AI chat from the home root, learn root, point detail, chapter detail, element detail, video result, assessment report, or another supported learning scene
- **THEN** the app MUST render `/ai/chat` as a focused Atom detail route
- **AND** the page MAY expose Atom history, new chat, context selection, and modern composer controls
- **AND** exposing those controls MUST NOT change the active root tab identity.

#### Scenario: Focused Atom detail keeps hidden navigation
- **WHEN** `/ai/chat` renders with full Atom controls, history open, picker open, keyboard focus, restored history, or a new empty chat
- **THEN** the bottom navigation MUST remain hidden
- **AND** detail-route scroll or keyboard behavior MUST NOT reintroduce the root bottom navigation.

#### Scenario: Focused Atom detail preserves source-aware return
- **WHEN** the student uses the visible back affordance, browser back, Android/WebView back, or equivalent route-stack return from `/ai/chat`
- **THEN** the app MUST return according to the opening source route
- **AND** restoring a history entry or replacing the Atom context inside `/ai/chat` MUST NOT replace source-aware return with a fixed `/ai` root destination.

#### Scenario: History restore stays inside current route
- **WHEN** the student opens local Atom history from `/ai/chat`
- **AND** selects any available Atom history entry
- **THEN** the conversation MUST restore inside the current focused detail route
- **AND** the route MUST NOT navigate to `/ai` solely because the restored entry originated from the root assistant.
