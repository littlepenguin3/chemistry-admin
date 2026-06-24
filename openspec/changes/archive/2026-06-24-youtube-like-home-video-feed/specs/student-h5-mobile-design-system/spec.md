## MODIFIED Requirements

### Requirement: Mobile home feed preserves horizontal video clarity
The student H5 mobile design system SHALL support compact horizontal 16:9 home video cards that remain clear, aligned, and usable on phone viewports without requiring a visible per-card action row.

#### Scenario: Home feed renders on common phone widths
- **WHEN** the home video feed is viewed at common phone widths from 360px to 430px CSS pixels
- **THEN** video cards MUST fit the viewport without horizontal scrolling
- **AND** title, compact metadata, tags, media controls, and bottom navigation MUST NOT overlap
- **AND** the card surface and page background MUST use the app's theme solid surfaces for the video feed presentation
- **AND** the card surface MUST NOT leak the default paper grid background through the video card text area or under the bottom navigation

#### Scenario: Home video card stays compact on common phone widths
- **WHEN** a home video card is viewed at common phone widths from 360px to 430px CSS pixels
- **THEN** the title MUST be prominent and protected to at most two visual lines
- **AND** compact metadata or tags after the title MUST remain on a controlled row or otherwise truncate without pushing the card into a dense detail layout
- **AND** the card MUST NOT render a large description block or visible action toolbar on the home feed
- **AND** the card body height MUST remain stable enough that a stream of cards reads as a browse feed rather than as stacked detail panels

#### Scenario: Video card loads before playback
- **WHEN** a feed card is not active or video metadata is still loading
- **THEN** the card MUST preserve a stable 16:9 media box
- **AND** poster, loading, fallback states, compact tags, or media overlay states MUST NOT shift the surrounding feed layout

#### Scenario: Feed reaches bottom navigation
- **WHEN** the student scrolls near the bottom of the home feed
- **THEN** the final card content MUST remain readable above the app bottom navigation and safe-area inset
- **AND** the bottom navigation MUST not obscure visible home feed content
- **AND** the home route MUST continue using window-level scrolling so the existing scroll-driven header and bottom navigation compression can hide and restore correctly

## ADDED Requirements

### Requirement: Point video detail action row owns video tools
The student H5 mobile design system SHALL place point-specific video tools on the second-level point video detail page rather than on home feed cards.

#### Scenario: Detail action row renders on common phone widths
- **WHEN** the point video detail page is viewed at 360px, 390px, or 430px CSS-pixel widths
- **THEN** the detail action row MUST fit without horizontal page scrolling
- **AND** Atom, favorite or bookmark, share, assessment or completion, and overflow actions supported by the product MUST keep stable touch targets and accessible names
- **AND** the Atom control MUST remain visually identifiable as the product assistant action without pushing adjacent tools out of view

#### Scenario: Detail actions do not conflict with player chrome
- **WHEN** the point video detail page renders a playable video
- **THEN** the action row MUST sit outside the video player overlay and below the player/title context
- **AND** the player overlay MUST remain responsible only for player-owned controls such as return, play or pause, progress, time feedback, settings, and fullscreen
- **AND** opening, focusing, or tapping detail actions MUST NOT reveal unrelated player chrome as a side effect

#### Scenario: Detail actions respect mobile safe areas
- **WHEN** the student uses point detail actions near the bottom of a phone viewport
- **THEN** action rows, popovers, drawers, and overflow menus MUST remain readable above safe-area insets and route-level chrome
- **AND** the detail page MUST avoid overlapping action targets with the app bottom navigation when the detail route displays root navigation

#### Scenario: Home scroll chrome remains window-driven
- **WHEN** the home video feed is redesigned to compact browse cards
- **THEN** the implementation MUST NOT replace root home document scrolling with an internal `.student-route-content` scroller
- **AND** downward home scrolling MUST still apply the shell's compressed navigation state
- **AND** the header, top tab bar when present, and bottom navigation MUST still move according to the existing root scroll behavior
