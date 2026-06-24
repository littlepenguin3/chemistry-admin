## Context

The previous `youtube-like-home-video-feed` change moved the student H5 home feed from detail-like cards with visible tools into a browse-first video stream. That direction is still correct, but the current rendered card remains too heavy below the media:

- the title scale is closer to a detail-page heading than a feed item title;
- the green pill tags compete with the video preview and read as tappable controls;
- the card text block has no low-frequency overflow entry, so future feed actions would tend to return as a visible toolbar.

The desired refinement is closer to Bilibili mobile than YouTube channel rows: no avatar or creator identity is introduced; the content simply stays left aligned under the video, with one right-side vertical-more trigger.

Relevant current code:

- `apps/web-student/src/routes/home/HomeRootPage.tsx` owns feed rendering, active-card muted preview, metadata derivation, card navigation, and keyboard opening.
- `apps/web-student/src/styles/app-shell.css` owns the home card visual treatment.
- `apps/web-student/src/routes/learn/FamilyCatalogShell.tsx` and `apps/web-student/src/styles/learning.css` contain the existing learning-page "more" bottom-sheet pattern.
- `apps/web-student/src/features/catalog/CatalogPointDetailPanel.tsx` owns second-level point actions and should remain the main tool surface for Atom and assessment.

Important inherited constraint: `/home` must keep native document scrolling. Do not move the feed into an internal `.student-route-content` scroller, because the app shell's compressed header and bottom navigation behavior depends on `window.scrollY`.

## Goals / Non-Goals

**Goals:**

- Make the root feed card visually video-first and closer to Bilibili's left-aligned mobile feed.
- Reduce title scale and weight while keeping the title readable and protected to two lines.
- Replace green pill badges with a subdued one-line metadata row using `A · B · C` separators.
- Avoid adding an avatar, channel icon, round learning marker, or synthetic creator identity.
- Add exactly one vertical-more overflow trigger on each home video card.
- Present overflow choices in a phone-safe bottom sheet aligned with the existing learning catalog "more" sheet pattern.
- Keep the card body and media routing to point detail with `from=home`.
- Keep Atom and assessment actions on the second-level point detail page.
- Keep viewport QA focused on 360px, 390px, and 430px widths.

**Non-Goals:**

- No backend feed API change.
- No creator/channel/user-avatar model.
- No comments, counters, follower counts, ranking, creator social graph, or Bilibili/YouTube entertainment metrics.
- No new video-only route.
- No redesign of point detail actions or player chrome.
- No internal-scroll rewrite of the root home shell.
- No persistent save-later, not-interested, or recommendation-training backend unless a future change defines it.

## Decisions

### Decision: Use a Bilibili-like left-aligned text block

The card text block should render as:

```text
[16:9 video preview]

title text, up to two lines                         [vertical more]
metadata part A · metadata part B · metadata part C
```

No avatar slot is added. The title starts at the same left inset as the metadata row.

Rationale: the product has no creator/channel identity, and a synthetic chemistry avatar would add visual ceremony without meaning. Bilibili's phone feed shows that avatar-less left alignment works well when the video is the primary object.

Alternative considered: add a small element-symbol or experiment icon where YouTube has the channel avatar. Rejected because the user explicitly preferred no small round marker, and because the metadata row already preserves learning context.

### Decision: Convert tags into subdued metadata, not chips

Replace `home-video-badges` pill rendering with a single metadata text row. Metadata should be derived from the same frontend inputs:

- `item.badges`
- `item.snippet`
- `item.target.catalog_path` or `item.catalog_path`
- `reasonLabels[item.reason]` as fallback

The metadata builder should de-duplicate values, avoid repeating the title, cap the number of visible parts, and join them with ` · `. CSS should keep the row single-line with ellipsis.

Rationale: the student still needs chapter, reaction, and reagent context, but this context should support scanning rather than look like a set of controls.

Alternative considered: keep pills but reduce size and color. Rejected because pill affordances still read as tappable category chips and visually compete with video content.

### Decision: Lower title hierarchy rather than shrinking the video

Keep the 16:9 media area as the dominant element. Reduce the title's type scale and weight instead of changing the preview ratio. Target styling should be closer to a feed item title than a detail heading, for example around 17-18px, line-height around 1.25, and weight around 800-850, with two-line clamp.

Rationale: the problem is not that the media is too large; it is that text below the media is speaking too loudly.

Alternative considered: make cards shorter by reducing media height. Rejected because video preview is the feed's main signal and should stay inspectable.

### Decision: Add one overflow trigger, not a toolbar

The home card may render a single right-side vertical ellipsis trigger beside the title. It must not reintroduce a visible row of Atom, like, bookmark, share, or CTA buttons.

The trigger should be independent from the tappable card body. The current `home-video-body` uses `role="button"` for the whole text block; adding a nested real button would create invalid nested interactive semantics. Implementation should restructure the card so that:

- the media remains a button that opens detail;
- the title/metadata content is a separate tappable element or button that opens detail;
- the overflow trigger is a sibling button that opens the sheet;
- tapping overflow does not also navigate to point detail.

Rationale: a single overflow trigger matches mobile video-feed conventions while keeping the root feed browse-first.

Alternative considered: keep the entire body as one `role="button"` and stop propagation from the overflow button. Rejected because nested interactive controls are fragile for accessibility and tests.

### Decision: Use a bottom sheet for overflow actions

The overflow menu should use a bottom-sheet treatment based on the existing `family-catalog-more-sheet` pattern:

- fixed full-viewport backdrop;
- sheet anchored to the bottom;
- `var(--mobile-content-max)` width cap;
- safe-area bottom padding;
- large touch rows with icons where useful;
- closes by backdrop tap, menu action, Escape where supported, or route change/unmount.

The sheet may include low-frequency actions such as:

- `稍后学习` or equivalent save-later wording;
- `分享`;
- `不感兴趣`;
- `反馈问题`;
- optional `打开详情` if the product wants an explicit route action inside the menu.

These actions can be local UI affordances or placeholders until persistence/recommendation backends are defined. They must not include Atom or assessment, and they must not display counters or ranking signals.

Rationale: the existing learning page already has a mobile sheet language. A bottom sheet is also safer than an anchored popover on 360px screens.

Alternative considered: anchored bubble next to the three dots. Deferred because it is more likely to clip near the right edge and requires additional collision placement logic.

### Decision: Guardrails should allow one overflow class while still blocking toolbar regressions

Tests should change from "no MoreHorizontal in home" to "no home toolbar and no visible home tool buttons, except one overflow trigger." Role-boundary tests should explicitly disallow `home-video-actions`, `home-video-icon-actions`, Atom/like/share toolbar controls, and green pill metadata styling.

Rationale: previous guardrails correctly blocked toolbar regression, but they now need to distinguish the allowed overflow trigger from the removed action row.

## Risks / Trade-offs

- [Risk] The overflow trigger could be mistaken for reintroducing home-card tools. -> Mitigation: specs and tests allow only one trigger and keep Atom/assessment out of the sheet.
- [Risk] Metadata could become too long on 360px screens. -> Mitigation: render one line, cap parts, ellipsize, and test 360/390/430 widths.
- [Risk] A bottom sheet could collide with the root bottom navigation. -> Mitigation: render it above app chrome with safe-area padding and verify bottom rows remain tappable.
- [Risk] Save-later or not-interested actions may imply backend persistence that does not exist. -> Mitigation: treat them as local/placeholder UI unless a later change defines persistence.
- [Risk] Refactoring the card body for overflow could break click-to-detail behavior. -> Mitigation: update e2e tests for media click, text click, overflow click, and route-stack return.

## Migration Plan

1. Update tests and spec guardrails to permit only the single overflow trigger and bottom sheet.
2. Refactor the home card DOM to separate detail navigation targets from the overflow trigger.
3. Replace badge chip rendering with single-line metadata rendering.
4. Add home overflow sheet styles by reusing or adapting the learning catalog sheet pattern.
5. Run focused tests, full student e2e, build, and mobile viewport QA.
6. Update the running student web container only after the production build passes.

Rollback is straightforward: revert this change's home card component and CSS edits while preserving the previous `youtube-like-home-video-feed` browse-card architecture.

## Open Questions

- Should the initial overflow sheet include `打开详情`, or is tapping the card enough?
- Should `稍后学习` be a local-only visual acknowledgement in this iteration, or should it be omitted until persistence exists?
- Should `分享` appear in the home overflow sheet immediately, or remain detail-only until native share behavior is better tested in the target WebView?
