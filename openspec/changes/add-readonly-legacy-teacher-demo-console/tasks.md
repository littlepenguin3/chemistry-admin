## 1. Backend Read-Only Demo API

- [x] 1.1 Create old-scoped teacher demo schemas for overview, video resources, question resources, class summaries, analytics, weak points, and evaluation-system payloads.
- [x] 1.2 Add a `teacher_legacy` or equivalent old-scoped domain/read-model module that aggregates shared catalog, media, question-bank, class, attempt, mastery, and report data.
- [x] 1.3 Implement `GET /api/admin/legacy/teacher-demo/overview` with resource counts and BKT feedback-loop evidence.
- [x] 1.4 Implement `GET /api/admin/legacy/teacher-demo/video-resources` with point title, catalog path, video availability, published media count, question coverage, and recommendation labels.
- [x] 1.5 Implement `GET /api/admin/legacy/teacher-demo/question-resources` with question totals, published/draft counts, question-type distribution, and chapter/experiment/point coverage.
- [x] 1.6 Implement `GET /api/admin/legacy/teacher-demo/classes` with class roster and participation summary fields.
- [x] 1.7 Implement `GET /api/admin/legacy/teacher-demo/classes/{class_id}/analytics` by reusing current class dashboard/student analytics read models with old-facing field shaping.
- [x] 1.8 Implement `GET /api/admin/legacy/teacher-demo/classes/{class_id}/weak-points` by reusing current weak-point analytics with old-facing field shaping.
- [x] 1.9 Implement `GET /api/admin/legacy/teacher-demo/evaluation-system` with stable BKT score-band and evidence-source explanation data.
- [x] 1.10 Ensure all teacher demo routes enforce current teacher/admin auth and class-access boundaries.

## 2. Backend Read-Only Guardrails

- [x] 2.1 Remove or stop exposing broad old teacher demo mutation routes; keep legacy recommendation `PUT` in the old teacher UI contract as the only old-only write operation.
- [x] 2.2 Ensure new teacher-demo route inventory contains only `GET` methods under `/api/admin/legacy/teacher-demo`.
- [x] 2.3 Add backend tests proving teacher-demo endpoints are registered, authenticated, read-only, and do not require old-only database identities.
- [x] 2.4 Add backend tests proving current mainline admin write routes remain available outside the old teacher demo namespace.
- [x] 2.5 Add sanitization or DTO shaping so old teacher demo responses do not surface Agent/RAG/Atom/provider/retrieval/debug fields.

## 3. Old Teacher API Client

- [x] 3.1 Replace `apps/web-teacher-old/src/api.ts` teacher demo data functions with `GET` functions for the new teacher-demo endpoints plus the old-only recommendation toggle.
- [x] 3.2 Remove frontend API functions that create workbench sessions, publish/update questions, mutate classes, mutate students, import rosters, or reset passwords.
- [x] 3.3 Keep authentication/session helper functions intact.
- [x] 3.4 Add API types for teacher demo overview, video resources, question resources, class summaries, analytics, weak points, and evaluation-system data.
- [x] 3.5 Ensure old teacher API error messages remain legacy-facing and do not expose raw backend diagnostics.

## 4. Old Teacher Navigation and Pages

- [x] 4.1 Rework old teacher navigation into read-only modules such as `工作台`, `视频资源`, `题库资源`, `班级`, `学情分析`, and `评价体系`.
- [x] 4.2 Build the old `工作台` page with aggregate resource metrics and a visible BKT feedback-loop explanation.
- [x] 4.3 Build the old `视频资源` page as the primary video-first evidence surface with point/video rows and legacy recommendation toggles.
- [x] 4.4 Build the old `题库资源` page with AI-assisted question-bank process evidence, counts, coverage, and no generation/review/publish actions.
- [x] 4.5 Build the old `班级` page with read-only class roster and participation summary, no roster/account controls.
- [x] 4.6 Build the old `学情分析` page with class metrics, student matrix/list, weak point ranking, and optional student drilldown if current data supports it cleanly.
- [x] 4.7 Build the old `评价体系` page explaining evaluated objects, evidence sources, BKT score update meaning, score bands, and outputs.
- [x] 4.8 Rewrite old teacher visible copy in clean Chinese and preserve SYSU-red square legacy styling.
- [x] 4.9 Remove or redirect stale old teacher routes that imply monitoring, assistant, provider settings, mutation workbenches, or unsupported management features.

## 5. Frontend Read-Only and Boundary Tests

- [x] 5.1 Update old teacher tests to assert navigation contains only read-only demo modules and excludes learning assistant, intelligent monitoring, Atom, RAG, Agent, and provider surfaces.
- [x] 5.2 Add a fetch spy test proving old teacher data interactions after login do not issue `POST`, `PATCH`, or `DELETE`, and only issue `PUT` for the old-scoped recommendation toggle.
- [x] 5.3 Add tests for overview metrics and BKT feedback-loop copy.
- [x] 5.4 Add tests for video resource rows showing video availability, published media count, catalog path, question coverage, recommendation labels, and the old-only recommendation toggle.
- [x] 5.5 Add tests for question resource rows showing question-bank counts and AI-assisted process evidence without `AI出题` action.
- [x] 5.6 Add tests for class list and analytics/weak-point rendering.
- [x] 5.7 Add tests for evaluation-system score bands and evidence-source explanation.
- [x] 5.8 Add visible-text forbidden-term tests for all old teacher pages, loading states, empty states, errors, and toasts.

## 6. Validation

- [x] 6.1 Run `npm --prefix apps/web-teacher-old run typecheck`.
- [x] 6.2 Run `npm --prefix apps/web-teacher-old test -- --run`.
- [x] 6.3 Run `npm --prefix apps/web-teacher-old run build`.
- [x] 6.4 Run backend route/read-model tests for the new teacher demo endpoints.
- [x] 6.5 Run `openspec validate add-readonly-legacy-teacher-demo-console --strict`.
- [x] 6.6 If backend Python code changes are implemented, rebuild/restart the backend or old-specific compose runtime and verify route registration against the running service.
- [x] 6.7 Smoke-inspect rebuilt `web-teacher-old` via old-specific compose at `15178` because `15177` was already allocated; verify the old teacher frontend and backend route auth are reachable.
