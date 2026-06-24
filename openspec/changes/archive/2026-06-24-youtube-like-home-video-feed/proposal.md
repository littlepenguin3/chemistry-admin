## Why

The current student H5 home video feed behaves like a point-detail card embedded in the root feed: every item carries a large description plus a full action toolbar. This makes the home page visually heavy, harder to scan, and unlike the compact YouTube-style mobile feed the product is now aiming for.

The action toolbar is still useful, but it belongs on the second-level point video/detail page where the student has already chosen a video and can act with intent.

## What Changes

- Convert the home feed card into a lightweight YouTube-like browse card: media preview, prominent title, and compact context metadata only.
- Remove the visible per-card home feed toolbar, including `查看实验`, like, bookmark, share, Atom, and more controls.
- Make the home feed card itself navigate to the existing point detail route from media, title, or metadata taps.
- Move video-specific actions to the second-level point video/detail page as a compact detail action row.
- Keep Atom, bookmark/save, share, assessment/completion, and overflow actions available from the detail page.
- Preserve muted inline preview, one-active-card autoplay behavior, root tab identity, header/bottom-nav scroll compression, and safe-area behavior.
- Update tests and mobile QA contracts so the home feed is validated as a compact browse surface, not an inline action surface.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `student-h5-video-discovery`: Change home feed behavior from action-card browsing to lightweight video-card browsing, and move feed actions to the point video/detail destination.
- `student-h5-mobile-design-system`: Change the mobile home feed visual contract so common phone widths validate compact YouTube-like cards without home action rows, while detail pages own the action toolbar and safe-area constraints.

## Impact

- Frontend home feed:
  - `apps/web-student/src/routes/home/HomeRootPage.tsx`
  - `apps/web-student/src/styles/app-shell.css`
- Frontend point detail/video page:
  - `apps/web-student/src/features/catalog/CatalogPointDetailPanel.tsx`
  - `apps/web-student/src/features/catalog/PointVideoPlayer.tsx` if player-adjacent action placement needs coordination
  - `apps/web-student/src/styles/experiments.css`
- Tests and QA:
  - `apps/web-student/src/App.e2e.test.tsx`
  - `apps/web-student/src/roleBoundaries.test.ts`
  - `apps/web-student/scripts/mobile-viewport-qa.mjs`
- OpenSpec requirements:
  - `openspec/specs/student-h5-video-discovery/spec.md`
  - `openspec/specs/student-h5-mobile-design-system/spec.md`
