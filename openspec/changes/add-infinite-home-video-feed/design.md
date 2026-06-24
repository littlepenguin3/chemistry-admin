## Context

The student H5 home page currently presents a Bilibili-like experiment video stream under a SYSU header and horizontal topic rail. The backend endpoint `GET /api/student/home-video-feed` accepts only `limit` and returns a finite list from catalog-backed playable video points. The frontend requests that endpoint once on `/home` mount, stores the response as a single feed object, and uses `item.id` as the React key, DOM `data-feed-id`, and active autoplay identifier.

The current topic rail is hard-coded in the authenticated shell and only changes local visual active state. It contains mixed labels such as `推荐`, `全部`, `最新`, `颜色变化`, `沉淀`, `气体`, `分层`, `褪色`, `火焰`, `放热`, `卤素`, `酸碱`, and `氧化还原`. That mix blurs three different concepts:

- discovery intent (`推荐`, `全部`);
- observable experiment phenomena (`颜色变化`, `沉淀`, `气体`, `分层`, `褪色`);
- chemistry knowledge taxonomy (`卤素`, `酸碱`, `氧化还原`).

The desired product model is now clearer: the home rail is not a course-directory selector and not a free-form search shortcut. It is a lightweight video discovery filter plus one personal learning queue. `发现` is the default algorithmic stream and can repeat content to create an infinite browsing experience. `稍后学习`, `全部`, and phenomenon filters are finite collections that can reach the end.

The current home overflow menu already shows `稍后学习`, and the point detail page already shows a visible `收藏` utility action plus a `稍后学习` entry inside the more sheet. Code inspection shows both are local UI state or feedback only. There is no existing backend watch-later, favorite, bookmark, or saved-video persistence. This change should therefore introduce a real student-owned video save model rather than pretending either action is already durable.

## Goals / Non-Goals

**Goals:**

- Provide a real batched home feed API with opaque cursor pagination.
- Support an infinite `发现` stream even when the playable video pool is small by allowing controlled repeats.
- Support finite `稍后学习`, `全部`, and experiment-observation topic streams that do not repeat items and can show an end state.
- Add durable student watch-later persistence for home video cards and point detail more menus.
- Add durable student favorite persistence for point detail `收藏` and the future `我的-收藏` collection.
- Replace the placeholder topic list with labels grounded in experiment video observation or viewing intent.
- Keep home feed playback data owned by the home feed API, not by the video-library search result document.
- Preserve window-level scrolling so the existing header/topic-rail and bottom navigation compression behavior continues to work.
- Keep autoplay stable when repeated canonical videos appear in the stream.
- Keep home auto-preview stable for the currently visible video card, even when browser observer callbacks are delayed or do not fire in tests.

**Non-Goals:**

- Do not build a full recommendation-ranking system, broad user-personalization model, or engagement-counter system.
- Do not build folders, notes, social counters, or advanced favorite-library management for favorites.
- Do not require Elasticsearch for the initial infinite-feed implementation.
- Do not turn the home topic rail into chapter navigation, element-family navigation, or a knowledge taxonomy filter.
- Do not make second-level video-library search inherit home-feed autoplay behavior.
- Do not add virtualized list infrastructure in the MVP unless performance testing proves it is required immediately.

## Decisions

### 1. Use an opaque cursor contract for home feed batching

The backend should extend `GET /api/student/home-video-feed` with:

```http
GET /api/student/home-video-feed?topic=discover&limit=20&cursor=<opaque>
```

The response should include the requested topic, items, a nullable `next_cursor`, and metadata that lets the frontend distinguish loading more from reaching the end:

```ts
{
  status: "ok" | "empty",
  message: string,
  topic: "discover" | "all" | "color_change" | "...",
  items: StudentHomeVideoFeedItem[],
  next_cursor: string | null,
  has_more: boolean,
  batch_size: number,
  pool_size: number,
  repeat_mode: "cycled" | "none"
}
```

The cursor should be opaque to the frontend. A practical server-side payload can be base64url JSON containing `version`, `topic`, `seed`, `offset`, `cycle`, `pool_hash`, and `issued_at`. The frontend must only pass it back.

Alternative considered: page numbers. Rejected because page numbers do not encode shuffle seed, topic identity, or repeat cycle; they make repeated discovery streams unstable when the candidate pool changes.

### 2. Separate canonical item identity from rendered feed instance identity

Current home cards use `item.id` for React keys, IntersectionObserver registration, and autoplay active state. That is safe only while every video appears once. Infinite discovery with repeats needs two identities:

- `id`: stable canonical identity for the catalog placement and media asset, e.g. `home-video:<placement_node_id>:<media_id>`.
- `instance_id`: unique identity for this rendered occurrence in the feed, e.g. `home-feed:<topic>:<seed>:<cycle>:<offset>:<canonical-id-hash>`.

The frontend should use `instance_id` for React keys, `data-feed-id`, active preview state, and DOM observer maps. It should keep `id`, point ids, and route target fields for navigation and analytics context.

Alternative considered: make the frontend synthesize keys from array index. Rejected because it couples identity to append order, is fragile after retries or topic resets, and hides the backend repeat semantics from tests.

### 3. Make `发现` the only infinite repeating stream

`发现` is the default topic and behaves like a discovery feed:

- if the playable pool is non-empty, `has_more` remains true;
- repeated canonical videos are allowed across batches;
- immediate repeats should be avoided when the pool size allows it;
- if the pool is smaller than the batch size, repeating within a batch is acceptable for demo continuity but should still use unique `instance_id` values.

The server can implement this as a deterministic ring:

```text
candidate pool -> stable score -> seed shuffle -> slice by offset
                                       |
                                       +-- when exhausted, increment cycle and reshuffle/rotate
```

This produces a stable browsing session without pretending that the database has more unique videos than it actually has.

Alternative considered: duplicate the frontend array locally. Rejected because it breaks server ownership of topic/filter semantics, makes analytics impossible to reason about, and still has key/autoplay identity problems.

### 4. Use typed student video saves for `稍后学习` and `收藏`

`稍后学习` should be the second topic after `发现`. It is not the same concept as `收藏`:

- `稍后学习`: a short-term personal queue of videos the student intends to watch or revisit soon.
- `收藏`: a long-term bookmark/favorite collection that belongs under `我的-收藏`.

Because no backend favorite/bookmark/watch-later model exists today, this change should introduce a small student-owned save table with typed save behavior:

```text
student_video_saves
  id
  student_id
  save_type          -- watch_later or favorite
  placement_node_id
  canonical_point_id
  media_asset_id
  source             -- home_feed, point_detail, etc.
  created_at
  updated_at
  archived_at/null
```

The active uniqueness rule should be one active row per `(student_id, save_type, placement_node_id, media_asset_id)`. `placement_node_id` is preserved because the same canonical point can appear in a specific catalog context, and home feed navigation depends on placement context. `canonical_point_id` is stored for future consolidation and analytics.

The backend should expose an idempotent save/remove API for both save types. A practical shape is:

```http
PUT /api/student/video-saves/{save_type}
DELETE /api/student/video-saves/{save_type}
```

where `save_type` is `watch_later` or `favorite`, with `placement_node_id` and `media_id` in the request payload or query parameters. The save operation should return the updated personal state for that item. Removing should archive or deactivate the save row rather than physically deleting audit context.

Home feed and point detail payloads should include a small personal state object where the UI needs to render saved state:

```ts
personal_state: {
  watch_later: boolean,
  watch_later_saved_at?: string | null,
  favorite: boolean,
  favorite_saved_at?: string | null
}
```

The `稍后学习` topic should return `watch_later` saved playable videos for the current student, newest saved first, without repeats. If a saved item later becomes hidden, unpublished, or unplayable, it should be omitted from the visible watch-later feed while the save row may remain for audit/recovery.

`收藏` should not create a home rail topic. It should power the point detail `收藏/已收藏` button and the `我的-收藏` entry/list. The profile collection should be finite, non-repeating, and ordered by favorite saved time. It can use the same item hydration rules as the home feed so that hidden or unplayable favorites are not shown as playable cards.

Alternative considered: treat `稍后学习` as `收藏`. Rejected because the product language and user intent differ. Watch-later is a queue surfaced in the home rail; favorites/bookmarks are a long-term collection surfaced under `我的`. Using a typed save table keeps the implementation small while keeping the product model clean.

### 5. Make `全部` and observation topics finite non-repeating streams

`全部` returns every eligible playable video once according to the home feed ordering. Observation topics such as `颜色变化` or `沉淀生成` return only matching eligible videos once. These streams use cursor pagination but do not cycle. When exhausted, `has_more` is false and `next_cursor` is null.

The frontend should show a small non-card end marker for finite topics once the user reaches the end, not an error and not an educational empty state. Empty state is reserved for zero matching items.

Alternative considered: make every topic infinite by repeating. Rejected because filtered topics feel like deliberate result sets; repeating them hides the fact that the student has seen all matching experiments and makes small pools feel fake.

### 6. Use experiment-video topic taxonomy, not knowledge taxonomy

The first topic set should be:

```text
发现
稍后学习
全部
颜色变化
沉淀生成
气体生成
分层萃取
褪色漂白
发光火焰
温度变化
加热反应
试纸检验
指示剂
晶体析出
```

Labels such as `最新`, `卤素`, `酸碱`, and `氧化还原` should be removed from the home rail:

- `最新` is not meaningful unless there is real content freshness and operations around upload time.
- `卤素` is an element-family or chapter concept and belongs to catalog/search.
- `酸碱` and `氧化还原` are knowledge/property categories and belong to search, learning context, or catalog navigation.

The backend should map topic ids to controlled matching terms across structured fields already used by search/indexing, such as `reaction_features`, `condition_tags`, `phenomenon_tags`, and `property_tags`. These are matching aids, not displayed as strict synonyms.

Alternative considered: use the visible label directly as an Elasticsearch query. Rejected because home topics need stable product semantics, while search query parsing is intentionally broad and exploratory.

`稍后学习` appears in the rail because it is a personal video-discovery queue, but it should be backed by `watch_later` save state rather than by phenomenon matching. `收藏` does not appear in this rail because it belongs to `我的-收藏`.

### 7. Keep Elasticsearch optional for candidate recall

The MVP home feed can use PostgreSQL/catalog data only. Elasticsearch may be added later to recall candidate point ids for observation topics, but the home feed API must still hydrate playable media fields, route targets, and student-visible text from catalog/media data.

This preserves the existing boundary: video-library search documents can help retrieve learning points, but they should not become the contract for inline playback media.

### 8. Frontend loads more with a bottom sentinel

`HomeRootPage` should keep the window as the scroll container. It should append batches by observing a bottom sentinel near the end of the feed:

```text
home opens or topic changes
  -> request first batch(topic, limit)
  -> render items
  -> sentinel approaches viewport
  -> request next batch(topic, cursor)
  -> append items
```

State should distinguish initial loading, incremental loading, empty, exhausted, and error:

- `loadingInitial`
- `loadingMore`
- `items`
- `nextCursor`
- `hasMore`
- `topic`
- `error`

Changing topic resets items, cursor, active preview state, overflow sheet state, and scroll/load state for the new topic. Saving a video to `稍后学习` from the overflow menu should update the item's personal state in the current feed without requiring a full feed reload. If the active topic is `稍后学习`, removing an item from watch-later should remove it from the visible list or refresh the current batch. Toggling `收藏` on point detail should update favorite state and make the item appear or disappear from `我的-收藏`.

Alternative considered: put the feed inside an internal scroll container. Rejected because the existing shell header/topic rail and bottom navigation compression depends on window-level scroll.

### 9. Use geometry-backed active preview selection

The home feed has two separate viewport behaviors:

- bottom sentinel observation loads more feed batches;
- active preview selection decides which visible card owns the inline muted video.

These should remain separate. The active preview state should not depend only on an `IntersectionObserver` callback, because observer delivery can lag, be skipped in test environments, or fire before fixed chrome and visual viewport geometry settle. When that happens, every card can fall back to the inactive `滑到此处自动预览` state even though a card is visibly centered in the feed.

`HomeRootPage` should maintain a registered DOM node map keyed by `instance_id` and compute the active preview from real card geometry. The candidate ranking should use the effective playable viewport, excluding the fixed home header/topic rail and bottom navigation chrome. Each visible card receives a score from:

- visible height inside the playable viewport;
- visible ratio against the card height;
- distance from the playable viewport center.

The highest ranked visible card becomes active. If no measurement has completed yet but feed items already exist, the first rendered item can become the initial active card so the page never starts with every visible video inactive.

To avoid repeated pause/play loops, active selection should use hysteresis: keep the current active card while it remains meaningfully visible, and switch only when another card clearly wins the visible-area/center ranking. Recalculation should be scheduled with `requestAnimationFrame` from card registration changes, `IntersectionObserver` callbacks, window scroll/resize/orientation events, and `visualViewport` scroll/resize events.

This preserves the YouTube-like behavior that the visible card simply starts previewing as the student browses, without requiring a tap and without letting repeated canonical videos collide with each other.

Alternative considered: let each card start and pause itself from its own observer callback. Rejected because it creates competing local playback decisions, makes repeated cards harder to reason about, and can produce all-inactive states or repeated pause calls for the same visible video.

### 10. Keep home video chrome in the inactive player language

The home feed video card should feel like a lightweight browsing surface, not a full player. Its media layer should therefore use the same inactive progress-bar language as the second-level point video page:

- no text badge for `滑到此处自动预览` or `静音预览`;
- no duration capsule in the lower-right corner;
- a bottom-aligned 2px progress strip with `track`, `loaded`, and `played` segments;
- no draggable thumb or school-logo marker on home cards;
- no mute/unmute control on home cards; home previews remain muted by default.

The second-level point video player still has two chrome states: inactive and active. Their progress colors should use the same semantic tokens. The active state differs only by exposing the larger hit area, controls, and SYSU logo thumb. Inactive state keeps the same `track`, `loaded`, and `played` colors but hides the thumb.

Home cards always use the inactive progress shape, even when the card is the active auto-preview owner. The active home card may update the played/loaded widths from the video element, but it must not grow into the second-level active control rail, show the SYSU thumb, or expose sound controls.

Alternative considered: keep separate active/inactive progress colors. Rejected because it makes the active transition feel like a different component; the intended distinction is capability, not color.

## Risks / Trade-offs

- [Risk] The demo has too few playable videos, so `发现` may visibly repeat quickly. -> Mitigation: use seeded shuffle, avoid immediate repeats where possible, and make only `发现` repeat.
- [Risk] Students may confuse `稍后学习` with `收藏`. -> Mitigation: implement separate `save_type=watch_later` and `save_type=favorite` states, surface watch-later in the home rail, and surface favorites under `我的`.
- [Risk] Saved videos can become unpublished or unplayable. -> Mitigation: watch-later feed hydrates through the same student-visible catalog/media filters and omits hidden items.
- [Risk] Infinite append grows the DOM over very long browsing sessions. -> Mitigation: keep only active card as a video element and leave virtualization as a follow-up if profiling shows mobile jank.
- [Risk] Reusing canonical `id` for repeated cards causes autoplay and key collisions. -> Mitigation: add required `instance_id` and use it for rendering and observer identity.
- [Risk] Browser observer callbacks can lag or fail to fire before first paint, leaving every visible home card inactive. -> Mitigation: use geometry-backed active preview selection with first-item fallback and hysteresis.
- [Risk] Home video cards become too much like a full player if they show time, text status, sound controls, or a draggable thumb. -> Mitigation: keep home chrome to the inactive progress strip only.
- [Risk] Topic tags drift into course taxonomy again. -> Mitigation: specify that home rail labels must describe experiment observation, operation, or browsing intent; knowledge categories stay in search/catalog.
- [Risk] Candidate pool changes between cursor requests. -> Mitigation: include a pool hash or cursor version, and recover by starting a new batch sequence for the same topic if the cursor cannot be honored.
- [Risk] Elasticsearch integration tempts the implementation to fetch playback data from search documents. -> Mitigation: specs require home feed API hydration from catalog/media fields.
