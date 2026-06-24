## MODIFIED Requirements

### Requirement: Home renders horizontal experiment video cards
The student H5 home root SHALL render the experiment video feed as a single-column, Bilibili-like mobile video card stream that is optimized for browsing and entry, not for completing per-card tool actions.

#### Scenario: Student opens home with feed items
- **WHEN** a student opens `/home` and feed items exist
- **THEN** the page MUST render each item as a 16:9 video preview or poster card
- **AND** the card MUST visually prioritize the experiment video as the dominant card element
- **AND** the card MUST render the experiment title as the first text content below the media
- **AND** the title MUST be left-aligned without a channel avatar, circular learning icon, or synthetic creator identity
- **AND** the title MUST be visually smaller and quieter than a second-level point-detail heading
- **AND** the title MUST be protected to at most two visual lines on supported phone widths
- **AND** the card MUST show compact learning metadata derived from the feed item after the title
- **AND** the metadata MUST render as subdued text in one visual row using `A · B · C` style separators when multiple metadata parts exist
- **AND** the metadata MUST NOT render as green pill chips, category buttons, or other visually primary controls
- **AND** the card MUST NOT render a visible per-card action toolbar, `查看实验` CTA, Atom chip, like button, bookmark button, share button, or social counter controls on the home feed
- **AND** the card MAY render exactly one vertical-more overflow trigger beside the title or title block
- **AND** the card MUST NOT render as a vertical Shorts player or a two-column thumbnail grid

#### Scenario: Feed card preserves textbook context
- **WHEN** a feed card is displayed
- **THEN** the card MUST preserve chapter or catalog context derived from the published point placement through the subdued metadata row
- **AND** source text after the primary title, including chapter labels, reaction labels, chemistry equation labels, reagent labels, or catalog section labels, MUST be eligible to appear as metadata row parts
- **AND** metadata parts MUST be de-duplicated where practical and MUST avoid repeating the primary title
- **AND** the metadata row MUST be protected to one visual line with truncation or ellipsis on supported phone widths
- **AND** the card MUST NOT show the catalog path as the first text line above the title
- **AND** tapping the media area, title area, metadata row, or non-overflow card body MUST route to the point video detail page rather than to a generic video-only player
- **AND** tapping the overflow trigger MUST open the home video overflow menu rather than routing to point detail

#### Scenario: Home keeps root tab identity
- **WHEN** the student is viewing the home video feed
- **THEN** the bottom navigation MUST continue to identify `首页` as the active root tab
- **AND** the feed MUST leave safe space for the bottom navigation on phone viewports
- **AND** opening or closing a home video overflow menu MUST NOT change the active root tab identity
- **AND** the home feed MUST preserve the root page's window-level scroll behavior so header and bottom navigation compression still responds to page scrolling

### Requirement: Feed actions stay learning-oriented
The student H5 video discovery flow SHALL route home feed cards to learning destinations while keeping visible point-specific tools on the second-level point video detail page and limiting home-card actions to one low-frequency overflow menu.

#### Scenario: Student opens a feed item
- **WHEN** the student taps the media area, title, metadata row, or other non-overflow body area on a feed item
- **THEN** the app MUST navigate to the existing point video detail route with `from=home` or equivalent source context
- **AND** returning MUST preserve normal route-stack behavior

#### Scenario: Home feed omits inline action toolbar
- **WHEN** a home feed card is rendered
- **THEN** the card footer MUST NOT render a visible action row
- **AND** the card MUST NOT render `查看实验` as a separate CTA
- **AND** the card MUST NOT render visible home-feed toolbar controls for like, favorite or bookmark, share, Atom, assessment, or point completion
- **AND** the card MAY render one vertical-more overflow trigger as a menu entry point
- **AND** the overflow trigger MUST NOT be accompanied by sibling visible tool icons that recreate a toolbar
- **AND** inline preview affordances such as muted-preview status, duration, progress, or playback state MUST remain scoped to the media area

#### Scenario: Home overflow menu presents low-frequency choices
- **WHEN** the student taps a home feed card's overflow trigger
- **THEN** the app MUST present a mobile menu or sheet for low-frequency feed choices
- **AND** the menu MAY include actions such as save-later, share, not-interested, report, feedback, or open-detail
- **AND** the menu MUST NOT include Atom, assessment, quiz, point-completion, comment, creator-channel, follower, or entertainment-ranking actions
- **AND** selecting or dismissing the menu MUST NOT also trigger the underlying card's point-detail navigation unless the selected menu item is explicitly an open-detail action
- **AND** unavailable persistence-backed actions MUST either be omitted or behave as controlled local UI feedback without implying a completed backend mutation

#### Scenario: Point detail page owns video actions
- **WHEN** the student opens a feed item from home
- **THEN** the point video detail page MUST provide the point-specific action surface for Atom, favorite or bookmark, share, assessment or completion entry points, and overflow actions that are supported by the current product
- **AND** any like or lightweight positive feedback action supported by the current product MUST appear on the point detail page rather than as a visible home feed toolbar control
- **AND** these actions MUST use the selected point placement identity and canonical point identity from the opened feed item

#### Scenario: Student asks Atom from a feed item
- **WHEN** the student opens a feed item and chooses the Atom action on the point video detail page
- **THEN** the app MUST open Atom chat with the item title, catalog path or chapter context, point identity, and summary context
- **AND** the Atom action MUST NOT change the active root tab identity as a side effect

#### Scenario: Feed card excludes per-card search action
- **WHEN** a home feed card is rendered
- **THEN** the card MUST NOT render a visible `搜索相关` action or another per-card query-launching search action
- **AND** experiment-video search MUST remain owned by the home header/video-library entry and the second-level video-library search page

#### Scenario: Feed avoids required entertainment chrome
- **WHEN** the home feed is rendered
- **THEN** the feed MUST NOT require likes, comments, creator channels, follower counts, or generic social engagement controls to complete the learning flow
- **AND** any low-frequency save, share, report, feedback, not-interested, or open-detail behavior available from the home overflow menu MUST NOT introduce counters, creator/channel dependencies, or ranking behavior unless a future spec defines those behaviors
- **AND** visible learning actions on the detail page MUST prioritize point detail, experiment learning, and Atom explanation over entertainment-style engagement
