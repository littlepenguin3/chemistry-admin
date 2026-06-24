## Why

The student H5 home page now looks like a video discovery surface, but its feed is still a one-shot finite list and the header topic rail is only visual state. This change makes the home video feed behave like a real mobile discovery stream while preserving the chemistry-learning boundary between home browsing, catalog navigation, and search.

## What Changes

- Add cursor-based batching to the student home video feed API so the home page can append feed batches as the student scrolls.
- Make `发现` the default home topic and the only topic that behaves as an infinite discovery stream with controlled repeats.
- Add a personal `稍后学习` topic backed by durable student save-later state.
- Make `稍后学习`, `全部`, and experiment-observation topic filters finite, non-repeating streams that can reach an end state.
- Add durable `收藏` state for point video detail actions and the `我的-收藏` collection, distinct from `稍后学习`.
- Replace the current placeholder topic labels with chemistry experiment video labels based on observable phenomena or viewing intent, not chapter, element-family, or knowledge taxonomy labels.
- Add a per-rendered-item instance identity so repeated videos can safely appear in an infinite stream without React key, autoplay, or IntersectionObserver collisions.
- Keep Elasticsearch optional for future candidate recall, while defining the home feed contract around playable catalog-backed video items hydrated by the home feed API.
- Define `稍后学习` as the home-rail watch-later queue and `收藏` as the long-term profile collection behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `student-h5-video-discovery`: Defines the real home video feed pagination contract, finite versus infinite topic behavior, topic taxonomy boundaries, and frontend infinite-load behavior.

## Impact

- Backend:
  - `server/app/api/student/student_home_feed.py`
  - `server/app/domains/student_home_feed.py`
  - `server/app/student_home_feed_schemas.py`
  - A migration and domain/API path for student video save-later state
  - Related tests under `server/tests/test_student_home_feed.py`
- Frontend:
  - `apps/web-student/src/api.ts`
  - `apps/web-student/src/routes/home/HomeRootPage.tsx`
  - `apps/web-student/src/app/shell/AuthenticatedAppLayout.tsx`
  - `apps/web-student/src/features/catalog/CatalogPointDetailPanel.tsx`
  - `apps/web-student/src/routes/profile/ProfileRootPage.tsx`
  - Related app shell, home feed, and e2e tests.
- API:
  - `GET /api/student/home-video-feed` gains topic and cursor semantics while remaining catalog-backed and student-authenticated.
  - Student video save/remove endpoints support watch-later and favorite save types through a focused student video-save API.
- Search:
  - Elasticsearch may later supply candidate pools for topic recall, but it is not required for the MVP infinite feed and MUST NOT become the playback media source contract.
