## ADDED Requirements

### Requirement: Student H5 app configuration
The platform SHALL provide an authenticated student app configuration endpoint that exposes student-visible feature flags without exposing admin-only settings internals.

#### Scenario: Student loads app config
- **WHEN** an authenticated student requests the H5 app configuration
- **THEN** the response MUST include whether the AI assistant entry is visible
- **AND** it MUST include whether the feedback entry is visible
- **AND** it MUST include whether student AI capability is enabled

#### Scenario: Unauthenticated app config is rejected
- **WHEN** a request without a valid student token requests the H5 app configuration
- **THEN** the backend MUST reject the request using the normal student authentication rules

#### Scenario: H5 refreshes feature flags without WebSocket
- **WHEN** the student H5 app starts, regains focus, or changes major learning screens
- **THEN** it MUST refresh or reuse a recently refreshed app configuration
- **AND** it MUST hide AI or feedback entry points when the corresponding flag is disabled

### Requirement: Explicit student learning profile seed
The system SHALL keep display-facing family and element property facts in an explicit maintained seed resource instead of deriving H5 UI fields from RAG chunks at request time.

#### Scenario: Learning profile seed is validated
- **WHEN** production resource validation or test validation runs
- **THEN** every enabled student learning profile MUST include a chapter or family identifier, display title, summary, required property cards, and related property sections
- **AND** required property cards MUST cover atomic number, electron configuration, group, common valence, elemental state, and oxidizing/reducing tendency where applicable

#### Scenario: Backend loads profile facts
- **WHEN** the student learning API builds the H5 learning payload
- **THEN** it MUST read display facts from the explicit seed resource
- **AND** it MUST NOT depend on parsing canonical RAG chunk text to produce display facts

### Requirement: Real student learning page payload
The backend SHALL expose a student learning payload centered on a family or chapter profile and its related experiment points.

#### Scenario: Student opens learning page
- **WHEN** an authenticated student opens the H5 learning page
- **THEN** the backend MUST return a recommended or default learning profile
- **AND** the payload MUST include the profile's visible family/element properties
- **AND** it MUST include related experiment-point groups derived from published formal experiments

#### Scenario: Student selects a property section
- **WHEN** a student selects a property such as oxidizing property or reducing property
- **THEN** the H5 app MUST show experiment-point cards related to that property
- **AND** the cards MUST include experiment/point title, concise reaction or point summary when available, media availability, and question count

#### Scenario: No video exists for a point
- **WHEN** a related experiment point has no published video media
- **THEN** the H5 app MUST still show the point and its learning context
- **AND** it MUST render a graceful empty video state instead of failing navigation

### Requirement: Student H5 mobile-first WebView contract
The student learning surface SHALL be treated as a phone-first H5 / mini-program WebView experience, not as a desktop admin page or a shrunken desktop layout.

#### Scenario: Student opens H5 on a phone viewport
- **WHEN** the student H5 app is viewed at common phone widths from 360px to 430px CSS pixels
- **THEN** primary learning screens MUST fit the viewport without horizontal scrolling
- **AND** headings, cards, bottom navigation, floating feedback entry, chat entry, and action buttons MUST remain tappable and non-overlapping
- **AND** the layout MUST prioritize the phone flow: profile overview, property selection, related experiment points, point detail, chat, and feedback

#### Scenario: Student uses touch-only interaction
- **WHEN** a student uses the app without hover, precise mouse input, or desktop keyboard shortcuts
- **THEN** all required learning, chat, feedback, login, password-change, pretest-skip, and logout actions MUST be reachable through touch controls
- **AND** interactive controls SHOULD use phone-appropriate hit areas and spacing

#### Scenario: Desktop browser is used only for development preview
- **WHEN** a developer opens the student H5 app on a wide desktop browser
- **THEN** the app MAY center or constrain the phone layout for preview
- **BUT** it MUST NOT introduce desktop-only navigation, table-first layouts, hover-only affordances, or admin-console density into the student H5 experience

### Requirement: Student experiment point detail
The student H5 app SHALL provide a point detail experience that keeps video learning primary while showing compact explanation context.

#### Scenario: Student opens a point detail
- **WHEN** a student opens a related experiment point
- **THEN** the page MUST show the point title, parent experiment context, available video, observed phenomenon or summary, related reaction or principle when available, and safety/caution notes when available
- **AND** the app MUST preserve student learning event recording for post-learning behavior

#### Scenario: Point detail chat context is created
- **WHEN** a point detail page is open and AI assistant is enabled
- **THEN** the H5 app MUST pass chapter, experiment, point key or point title, and page summary context to student chat requests

### Requirement: Global authenticated H5 feedback
The student H5 app SHALL provide a global feedback entry for authenticated students when the feedback feature is enabled.

#### Scenario: Student submits feedback
- **WHEN** an authenticated student submits feedback from any H5 learning screen
- **THEN** the backend MUST create a feedback record using the authenticated student's identity
- **AND** it MUST capture feedback type, content, page path or screen, and available chapter/experiment/point context
- **AND** the feedback MUST appear in the existing admin feedback management workflow

#### Scenario: Feedback switch is disabled
- **WHEN** the admin feedback switch is disabled
- **THEN** the H5 app MUST hide the feedback entry after configuration refresh
- **AND** the backend MUST reject new student feedback submissions even if a stale client attempts one

#### Scenario: Client cannot spoof student identity
- **WHEN** a student feedback request includes client-supplied student or class identity in metadata
- **THEN** the backend MUST derive the authoritative student and class identity from the authenticated token
- **AND** it MUST NOT trust client-supplied identity fields
