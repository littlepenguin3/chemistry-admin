## Why

The legacy student frontend is now able to demonstrate the BKT-centered learning and assessment loop, but the paired legacy teacher frontend still reads like an operational admin console and includes broad real write actions such as creating question-workbench sessions. For competition judging, the teacher side should act as an evidence console that proves the platform already has video resources, question-bank resources, class data, and BKT learning analytics without exposing modern Agent/RAG/Atom product surfaces. The old competition profile still needs two narrow operational paths: teachers must be able to maintain `推荐学习` video-point labels used by the old student video library, and they must be able to create classes and roster students through existing mainline class APIs so old student login and reports can be demonstrated end to end.

## What Changes

- Convert `web-teacher-old` into a mostly read-only legacy teacher demo console focused on resource evidence and the BKT teaching feedback loop.
- Keep only minimal class/student creation on the old teacher class page, backed by existing mainline class and roster APIs.
- Remove or disable broad real create/update/delete actions from the old teacher surface, including question generation/session creation, class/student editing, roster import, prompt settings, account reset, and publish/review actions.
- Keep the old-only recommendation toggle for video points so teachers can mark and unmark `推荐学习` point labels used by the old student video library.
- Add old-scoped read-only teacher demo APIs that aggregate existing shared data for:
  - overview metrics and loop explanation;
  - video/point resources;
  - question-bank resources;
  - class roster summaries;
  - class learning analytics, weak points, and BKT score evaluation;
  - an explicit evaluation-system explanation for reviewers.
- Keep all old teacher data sourced from the current backend database and current identities; do not create a separate old database, old seed corpus, old question bank, or old mastery model.
- Preserve the legacy SYSU-red visual identity and forbidden-term gate: no visible Atom, RAG, Agent, provider, retrieval, chunk, embedding, or modern monitoring/assistant wording.
- Use `AI辅助出题` only as a displayed resource/process concept. The old teacher demo console must not provide a real `AI出题` submit action.
- Maintain current `web-teacher`, current admin APIs, and current operational admin behavior outside the old demo profile.

## Capabilities

### New Capabilities

None. This extends the existing legacy competition profile rather than introducing an independent product capability.

### Modified Capabilities

- `bkt-legacy-competition-profile`: Add requirements for a mostly read-only legacy teacher demo console that presents video resources, question-bank resources, classes, BKT learning analytics, and the score evaluation system while prohibiting broad teacher-side creation or mutation actions, except old-only recommendation labels and existing class/roster creation.

## Impact

- `apps/web-teacher-old`: navigation, API client, pages, visible copy, tests, and old SYSU-red teacher demo styling.
- `server/app/api/admin/admin_legacy.py` or a new old-scoped admin legacy router: read-only teacher demo endpoints under a legacy namespace.
- `server/app/domains/student_legacy` or a new `server/app/domains/teacher_legacy` package: old-scoped read-model aggregation over shared catalog, media, question-bank, class, attempt, mastery, and report tables.
- Existing read models to reuse where possible:
  - `GET /api/admin/experiments`
  - `GET /api/admin/question-banks`
  - `GET /api/admin/question-banks/catalog`
  - `GET /api/admin/classes`
  - `GET /api/admin/analytics/classes/{class_id}/dashboard`
  - `GET /api/admin/analytics/classes/{class_id}/weak-points`
  - `GET /api/admin/analytics/classes/{class_id}/students/{student_id}`
- Tests must prove old teacher frontend/API usage is read-only except for the old-only recommendation toggle, and that forbidden modern implementation terms are not visible.
