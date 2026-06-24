## MODIFIED Requirements

### Requirement: Mobile detail routes support rich-content inspection
The student H5 mobile design system SHALL support second-level rich-content inspection pages for AI-generated learning artifacts without breaking phone route, safe-area, or bottom-navigation behavior.

#### Scenario: Rich-content detail route opens on a phone viewport
- **WHEN** a student opens an AI table or Mermaid detail view at 360px to 430px CSS-pixel phone widths
- **THEN** the detail view MUST fit within the phone viewport width
- **AND** it MUST avoid page-level horizontal scrolling
- **AND** it MUST keep back/navigation controls reachable.

#### Scenario: Bottom navigation would conflict
- **WHEN** an AI rich-content detail route is active
- **THEN** the authenticated bottom navigation MUST be hidden or otherwise prevented from intercepting touches
- **AND** the viewer content MUST account for bottom safe-area insets and browser chrome.

#### Scenario: Detail controls are shown
- **WHEN** a rich-content detail view shows close, back, zoom, fit, reset, font-size, or scroll controls
- **THEN** each control MUST have a phone-appropriate hit area
- **AND** controls MUST have visible focus states and accessible names
- **AND** controls MUST not overlap artifact content in a way that prevents reading or dragging.

### Requirement: Mobile pan and scroll surfaces preserve gesture ownership
The student H5 mobile design system SHALL allow nested pan/zoom and table-scroll surfaces while preserving predictable route and page gestures.

#### Scenario: Diagram viewer handles pan and zoom
- **WHEN** a student drags or pinches inside an AI Mermaid detail viewer
- **THEN** the gesture MAY be captured by the viewer to inspect the diagram
- **AND** the gesture capture MUST be scoped to the diagram interaction region
- **AND** exiting the detail view MUST restore normal page scrolling and navigation behavior.

#### Scenario: Table viewer handles scrolling
- **WHEN** a student scrolls inside an AI table detail viewer
- **THEN** horizontal and vertical table scrolling MUST remain available
- **AND** hidden scrollbar styling MUST NOT disable native touch, pointer, wheel, keyboard, or programmatic scrolling
- **AND** the route itself MUST not acquire accidental page-level horizontal overflow.

#### Scenario: Viewer is embedded in desktop preview
- **WHEN** the student H5 app is viewed inside a desktop teacher preview or iframe
- **THEN** rich-content detail viewers SHOULD keep phone-canvas scrollbar chrome visually quiet
- **AND** hiding scrollbar chrome MUST be scoped to the viewer surface rather than disabling global document scrolling.

### Requirement: Mobile QA covers AI rich-content viewers
The student H5 mobile design system SHALL include repeatable QA evidence for AI rich-content table and Mermaid viewers.

#### Scenario: Rich-content mobile QA runs
- **WHEN** implementation tasks for AI rich-content viewing are completed
- **THEN** QA MUST cover 360x780, 390x844, and 430x932 CSS-pixel viewports where practical
- **AND** QA MUST include at least one wide chemistry comparison table
- **AND** QA MUST include at least one tall or wide Mermaid chemistry flowchart
- **AND** QA MUST verify no page-level horizontal overflow, reachable controls, readable artifact content, and correct back navigation.

#### Scenario: Reduced-motion QA runs
- **WHEN** mobile QA or focused tests cover the Mermaid pan/zoom viewer
- **THEN** reduced-motion behavior MUST be checked through CSS or browser emulation where practical
- **AND** the viewer MUST remain usable without relying on animated transitions.
