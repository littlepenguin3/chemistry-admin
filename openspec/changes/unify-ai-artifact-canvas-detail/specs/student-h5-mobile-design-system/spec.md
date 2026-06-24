## ADDED Requirements

### Requirement: AI artifact canvas uses an infinite-grid workspace
The student H5 mobile design system SHALL support an AI artifact detail canvas pattern where the grid is the workspace itself and artifacts are placed directly on that workspace.

#### Scenario: Canvas detail page renders
- **WHEN** an AI artifact detail page renders at 360px, 390px, or 430px CSS-pixel phone widths
- **THEN** the page MUST show a continuous grid workspace across the available detail viewport
- **AND** the workspace MUST read as the primary surface rather than as decorative wallpaper behind a card
- **AND** the artifact MUST be visually placed on the grid.

#### Scenario: Canvas-native artifact avoids nested card styling
- **WHEN** a canvas-native artifact such as a Mermaid flowchart renders in the AI artifact detail page
- **THEN** the artifact area MUST NOT use an inner card, rounded rectangle panel, framed preview box, opaque page strip, or duplicated background surface as its primary container
- **AND** the grid workspace MUST remain visible around and behind the artifact wherever artifact transparency allows.

#### Scenario: Table artifact needs local readability
- **WHEN** a table artifact renders in the AI artifact detail canvas
- **THEN** the table MAY use local cell fills, header tint, and hairline borders for readability
- **AND** those table treatments MUST remain bounded to the table object itself
- **AND** the page MUST NOT add a large table-card background that hides the surrounding canvas grid.

### Requirement: AI artifact canvas chrome floats above the workspace
The student H5 mobile design system SHALL layer artifact detail navigation and controls as floating chrome above the canvas workspace rather than as content inside the transformed artifact.

#### Scenario: Header overlays the canvas
- **WHEN** the AI artifact canvas page shows a back action, title, or secondary label
- **THEN** those controls MUST float above the workspace layer
- **AND** any readability veil MUST fade over the real grid workspace instead of painting an opaque or mismatched header background.

#### Scenario: Tool controls remain reachable
- **WHEN** the artifact canvas page shows zoom, fit, reset, or artifact-specific controls
- **THEN** the controls MUST stay outside the transformed artifact layer
- **AND** the controls MUST respect phone safe areas, rounded screen corners, and the hidden-bottom-navigation detail-route layout
- **AND** the controls MUST provide accessible names and visible focus states.

#### Scenario: Canvas content passes under chrome
- **WHEN** the student pans or zooms an artifact near the top or side of the detail page
- **THEN** the artifact and grid MUST remain visually continuous beneath translucent chrome
- **AND** the chrome MUST NOT create a hard opaque strip that makes the canvas appear cut off.

### Requirement: AI artifact canvas gestures are mobile-safe
The student H5 mobile design system SHALL make AI artifact canvas pan and zoom interactions touch-friendly without creating page-level overflow or trapping the student in the canvas.

#### Scenario: Student pans or zooms an artifact
- **WHEN** the student drags, pinches, or uses explicit controls inside an AI artifact canvas detail page
- **THEN** the artifact transform MUST stay scoped to the canvas workspace
- **AND** the document MUST NOT gain horizontal page overflow
- **AND** floating back and reset controls MUST remain reachable.

#### Scenario: Reduced motion is enabled
- **WHEN** the browser or device indicates reduced motion preferences
- **THEN** nonessential canvas transform animations MUST be disabled or shortened
- **AND** pan, zoom, fit, reset, and back navigation MUST remain functional.

#### Scenario: Mobile QA verifies canvas behavior
- **WHEN** mobile viewport QA runs for the student AI artifact canvas change
- **THEN** it MUST cover at least one Mermaid flowchart artifact and one Markdown table artifact at 360px, 390px, and 430px widths
- **AND** it MUST verify visible grid workspace, reachable controls, hidden bottom navigation, no page-level horizontal overflow, and absence of the previous inner artifact card for Mermaid detail.
