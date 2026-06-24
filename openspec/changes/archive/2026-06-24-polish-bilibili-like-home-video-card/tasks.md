## 1. Test Baseline And Guardrails

- [x] 1.1 Update `apps/web-student/src/App.e2e.test.tsx` home feed expectations so cards render one subdued metadata row instead of green pill tag chips.
- [x] 1.2 Add or update tests that the home card title/text area still opens point detail with `from=home`.
- [x] 1.3 Add or update tests that the home card overflow trigger opens a menu or sheet without navigating to point detail.
- [x] 1.4 Add or update tests that dismissing the overflow menu by backdrop or menu action does not change the active root tab.
- [x] 1.5 Update `apps/web-student/src/roleBoundaries.test.ts` so the home feed may render exactly one overflow trigger per card while still rejecting `home-video-actions`, `home-video-icon-actions`, Atom, like, assessment, and visible toolbar controls.
- [x] 1.6 Add source or CSS guardrails that home metadata does not render through green pill chip classes or button-like category styling.
- [x] 1.7 Preserve guardrails that `/home` keeps native document scrolling and does not make `.student-route-content` the feed scroll container.

## 2. Home Card DOM And Behavior

- [x] 2.1 Refactor `HomeRootPage.tsx` so the text area and overflow trigger are sibling interactive controls rather than nested interactive elements.
- [x] 2.2 Keep the media preview button opening point detail and preserve muted one-card autoplay behavior, poster fallback, duration label, and preview state label.
- [x] 2.3 Replace `buildHomeVideoTags` with a metadata builder that de-duplicates `badges`, `snippet`, catalog path parts, and reason fallback while avoiding title repetition.
- [x] 2.4 Render the metadata as one joined string using ` · ` separators, capped to a small number of useful parts.
- [x] 2.5 Add a right-side vertical ellipsis overflow button for each home video card with an accessible label tied to the item title.
- [x] 2.6 Add local state for the active overflow item and ensure opening overflow does not trigger card navigation.
- [x] 2.7 Render a home video overflow bottom sheet with low-frequency actions such as save-later, share, not-interested, feedback, and optionally open-detail.
- [x] 2.8 Keep Atom, assessment, quiz, point completion, comment, creator-channel, follower, and ranking actions out of the home overflow sheet.
- [x] 2.9 Close the overflow sheet on backdrop tap, menu action, route/unmount, and Escape where practical.
- [x] 2.10 Provide controlled local UI feedback for non-persistent overflow actions, or omit unavailable actions rather than implying backend mutations.

## 3. Home Card Visual Polish

- [x] 3.1 Update `app-shell.css` so home card titles use a feed-title scale around 17-18px, a quieter weight than detail headings, and a two-line clamp.
- [x] 3.2 Remove the green pill visual treatment from home video metadata and replace it with muted single-line text.
- [x] 3.3 Ensure metadata truncates with ellipsis on 360px, 390px, and 430px widths without changing the video preview width or card layout.
- [x] 3.4 Keep the text block left-aligned with no avatar, no circular learning marker, no channel icon, and no synthetic creator identity.
- [x] 3.5 Style the overflow trigger as a quiet icon-only control aligned with the title block, with a phone-appropriate hit area.
- [x] 3.6 Add home overflow sheet styles by reusing or adapting the existing learning catalog bottom-sheet visual pattern.
- [x] 3.7 Ensure the sheet appears above bottom navigation, respects safe-area bottom padding, and keeps rows readable and tappable.
- [x] 3.8 Preserve the home feed paper background, 16:9 media dominance, bottom safe-area spacing, and app-shell scroll compression behavior.

## 4. Verification And Delivery

- [x] 4.1 Run `openspec validate polish-bilibili-like-home-video-card --strict`.
- [x] 4.2 Run `npm run typecheck` in `apps/web-student`.
- [x] 4.3 Run focused `App.e2e.test.tsx` tests covering home feed card navigation and overflow behavior.
- [x] 4.4 Run focused `roleBoundaries.test.ts` tests covering home card browse-only guardrails and root scroll behavior.
- [x] 4.5 Run `npm run test:e2e` for the student H5 regression suite.
- [x] 4.6 Run `npm run build` and confirm the production bundle includes the updated home card and overflow sheet behavior.
- [x] 4.7 Run or update mobile viewport QA for 360x780, 390x844, and 430x932 to verify title clamp, metadata truncation, overflow menu, safe-area spacing, and no horizontal overflow.
- [x] 4.8 Update the running student web container with rebuilt assets only after build and tests pass.
- [x] 4.9 Verify the container-rendered home feed still compresses and restores the header/bottom navigation on native window scroll.
