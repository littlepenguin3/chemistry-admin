## Context

The student H5 home root currently renders experiment videos as full-width cards with a 16:9 preview, path/title/description/badges, and a dense action row. Recent visual work made the card background and typography cleaner, but the product direction has shifted: the home feed should feel closer to YouTube mobile, where each feed item is compact, fast to scan, and does not expose a full tool surface until the user opens the video.

Current relevant structure:

- `HomeRootPage.tsx` owns the home feed, active-card muted preview, card click navigation, and the current per-card actions.
- `CatalogPointDetailPanel.tsx` owns the second-level point video/detail page and already has `point-title-actions`.
- `PointVideoPlayer.tsx` owns YouTube-like player chrome for the second-level video player.
- The root home shell uses `window.scrollY` to add `nav-compressed`, which hides the fixed home header and bottom navigation on downward scroll.

Important constraint from the previous iteration: the home root MUST keep window-level scrolling for feed browsing. Moving the feed into an internal scroll container breaks the existing header/topic-rail/bottom-nav compression logic.

## Goals / Non-Goals

**Goals:**

- Make the home feed cards small, browse-first, and YouTube-like.
- Remove the visible home feed action toolbar.
- Preserve quick navigation from home feed cards into the existing point video/detail route.
- Move per-video actions to the second-level point video/detail page.
- Keep the home root header topic rail and bottom navigation scroll-hide behavior intact.
- Keep current backend feed data and routing contracts unless a future change explicitly reworks recommendation/filtering.
- Keep mobile viewport QA focused on 360px, 390px, and 430px widths.

**Non-Goals:**

- No new backend feed API, recommendation ranking, personalization, comments, counters, creator channels, or social graph.
- No new video-only route separate from the existing catalog point detail route.
- No redesign of the video player chrome beyond avoiding conflicts with the moved detail action row.
- No change to Atom chat internals; only the entry point moves from home card to detail page.
- No internal-scroll rewrite of the home root.

## Decisions

### Decision: Home feed cards become browse cards, not action cards

Home feed cards should render:

```text
16:9 preview/poster
title, protected to at most two lines
compact metadata/tags, protected to one visual row
optional duration/preview labels over the media
```

They should not render a visible footer action row. The card's media/title/body should route to the point detail route.

Rationale: YouTube's feed works because the root page is optimized for scanning, not acting. Removing the toolbar reduces vertical height, visual noise, and accidental action density.

Alternative considered: Keep the toolbar but make icons smaller. Rejected because the problem is information architecture, not icon size.

### Decision: Detail page owns the tool surface

The detail page should carry a compact action row for:

- Atom explanation
- Like or lightweight positive feedback if retained
- Bookmark/save
- Share
- Assessment/completion action where required by the learning flow
- More/overflow

The row should live below the video/title context, not inside the video player overlay. It should use compact icon-led buttons or chips, with accessible labels.

Rationale: Students who open a video have intent; this is where tools are useful. Keeping tools outside the player avoids conflicting with playback controls and keeps the player tap behavior predictable.

Alternative considered: Put actions as overlays on the video. Rejected because player controls already occupy the video layer, and overlaying learning actions would compete with play/seek/fullscreen.

### Decision: Preserve existing feed API shape

The existing `StudentHomeVideoFeedItem` fields are enough for the new home card and detail navigation:

- `title`
- `snippet` / `summary`
- `catalog_path`
- `badges`
- `video`
- `target`

No backend API change is needed for this iteration.

Rationale: The change is presentation and interaction placement. Keeping the API stable reduces blast radius.

Alternative considered: Add dedicated `home_meta` and `detail_actions` fields. Deferred until backend recommendation/category behavior is redesigned.

### Decision: Keep home root window scrolling

Do not make `.student-route-content` the scroll container for `/home`. The scroll-hide behavior for header/topic rail and bottom navigation depends on `window.scrollY`.

The home page can still use theme-paper backgrounds to avoid grid bleed, but it must preserve document-level scrolling.

Rationale: Internal scrolling broke the `nav-compressed` behavior. The root page already has working window-scroll semantics, so the card redesign should fit that model.

Alternative considered: Update the scroll listener to observe an internal scroll container. Rejected for this change because it increases shell complexity and affects more root pages than the home feed.

### Decision: Update specs and tests before implementation

Existing specs currently require a home video action row. This change must replace those contracts, then update tests accordingly:

- Remove e2e expectations for home feed toolbar buttons.
- Add e2e expectations that home card media/title/body navigate to detail.
- Add detail-page expectations for the moved actions.
- Update role-boundary assertions so they prevent reintroducing home feed action chrome.
- Update viewport QA for compact cards and preserved scroll-hide behavior.

Rationale: The previous toolbar was added by spec, so the spec must lead the implementation.

## Risks / Trade-offs

- [Risk] Removing Atom from the home card may reduce immediate discoverability. → Mitigation: make Atom prominent on the detail action row and preserve Atom context from the selected point.
- [Risk] Users may not realize a compact feed card is tappable without `查看实验`. → Mitigation: make media, title, and card body tappable, preserve pointer/touch feedback, and optionally use a subtle play/detail affordance on the media.
- [Risk] Tool migration could duplicate actions between home and detail if implementation is partial. → Mitigation: update tests to assert no home feed action row remains.
- [Risk] Detail action row can become too dense on 360px devices. → Mitigation: use compact icon-led controls, allow secondary actions behind overflow if needed, and QA at 360/390/430 widths.
- [Risk] Another viewport fix could break root scroll-hide behavior again. → Mitigation: add QA that scrolls `/home`, verifies `nav-compressed`, and checks header and bottom nav leave the viewport.
