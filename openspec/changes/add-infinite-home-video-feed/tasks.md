## 1. API Contract And Types

- [x] 1.1 Extend `StudentHomeVideoFeedItem` backend schema with `instance_id` while preserving the existing canonical `id` and route target fields.
- [x] 1.2 Extend `StudentHomeVideoFeedItem` backend schema with `personal_state.watch_later` and optional watch-later saved timestamp.
- [x] 1.3 Extend `StudentHomeVideoFeedResponse` backend schema with `topic`, `next_cursor`, `has_more`, `batch_size`, `pool_size`, and `repeat_mode`.
- [x] 1.4 Add student video save request/response schemas for idempotent watch-later and favorite save/remove operations.
- [x] 1.5 Extend the student home feed route to accept `topic`, `limit`, and optional opaque `cursor` query parameters with safe bounds and controlled invalid-cursor behavior.
- [x] 1.6 Add focused student video save/remove API routes for `watch_later` and `favorite`.
- [x] 1.7 Update `apps/web-student/src/api.ts` home feed TypeScript types and `getStudentHomeVideoFeed` helper to pass topic and cursor parameters.
- [x] 1.8 Add frontend API helpers for saving and removing watch-later and favorite state.

## 2. Backend Feed Generation

- [x] 2.1 Add a migration for typed student video save state with active uniqueness for `(student_id, save_type, placement_node_id, media_asset_id)`.
- [x] 2.2 Implement idempotent watch-later and favorite save/remove domain functions that preserve catalog/media records and deactivate saves instead of hard-deleting them.
- [x] 2.3 Refactor the existing home feed SQL/domain path so it can fetch the full eligible playable candidate pool for a topic before slicing a batch.
- [x] 2.4 Add a controlled topic registry with stable ids and labels for `发现`, `稍后学习`, `全部`, `颜色变化`, `沉淀生成`, `气体生成`, `分层萃取`, `褪色漂白`, `发光火焰`, `温度变化`, `加热反应`, `试纸检验`, `指示剂`, and `晶体析出`.
- [x] 2.5 Map observation topic ids to structured matching fields or text signals already available from catalog/search extraction, without treating topic labels as strict chemistry synonyms.
- [x] 2.6 Implement opaque cursor encode/decode with version, topic, seed, offset, cycle, pool hash, and issued-at data.
- [x] 2.7 Implement `发现` as a deterministic repeating stream with seeded ordering, unique `instance_id` values, and next cursor continuation while candidates exist.
- [x] 2.8 Implement `稍后学习` as a current-student finite non-repeating stream ordered by saved time and hydrated through the same student-visible playable filters.
- [x] 2.9 Implement `全部` and observation topics as finite non-repeating streams that return no next cursor once their matching candidate pool is exhausted.
- [x] 2.10 Keep playback media, thumbnails, durations, route targets, titles, and catalog context hydrated from catalog/media data even if a future retrieval layer supplies candidate ids.
- [x] 2.11 Preserve existing hidden/unpublished/unready media filters for every topic and every cursor batch.
- [x] 2.12 Attach per-item watch-later and favorite personal state to relevant home feed and point detail responses for the current student.
- [x] 2.13 Add a finite current-student favorite collection read path for `我的-收藏`, ordered by favorite saved time and hydrated through student-visible playable filters.

## 3. Frontend Topic Rail

- [x] 3.1 Replace the hard-coded home topic labels in the authenticated shell with the finalized discovery/watch-later/observation label set and make `发现` the default active topic.
- [x] 3.2 Remove `最新`, `卤素`, `酸碱`, and `氧化还原` from the home rail.
- [x] 3.3 Expose the active home topic id and setter from the shell to `HomeRootPage` through an existing shell context or a focused home video topic context.
- [x] 3.4 Ensure tapping a topic updates active visual state, resets the feed state, and starts a first-batch request for that topic.
- [x] 3.5 Preserve the existing header-attached topic rail styling, horizontal scroll behavior, and home header compression behavior.
- [x] 3.6 Preserve the current home header compression state while a home card overflow sheet is open.

## 4. Frontend Infinite Feed

- [x] 4.1 Replace the single `feed` response state in `HomeRootPage` with explicit `items`, `nextCursor`, `hasMore`, `loadingInitial`, `loadingMore`, `error`, and active topic state.
- [x] 4.2 Request the first home feed batch on home mount and whenever the active topic changes.
- [x] 4.3 Add a bottom sentinel using `IntersectionObserver` that loads the next batch when `hasMore` and `nextCursor` are available.
- [x] 4.4 Prevent duplicate concurrent load-more requests for the same cursor and ignore stale responses after topic changes or unmount.
- [x] 4.5 Append load-more results for the same topic while replacing items on topic reset.
- [x] 4.6 Use `instance_id` for React keys, `data-feed-id`, `registerCard`, active preview state, and overflow item consistency checks.
- [x] 4.7 Continue using canonical point/media ids and route targets for navigation into point detail pages.
- [x] 4.8 Wire the home overflow `稍后学习` action to the watch-later save/remove API and update local item personal state.
- [x] 4.9 Wire the point detail `稍后学习` action to the watch-later save/remove API and update local item personal state.
- [x] 4.10 Wire the point detail `收藏` action to favorite save/remove API and keep its visual state distinct from watch-later state.
- [x] 4.11 Render `稍后学习` as a finite topic that reflects the current student's watch-later saved videos and supports removing items from that list.
- [x] 4.12 Render a controlled zero-match empty state for first-batch empty topics and a small end-of-list marker for exhausted finite topics.
- [x] 4.13 Keep the window as the home feed scroll container and avoid introducing an internal feed scroll container.
- [x] 4.14 Add geometry-backed active preview selection that ranks registered visible cards inside the effective playable viewport, keeps a first-item fallback, and uses hysteresis to avoid pause/play flapping.
- [x] 4.15 Replace home video preview text/time chrome with inactive-style progress chrome while keeping home previews muted.
- [x] 4.16 Share point-player active and inactive progress color semantics while keeping the SYSU thumb active-only.

## 5. Profile Favorites

- [x] 5.1 Add a `我的-收藏` entry to the profile root when favorite collection support is available.
- [x] 5.2 Render the current student's favorite playable videos as a finite collection list using catalog-backed video item cards or a compact profile-appropriate variant.
- [x] 5.3 Allow removing an item from `我的-收藏` without affecting watch-later state or catalog/media records.
- [x] 5.4 Show a controlled empty state when the student has no visible favorite videos.

## 6. Tests

- [x] 6.1 Add backend tests for response schema fields, cursor continuation, invalid cursor recovery, and bounded limits.
- [x] 6.2 Add backend tests proving `发现` can repeat canonical videos with unique instance ids when the pool is smaller than multiple requested batches.
- [x] 6.3 Add backend tests proving watch-later and favorite save/remove operations are idempotent, student-scoped, and independent.
- [x] 6.4 Add backend tests proving `稍后学习` returns only the current student's active watch-later saved playable videos without repeats.
- [x] 6.5 Add backend tests proving `我的-收藏` returns only the current student's active favorite playable videos without repeats.
- [x] 6.6 Add backend tests proving `全部` and observation topics do not repeat canonical videos and return no next cursor when exhausted.
- [x] 6.7 Add backend tests proving unpublished, archived, unready, or hidden catalog/media records remain excluded for every topic, including `稍后学习` and `我的-收藏`.
- [x] 6.8 Update frontend API and e2e tests to expect `发现` as the default topic and the new topic label set including `稍后学习`.
- [x] 6.9 Add frontend tests for topic switching resetting the feed and calling the API with the selected topic.
- [x] 6.10 Add frontend tests for sentinel-triggered load-more append behavior and no duplicate load-more calls while a request is in flight.
- [x] 6.11 Add frontend tests proving repeated canonical items render separately through distinct `instance_id` keys and active feed ids.
- [x] 6.12 Add frontend tests proving `稍后学习` actions call persistence APIs and update local watch-later state.
- [x] 6.13 Add frontend tests proving `收藏` actions call persistence APIs, update local favorite state, and do not modify watch-later state.

- [x] 6.14 Add a frontend regression test proving a visible home header stays visible when a home card overflow sheet opens.
- [x] 6.15 Add a frontend regression test proving a visible home video becomes active even when observer callbacks do not fire.
- [x] 6.16 Add frontend regression coverage for home video inactive progress chrome, removed preview text/time, and no home mute control.
- [x] 6.17 Add role-boundary coverage proving point-player progress colors are shared across inactive and active states while the thumb remains active-only.

## 7. Validation And Deployment

- [x] 7.1 Run focused backend tests for `server/tests/test_student_home_feed.py` and new student video save tests.
- [x] 7.2 Run focused frontend tests covering home feed, app shell topic rail, point detail actions, profile favorites, and video-library search regressions.
- [x] 7.3 Build `apps/web-student` and confirm the compiled bundle uses the new home feed and video-save API contracts.
- [x] 7.4 Copy or rebuild the latest student frontend assets into the Docker container used for student H5 preview.
- [x] 7.5 Manually verify in the phone preview that `发现` keeps loading, finite topics stop cleanly, repeated videos do not break autoplay, `稍后学习` and `收藏` stay distinct, and the header/topic rail still compresses smoothly.
- [x] 7.6 Run focused frontend home video tests, role-boundary tests, typecheck, production build, and redeploy the rebuilt student bundle into the preview container after stabilizing auto-preview activation.
- [x] 7.7 Run focused frontend tests, typecheck, production build, and redeploy the rebuilt student bundle into the preview container after the home video chrome update.
