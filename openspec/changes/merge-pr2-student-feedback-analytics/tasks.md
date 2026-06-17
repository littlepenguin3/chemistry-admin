## 1. Integration Setup And Safety

- [ ] 1.1 Confirm `git status --short --branch` is clean and `origin/main` points at the pushed H5 baseline commit `5e84169` or a direct descendant.
- [ ] 1.2 Fetch `origin main` and PR #2 head into `origin/pr/2`.
- [ ] 1.3 Create a fresh integration branch from `origin/main`, e.g. `codex/merge-pr2-student-feedback-analytics`.
- [ ] 1.4 Record the merge base, PR2 commit list, and conflict file list in the implementation notes or final verification.
- [ ] 1.5 Merge `origin/pr/2` into the integration branch without committing until all conflicts are reviewed.

## 2. Dependency And Tooling Merge

- [ ] 2.1 Resolve `apps/student-web/package.json` by preserving `qa:mobile` and adding PR2 `test`, `test:e2e`, Markdown/KaTeX, Vitest, jsdom, and Testing Library dependencies.
- [ ] 2.2 Resolve `apps/student-web/vite.config.ts` by preserving `VITE_API_PROXY_TARGET` and adding PR2 Vitest jsdom configuration.
- [ ] 2.3 Regenerate `apps/student-web/package-lock.json` from the resolved package file.
- [ ] 2.4 Add or adapt `apps/student-web/src/components/AiMarkdown.tsx` so it satisfies existing chemistry Markdown rendering contracts.
- [ ] 2.5 Decide whether PR2's `PageFeedback.tsx` should be omitted, deleted after merge, or kept only as an unused reference; do not render it in the H5 app.

## 3. Unified Student Feedback Backend

- [ ] 3.1 Resolve `server/app/admin_main.py` so `student_platform_router` remains mounted and no second conflicting student feedback route is mounted.
- [ ] 3.2 Port PR2 attachment helpers into `server/app/feedback.py`, including MIME normalization, 5 MB limit, storage path safety, memory backend support, and attachment metadata listing.
- [ ] 3.3 Extend `server/app/schemas.py` with feedback attachment response models and attachment count fields.
- [ ] 3.4 Extend `server/app/services/feedback_service.py` and `server/app/routers/admin_feedback.py` so admins can see attachment counts and fetch attachment metadata/files under existing visibility rules.
- [ ] 3.5 Replace or extend `server/app/routers/student_platform.py` feedback submission so one authoritative `POST /api/student/feedback` path supports optional image attachment, feature-flag rejection, authenticated identity derivation, and metadata spoofing protection.
- [ ] 3.6 Preserve `/api/student/app-config` behavior and tests.
- [ ] 3.7 Add migration `server/migrations/018_feedback_attachments.sql`, renumbering only if another migration has appeared.
- [ ] 3.8 Adapt PR2 `server/tests/test_student_feedback.py` to the unified route and response shape.

## 4. Student H5 Feedback UI Integration

- [ ] 4.1 Resolve `apps/student-web/src/api.ts` so feedback submission can send `FormData` with optional attachment while preserving app-config and current learning payload types.
- [ ] 4.2 Update current `StudentFeedbackFab` in `apps/student-web/src/App.tsx` to support attachment selection, validation, removal, success/error states, and viewport/user-agent metadata.
- [ ] 4.3 Keep current `LearningRoute` states (`entry`, `chapter`, `point`, `posttest`, `summary`) and do not restore old PR2 `group` or `experiment` branches as primary H5 routes.
- [ ] 4.4 Preserve feedback context fields for page path, chapter, selected element, active chapter view, experiment, point key, and context title.
- [ ] 4.5 Resolve `apps/student-web/src/styles.css` so attachment controls fit within the existing mobile feedback overlay and do not overlap AI, finish actions, segmented switcher, or point cards.
- [ ] 4.6 Update mobile viewport QA to cover feedback attachment add/remove/submit behavior at 360x780, 390x844, and 430x932.

## 5. Experiment Mastery And Assessment Integration

- [ ] 5.1 Add `server/migrations/017_student_experiment_mastery.sql`, renumbering only if another migration has appeared.
- [ ] 5.2 Add `server/app/services/experiment_mastery_service.py` and PR2 `server/app/mastery.py` changes needed for experiment-level mastery updates.
- [ ] 5.3 Integrate pretest changes in `server/app/services/student_pretest_service.py` so graded attempts update experiment mastery while existing stage selection behavior remains correct.
- [ ] 5.4 Integrate posttest changes in `server/app/services/student_posttest_service.py` and `server/app/student_posttest_schemas.py` so reports can include experiment-level mastery changes.
- [ ] 5.5 Resolve `server/app/services/student_learning_service.py` by preserving seed-backed profile selection and `chapter_experiment_groups`, then adding experiment mastery as an optional recommendation signal with fallback when mastery data is absent.
- [ ] 5.6 Preserve compatibility barriers for local databases that lack optional pretest/posttest/mastery tables before migrations.
- [ ] 5.7 Update or add tests for pretest/posttest experiment mastery updates and learning-page fallback behavior.

## 6. Admin Analytics And Feedback UI Integration

- [ ] 6.1 Resolve admin API types in `apps/admin-web/src/api/index.ts` for experiment mastery, experiment groups, feedback attachments, report drilldowns, and AI report content.
- [ ] 6.2 Integrate PR2 backend analytics changes in `server/app/services/analytics_service.py` without dropping existing weak point, weak video point, timeline, and report behavior.
- [ ] 6.3 Integrate PR2 admin analytics UI changes in `apps/admin-web/src/features/analytics/AnalyticsPage.tsx`, preserving existing admin layout conventions.
- [ ] 6.4 Integrate PR2 admin feedback UI changes in `apps/admin-web/src/features/feedback/FeedbackPage.tsx` and `feedback.css` so attachment counts/details are visible.
- [ ] 6.5 Merge admin global style additions in `apps/admin-web/src/styles.css` without introducing unrelated visual churn.
- [ ] 6.6 Update `server/tests/test_admin_router_contract.py` and analytics tests as needed for the merged route tree and response contracts.

## 7. Student Report Markdown Rendering

- [ ] 7.1 Use `AiMarkdown` for student-visible posttest summary and mistake explanation text where PR2 adds AI/fallback content.
- [ ] 7.2 Ensure Markdown rendering does not break existing assistant rendering or expose raw supported LaTeX commands in report text.
- [ ] 7.3 Run or add frontend tests covering Markdown/chemistry rendering for student report text.

## 8. Verification

- [ ] 8.1 Run `python scripts\validate_production_resources.py`.
- [ ] 8.2 Run targeted backend tests: student learning, platform, feedback, pretest, posttest, analytics, and admin router contract.
- [ ] 8.3 Run full backend test suite if targeted tests pass and runtime is acceptable.
- [ ] 8.4 Run `npm run typecheck --prefix apps/student-web`.
- [ ] 8.5 Run `npm run build --prefix apps/student-web`.
- [ ] 8.6 Run `npm run test --prefix apps/student-web` or the PR2 e2e/unit subset after dependencies are installed.
- [ ] 8.7 Run admin frontend typecheck/build if package scripts exist.
- [ ] 8.8 Run mobile viewport QA for student H5, including entry, chapter facts/experiments switching, point detail, AI, feedback attachment, posttest, and summary.
- [ ] 8.9 Run `openspec validate merge-pr2-student-feedback-analytics --strict`.
- [ ] 8.10 Run `git diff --check` and confirm no conflict markers remain.

## 9. Finalization

- [ ] 9.1 Review the final diff by subsystem: student-web, admin-web, backend, migrations, tests, OpenSpec.
- [ ] 9.2 Confirm there is exactly one authoritative `POST /api/student/feedback` route behavior.
- [ ] 9.3 Confirm PR2's useful files were either integrated or intentionally omitted with rationale.
- [ ] 9.4 Commit the integration in coherent commits or one clearly named merge/integration commit.
- [ ] 9.5 Push the integration branch.
- [ ] 9.6 Open a PR against `main` summarizing conflict decisions, tests run, and remaining risks.
