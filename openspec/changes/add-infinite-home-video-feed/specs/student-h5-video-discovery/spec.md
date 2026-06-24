## MODIFIED Requirements

### Requirement: Student home video feed API
The backend SHALL provide an authenticated student home video feed API that returns paged, playable, catalog-backed experiment video cards for the student H5 home root.

#### Scenario: Student requests the home video feed
- **WHEN** an authenticated student requests the home video feed
- **THEN** the response MUST include feed items with stable point placement identity, canonical point identity, chapter identity, student-visible title, summary or snippet, catalog path, display badges, video resource paths, and a point-detail route target
- **AND** each feed item MUST expose enough media data for inline preview, including stream path, optional thumbnail path, and optional duration
- **AND** each feed item MUST expose whether the current student has saved the item for `稍后学习`
- **AND** each feed item SHOULD expose whether the current student has favorited the item when that state is needed for visible controls
- **AND** the response MUST include the resolved feed topic, a nullable opaque next cursor, whether more items are available, the requested batch size, the candidate pool size, and the active repeat mode

#### Scenario: Student requests a paged batch
- **WHEN** an authenticated student requests `/api/student/home-video-feed` with `topic`, `limit`, and an optional cursor
- **THEN** the backend MUST return at most the bounded limit of items for that topic
- **AND** the cursor MUST be treated as an opaque value by clients
- **AND** the backend MUST reject, ignore, or recover from stale or invalid cursors in a controlled way without exposing cursor internals to the client
- **AND** a cursor from one topic MUST NOT be used to continue a different topic stream

#### Scenario: Feed item instance identity is returned
- **WHEN** the feed API returns any item
- **THEN** the item MUST include a stable canonical item id for the catalog placement and media asset
- **AND** the item MUST include an instance id that is unique for that rendered occurrence in the current feed stream
- **AND** repeated appearances of the same canonical video MUST use distinct instance ids
- **AND** navigation and point-detail routing MUST continue to use the existing point, placement, canonical point, media, and route target identities rather than the instance id

#### Scenario: Discover topic repeats as an infinite stream
- **WHEN** the resolved topic is `发现` and at least one playable candidate exists
- **THEN** the feed API MUST allow repeated canonical videos across batches
- **AND** the response MUST provide a next cursor for continuing the stream
- **AND** repeated items MUST remain catalog-backed and student-visible
- **AND** the backend SHOULD avoid immediate repeats when the candidate pool is large enough to do so

#### Scenario: Finite topic reaches the end
- **WHEN** the resolved topic is `稍后学习`, `全部`, or an experiment-observation topic and all matching playable candidates have already been returned for the current stream
- **THEN** the feed API MUST return no next cursor
- **AND** it MUST report that no more items are available
- **AND** it MUST NOT repeat canonical videos merely to keep that finite topic scrolling

#### Scenario: Watch-later topic returns personal saved videos
- **WHEN** the resolved topic is `稍后学习`
- **THEN** the feed API MUST return only playable videos that the current student has actively saved for later learning
- **AND** the topic MUST be finite and non-repeating
- **AND** hidden, unpublished, archived, or unplayable saved videos MUST be omitted from the visible feed
- **AND** the ordering MUST be stable and SHOULD show newest saved items first

#### Scenario: Feed filters hidden or unplayable content
- **WHEN** catalog points, point content, ancestor directories, media bindings, or media assets are draft, unpublished, archived, unready, or otherwise hidden from students
- **THEN** the feed API MUST NOT include those items
- **AND** the feed MUST include only point placements with at least one published playable video

#### Scenario: Feed has no playable videos
- **WHEN** no published playable experiment videos are available
- **THEN** the API MUST return an empty item list with a controlled empty status or message
- **AND** the frontend MUST render an educational empty state rather than falling back to unrelated home action cards

#### Scenario: Topic recall does not own playback data
- **WHEN** Elasticsearch or another retrieval index is used to find candidate point ids for a home topic
- **THEN** the home feed API MUST still hydrate stream paths, thumbnail paths, media ids, duration, route targets, titles, and catalog context from catalog and media data
- **AND** the student video-library search document MUST NOT become the playback data contract for the home feed

### Requirement: Home discovery header owns recommendation topic rail
The student H5 home video discovery surface SHALL render its home video topic rail as header-attached chrome above the video feed, with `发现` as the default selected topic.

#### Scenario: Student opens home video discovery
- **WHEN** an authenticated student opens the home root
- **THEN** the page MUST show a horizontally scrollable home video topic rail attached to the home header
- **AND** the `发现` topic MUST be selected by default
- **AND** the rail MUST be visually styled as part of the home title/header system rather than as a separate content card

#### Scenario: Home rail uses experiment video topic taxonomy
- **WHEN** the home topic rail is rendered
- **THEN** the rail MUST use labels that describe discovery intent, experiment-observation phenomena, experiment operations, or video-viewing intent
- **AND** the initial label set MUST include `发现`, `稍后学习`, `全部`, `颜色变化`, `沉淀生成`, `气体生成`, `分层萃取`, `褪色漂白`, `发光火焰`, `温度变化`, `加热反应`, `试纸检验`, `指示剂`, and `晶体析出`
- **AND** the rail MUST NOT include knowledge taxonomy labels such as `卤素`, `酸碱`, or `氧化还原`
- **AND** the rail MUST NOT include `最新` unless a future change defines freshness ranking and upload-time semantics for student-visible experiment videos

#### Scenario: Student changes topic selection
- **WHEN** the student taps a topic in the home rail
- **THEN** the tapped topic MUST become the visible active topic
- **AND** the home feed MUST reset to the first batch for that topic
- **AND** any pending cursor from the previous topic MUST NOT be reused for the newly selected topic

#### Scenario: Home feed starts below attached header rail
- **WHEN** home feed items are rendered below the recommendation rail
- **THEN** the first feed item MUST align directly under the header area with only the configured header/feed spacing
- **AND** unrelated background bands, hero cards, or explanatory title cards MUST NOT appear between the recommendation rail and the video stream

#### Scenario: Home overflow preserves current header chrome
- **WHEN** the student opens a home feed card overflow menu while the home header and topic rail are visible
- **THEN** the overflow menu MUST open without causing the home header unit to compress or disappear
- **AND** scroll or visual-viewport events caused by opening the menu MUST NOT be treated as downward feed-scroll intent while the menu remains open
- **AND** the overflow backdrop MUST NOT visually cover the visible home header unit with a blank or dimmed band
- **AND** if the home header unit was already compressed before opening the menu, the menu MUST preserve that compressed state until it closes

#### Scenario: Home search remains video-library entry
- **WHEN** the student activates the home search affordance from the home header
- **THEN** the app MUST open the second-level video-library route with home source context
- **AND** the home recommendation rail MUST NOT replace the video-library page's query input, search results, browse chips, or grouped result behavior

## ADDED Requirements

### Requirement: Student can save home videos for later learning
The student H5 video discovery flow SHALL provide durable student-owned watch-later state for playable video items.

#### Scenario: Student saves a video for later learning
- **WHEN** a student chooses the `稍后学习` action for a home video item or point video detail item
- **THEN** the backend MUST persist an active watch-later save for the current student, point placement, canonical point, and media asset
- **AND** repeating the same save action MUST be idempotent rather than creating duplicate active saves
- **AND** the frontend MUST update the item's visible personal state without requiring a full home feed reload

#### Scenario: Student removes a video from later learning
- **WHEN** a student removes a previously saved video from `稍后学习`
- **THEN** the backend MUST deactivate or archive the active watch-later save for that student and item
- **AND** the item MUST no longer appear in the student's `稍后学习` topic after refresh or local state update
- **AND** the operation MUST NOT delete or modify the underlying catalog point, media asset, or home feed candidate

#### Scenario: Watch-later is distinct from favorites
- **WHEN** the system stores or displays `稍后学习` state
- **THEN** it MUST treat the state as a watch-later queue rather than as a long-term favorite or bookmark
- **AND** it MUST NOT make the item appear in `我的-收藏` unless the student also favorites the item

#### Scenario: Saved item becomes hidden
- **WHEN** a video saved for later learning later becomes unpublished, archived, hidden from students, or unplayable
- **THEN** the save record MAY remain stored for audit or recovery
- **AND** the item MUST NOT be returned in the visible `稍后学习` feed while it is not student-visible and playable

### Requirement: Student can favorite videos for profile collection
The student H5 video discovery flow SHALL provide durable student-owned favorite state for long-term video collection under `我的-收藏`.

#### Scenario: Student favorites a point video
- **WHEN** a student chooses the `收藏` action on a point video detail page
- **THEN** the backend MUST persist an active favorite save for the current student, point placement, canonical point, and media asset
- **AND** repeating the same favorite action MUST be idempotent rather than creating duplicate active favorites
- **AND** the point detail action MUST reflect the saved state as `已收藏`

#### Scenario: Student unfavorites a point video
- **WHEN** a student cancels `收藏` for a previously favorited point video
- **THEN** the backend MUST deactivate or archive the active favorite save for that student and item
- **AND** the item MUST no longer appear in the student's `我的-收藏` collection after refresh or local state update
- **AND** the operation MUST NOT delete or modify the underlying catalog point, media asset, watch-later save, or home feed candidate

#### Scenario: Favorites are distinct from watch-later
- **WHEN** the system stores or displays `收藏` state
- **THEN** it MUST treat the state as a long-term favorite collection rather than as the home `稍后学习` queue
- **AND** favoriting an item MUST NOT make it appear in the home `稍后学习` topic unless the student also saves it for later learning

#### Scenario: Student opens My favorites
- **WHEN** a student opens the `我的-收藏` collection from the profile area
- **THEN** the app MUST show the current student's active favorite playable videos as a finite, non-repeating list
- **AND** the list MUST use the same student-visible catalog/media filters as home feed hydration
- **AND** hidden, unpublished, archived, or unplayable favorites MUST be omitted from the visible playable collection

### Requirement: Home video feed loads paged batches
The student H5 home page SHALL append home video feed batches as the student scrolls while preserving the root page's window-level scroll behavior.

#### Scenario: Student scrolls near the end of the feed
- **WHEN** the student scrolls near the bottom sentinel of the home video feed and the current topic has more items
- **THEN** the frontend MUST request the next home feed batch using the latest next cursor
- **AND** it MUST append the returned items to the existing feed items for the same topic
- **AND** it MUST prevent concurrent duplicate load-more requests for the same cursor

#### Scenario: Initial topic batch loads
- **WHEN** the student opens home or switches to a new topic
- **THEN** the frontend MUST request the first batch for the active topic without reusing an old topic cursor
- **AND** it MUST show initial loading, empty, or error states separately from incremental loading states

#### Scenario: Finite topic is exhausted
- **WHEN** the active topic returns no next cursor after at least one item has been rendered
- **THEN** the frontend MUST stop issuing automatic load-more requests for that topic
- **AND** it MAY show a small end-of-list marker
- **AND** it MUST NOT show the zero-results empty state merely because a finite topic reached its end

#### Scenario: Topic has no matches
- **WHEN** the active topic returns an empty item list for its first batch
- **THEN** the frontend MUST render a controlled empty state for that topic below the header rail
- **AND** it MUST keep the selected topic visible and changeable in the header rail

#### Scenario: Repeated videos remain autoplay safe
- **WHEN** the same canonical video appears multiple times in the home feed
- **THEN** the frontend MUST use the item instance id for React keys, DOM feed ids, IntersectionObserver registration, and active autoplay state
- **AND** it MUST use canonical point and media identities only for navigation, route context, and item content

#### Scenario: Window remains the scroll container
- **WHEN** home feed batches are appended
- **THEN** the app MUST preserve window-level scrolling for the home root
- **AND** header/topic-rail compression and bottom navigation compression MUST continue to respond to page scrolling
- **AND** the feed MUST NOT be moved into an internal scroll container solely to implement load more

### Requirement: Home video auto-preview selects a stable visible card
The student H5 home page SHALL keep inline video auto-preview tied to one stable visible feed card instead of relying solely on bottom-sentinel or per-card observer callbacks.

#### Scenario: First visible card previews before observer callbacks
- **WHEN** the home feed has rendered at least one playable card and no observer callback has selected an active card yet
- **THEN** the frontend MUST select a visible rendered item, falling back to the first rendered feed item when no geometry measurement is available
- **AND** the selected card MUST render the active muted preview state instead of the inactive `滑到此处自动预览` prompt

#### Scenario: Active preview uses effective playable viewport
- **WHEN** the frontend ranks visible home video cards for preview ownership
- **THEN** it MUST calculate visibility against the playable viewport that excludes fixed home header/topic rail chrome and bottom navigation chrome
- **AND** it MUST prefer cards with meaningful visible height, stronger visible ratio, and closer distance to the playable viewport center

#### Scenario: Scroll updates active preview without changing scroll container
- **WHEN** the student scrolls the window-level home feed between video cards
- **THEN** the frontend MUST recalculate the active preview from registered card geometry
- **AND** it MUST keep the home root on window-level scrolling rather than introducing an internal feed scroll container for preview selection

#### Scenario: Active preview does not flap
- **WHEN** the current active card remains meaningfully visible while scroll, resize, visual-viewport, or observer events arrive
- **THEN** the frontend MUST keep that card active unless another visible card clearly ranks ahead of it
- **AND** it MUST NOT repeatedly clear and reselect the same active card in a way that causes unnecessary pause/play loops

#### Scenario: Preview identity follows rendered instances
- **WHEN** repeated canonical videos appear in the home feed
- **THEN** active preview selection MUST continue to use the item instance id for registration, ranking, and active state
- **AND** selecting one rendered occurrence MUST NOT activate or pause another occurrence of the same canonical video

### Requirement: Home video cards use inactive progress chrome
The student H5 home video feed SHALL render video-card media chrome as a lightweight inactive progress surface rather than a full player control surface.

#### Scenario: Home card omits preview status text
- **WHEN** a home video card is rendered in either active or inactive preview state
- **THEN** the media layer MUST NOT display `滑到此处自动预览`
- **AND** it MUST NOT display `静音预览`
- **AND** it MUST NOT display a lower-right duration capsule

#### Scenario: Home card shows inactive progress strip
- **WHEN** a home video card is rendered
- **THEN** it MUST show a bottom-aligned inactive progress strip with track, loaded, and played segments
- **AND** the strip MUST use the same progress color tokens as the second-level point video player
- **AND** it MUST NOT show the second-level active progress thumb or SYSU logo marker
- **AND** it MUST NOT expose drag or seek behavior from the home feed card

#### Scenario: Home card remains muted
- **WHEN** the active home video preview plays inline
- **THEN** it MUST remain muted
- **AND** the media layer MUST NOT provide a mute or unmute control on the home card
- **AND** the student MUST open the second-level point video page for full playback controls

#### Scenario: Point player progress colors are shared across states
- **WHEN** the second-level point video player switches between inactive and active chrome states
- **THEN** inactive and active progress bars MUST use the same track, loaded, and played color semantics
- **AND** the active state MUST differ by showing the expanded hit area and SYSU logo thumb rather than by changing progress colors
