## 1. Test Baseline And Guardrails

- [x] 1.1 Update `apps/web-student/src/App.e2e.test.tsx` home feed expectations so the home card no longer exposes `查看实验`, Atom, like, bookmark, share, or more controls.
- [x] 1.2 Add or update tests that tapping the home card media/title/body opens the existing point video detail route with home source context.
- [x] 1.3 Update `apps/web-student/src/roleBoundaries.test.ts` to enforce that `HomeRootPage.tsx` does not render `home-video-open-action`, `home-video-icon-actions`, or `问问Atom：` inside home cards.
- [x] 1.4 Add CSS/source guardrails that the root home route keeps window-level scrolling and does not make `.student-route-content` the home page scroll container.

## 2. Home Feed Card Restructure

- [x] 2.1 Refactor `apps/web-student/src/routes/home/HomeRootPage.tsx` so the home video card DOM contains media, title, compact tags/metadata, and no visible footer action toolbar.
- [x] 2.2 Remove the top catalog-path line from the home card presentation and derive compact tags from chapter context, display badges, and useful source text after the primary title.
- [x] 2.3 Protect the home card title to one or two visual lines and keep any secondary text compact enough that cards read as a browse feed rather than stacked detail panels.
- [x] 2.4 Keep muted one-card inline preview behavior, duration labels, poster fallback, active-card tracking, and autoplay failure handling intact after the DOM restructure.
- [x] 2.5 Make the media area, title area, and non-tool card body route to the existing point video detail destination with `from=home` or equivalent source context.

## 3. Detail Page Tool Surface

- [x] 3.1 Extend `apps/web-student/src/features/catalog/CatalogPointDetailPanel.tsx` so the point video detail page owns Atom, favorite or bookmark, share, assessment/completion, and overflow actions supported by the product.
- [x] 3.2 Move or recreate the current home-card share/bookmark/feedback behavior on the point detail action surface with point placement and canonical point identity context.
- [x] 3.3 Ensure the Atom detail action opens Atom with title, catalog or chapter context, point identity, and summary context without changing the active root tab identity.
- [x] 3.4 Keep detail actions outside `PointVideoPlayer` chrome so player controls remain limited to playback, progress, time, settings, fullscreen, and return behavior.

## 4. Mobile Styling And Scroll Behavior

- [x] 4.1 Update `apps/web-student/src/styles/app-shell.css` so home video cards use app theme solid surfaces, hide no required content behind grid leakage, and leave bottom safe-area space.
- [x] 4.2 Remove obsolete home action-row styling or scope it away from home cards after the DOM no longer renders the row.
- [x] 4.3 Update `apps/web-student/src/styles/experiments.css` so `.point-title-actions` presents the moved tools as compact phone-safe controls on 360px, 390px, and 430px widths.
- [x] 4.4 Verify the home page still applies the shell compressed navigation state on downward window scrolling and restores it on upward/top scrolling.
- [x] 4.5 Verify the final home feed card remains readable above the bottom navigation and safe-area inset after the card height changes.

## 5. Verification And Delivery

- [x] 5.1 Run `npm run typecheck` in `apps/web-student`.
- [x] 5.2 Run the focused home/detail tests in `apps/web-student/src/App.e2e.test.tsx` and `apps/web-student/src/roleBoundaries.test.ts`.
- [x] 5.3 Run `npm run test:e2e` for the student H5 regression suite.
- [x] 5.4 Run `npm run build` and confirm the production bundle contains the updated home/detail card behavior.
- [x] 5.5 Update the running container with the rebuilt student web assets and verify the container-rendered phone viewport matches the spec.
- [x] 5.6 Capture manual or Playwright QA at 360px, 390px, and 430px widths for home feed card layout, detail action row layout, safe-area spacing, and scroll-driven header/bottom-nav compression.
