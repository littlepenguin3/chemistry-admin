## Why

The current student H5 home video card is structurally correct after the browse-card refactor, but its typography and tag treatment still read like a learning-detail panel: the title is too large and the green pill tags compete with the video. The next polish pass should make the root feed feel closer to a Bilibili-style mobile video stream: video first, compact left-aligned title, subdued metadata, and a single low-noise overflow entry.

## What Changes

- Reduce the visual weight of home video titles so they remain readable but no longer dominate the video preview.
- Replace green pill-style tag badges under home video titles with one subdued single-line metadata row using `A · B · C` separators.
- Keep the card text block left-aligned without adding a channel avatar, circular learning icon, or synthetic creator identity.
- Add exactly one right-side vertical-more overflow affordance to each home video card.
- Use the existing student H5 learning-page bottom-sheet visual pattern for the home video overflow menu.
- Keep point-specific tools such as Atom, assessment, and like on the second-level point video detail page, not in the home feed card.
- Allow optional low-frequency actions such as save-later, share, not-interested, or feedback only inside the home card overflow sheet, not as visible card toolbar buttons.
- Preserve the existing home feed API, inline muted preview, point-detail navigation, root tab identity, and window-level scroll behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `student-h5-video-discovery`: refine home video card presentation, metadata rendering, and permitted home-card overflow behavior while preserving browse-first feed semantics.
- `student-h5-mobile-design-system`: define phone-safe overflow-sheet behavior and QA expectations for the home video card's low-frequency menu.

## Impact

- Affected frontend files are expected to include `apps/web-student/src/routes/home/HomeRootPage.tsx`, `apps/web-student/src/styles/app-shell.css`, and focused tests in `apps/web-student/src/App.e2e.test.tsx` and `apps/web-student/src/roleBoundaries.test.ts`.
- The implementation should reuse existing icons and the learning catalog bottom-sheet pattern where practical.
- No backend API, routing contract, recommendation ranking, Atom chat internals, video player chrome, or point-detail action contract changes are expected.
