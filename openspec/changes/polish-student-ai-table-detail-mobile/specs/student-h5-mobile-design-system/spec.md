## ADDED Requirements

### Requirement: Mobile table viewers use touch-safe detail surfaces
The student H5 mobile design system SHALL provide table detail surfaces that fit phone viewports and support touch interaction without conflicting with app shell safe areas.

#### Scenario: Table detail renders on common phone widths
- **WHEN** a student opens an AI table detail view at 360px, 390px, or 430px viewport width
- **THEN** the page MUST keep all navigation, table controls, and detail content inside the visible mobile canvas
- **AND** it MUST NOT create page-level horizontal overflow.

#### Scenario: Table detail uses safe touch controls
- **WHEN** the table detail view renders action controls such as back, zoom, fit, reset, or row close
- **THEN** each interactive control MUST have a touch target suitable for mobile use
- **AND** controls MUST remain visually aligned with the Atom student mobile style.

#### Scenario: Detail page coexists with app chrome
- **WHEN** the AI table detail route is active
- **THEN** the detail content MUST respect top and bottom safe areas
- **AND** the bottom navigation MUST NOT cover the table reader, row reader, or zoom controls.

### Requirement: Mobile table viewers communicate overflow without permanent scrollbar chrome
The student H5 mobile design system SHALL make table overflow discoverable while preserving a polished mobile visual style.

#### Scenario: Table content extends beyond the visible area
- **WHEN** a table has offscreen columns or rows inside the detail viewer
- **THEN** the surface MUST provide visual overflow affordances such as edge fades, shadows, peeking content, or control state
- **AND** the surface MUST allow the student to reach the hidden content through touch interaction.

#### Scenario: Scrollbars are visually hidden
- **WHEN** scrollbar chrome is hidden for table polish
- **THEN** horizontal and vertical scrolling or panning MUST remain functional
- **AND** tests or QA checks MUST verify that hidden scrollbars do not disable table exploration.

#### Scenario: Small table detail opens
- **WHEN** the table has only a few rows or columns
- **THEN** the detail surface MUST size to the useful content instead of stretching into a large empty grid
- **AND** the page MUST avoid a blank lower panel that makes the viewer feel unfinished.

### Requirement: Mobile table viewers support readable learning density
The student H5 mobile design system SHALL render dense AI table content in a way that supports both comparison and focused reading.

#### Scenario: Table cells contain long Chinese text
- **WHEN** a table cell contains long Chinese explanations, experiment observations, or judgment text
- **THEN** the viewer MUST wrap and space text so it remains readable in row reading mode
- **AND** it MUST avoid clipping important words behind fixed columns, controls, or page edges.

#### Scenario: Table cells contain formulas
- **WHEN** a table cell contains math or mhchem formula output
- **THEN** the viewer MUST keep formula content readable in the row reading surface
- **AND** formulas MUST NOT overlap adjacent labels, controls, or cells.

#### Scenario: Table visual style is rendered
- **WHEN** an AI table detail page is displayed
- **THEN** the table surface MUST use lightweight grid lines, subtle header treatment, and restrained spacing
- **AND** it MUST NOT resemble a heavy admin data grid or spreadsheet editor.

### Requirement: Mobile table viewer QA covers AI rich table interactions
The student H5 mobile design system SHALL include verification coverage for AI table detail interactions and mobile layout.

#### Scenario: Automated or scripted viewport QA runs
- **WHEN** mobile viewport QA is run for the student H5 app
- **THEN** it MUST include an AI-generated wide chemistry table artifact at 360px, 390px, and 430px widths
- **AND** it MUST verify that the page has no document-level horizontal overflow.

#### Scenario: Interaction QA runs
- **WHEN** interaction QA is performed for the AI table detail viewer
- **THEN** it MUST cover opening the detail view, panning or scrolling the table, using zoom controls, opening a row reader, closing the row reader, and returning to chat
- **AND** it MUST verify that the bottom app chrome does not obscure the active table interaction.
