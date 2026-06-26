## Context

`web-student-old` now demonstrates the legacy competition path from experiment video learning to assessment, BKT mastery updates, and student-facing AI reports. The matching `web-teacher-old` product exists, but its current shape is still closer to a real operation console: it can call a recommendation `PUT`, can create question-workbench sessions, and visually suggests teacher creation/review actions. That is not the desired judging surface.

For the legacy competition profile, the teacher side should prove the system has resources and analytics, not expose broad operational administration. The correct product shape is an evidence dashboard over shared runtime data, with one old-only exception for maintaining recommended learning video points:

```
Shared core database
  - catalog / experiment nodes
  - media bindings
  - question banks
  - classes / roster
  - attempts / reports / mastery
          |
          v
Legacy teacher demo read models
          |
          v
web-teacher-old SYSU-red evidence console
```

Current backend data is already strong enough for this:

- video/resource evidence is available from experiment overviews, catalog question-bank nodes, media bindings, and the existing legacy point read model;
- question-bank evidence is available from `/api/admin/question-banks` and `/api/admin/question-banks/catalog`;
- class evidence is available from `/api/admin/classes` and roster-backed analytics;
- BKT/learning evidence is available from `/api/admin/analytics/classes/{class_id}/dashboard`, `/weak-points`, and `/students/{student_id}`;
- the old student report path now persists real AI-generated report summaries and mistake explanations.

The implementation should therefore add a thin old-scoped read-model layer rather than forking core tables or building a fake teacher demo dataset.

## Goals / Non-Goals

**Goals:**

- Make `web-teacher-old` a judging/demo console with no broad live mutation actions.
- Preserve the old-only `推荐学习` video-point toggle because the old student video library depends on teacher-maintained recommendation labels.
- Present the teacher-side evidence for the legacy BKT narrative:
  - video resources;
  - question-bank resources;
  - class roster and participation;
  - class/student learning analytics;
  - point/knowledge-score evaluation system.
- Keep old teacher data sourced from shared backend identities and records.
- Add old-scoped read-only aggregation APIs when current APIs are too broad, too operational, or expose unsafe fields.
- Preserve the old SYSU-red visual language and hide Atom/RAG/Agent/provider/retrieval implementation language.
- Keep current `web-teacher`, current admin APIs, and current operational teacher/admin behavior unchanged.

**Non-Goals:**

- Do not create classes, students, question-bank sessions, question records, prompt settings, reports, or mastery records from the old teacher product.
- Do not expose current green teacher shell, learning assistant, intelligent monitoring, RAG diagnostics, provider settings, or Agent traces in `web-teacher-old`.
- Do not create a separate old database, old seed corpus, old question bank, old catalog tree, or old BKT model.
- Do not remove mainline teacher/admin write APIs; this change only constrains the old teacher product and old-scoped demo APIs.
- Do not make the old teacher product a full replacement for current admin operations.

## Decisions

### 1. Use a read-only old teacher API namespace

Add old-scoped teacher demo endpoints under a namespace such as:

```text
GET /api/admin/legacy/teacher-demo/overview
GET /api/admin/legacy/teacher-demo/video-resources
GET /api/admin/legacy/teacher-demo/question-resources
GET /api/admin/legacy/teacher-demo/classes
GET /api/admin/legacy/teacher-demo/classes/{class_id}/analytics
GET /api/admin/legacy/teacher-demo/classes/{class_id}/weak-points
GET /api/admin/legacy/teacher-demo/evaluation-system
```

These endpoints should be `GET` only and should return old-facing DTOs. They may internally call or reuse current read models, but they should not forward current operational endpoint shapes directly when those shapes contain write-oriented or diagnostic fields.

Alternative considered: keep `web-teacher-old` directly calling current admin endpoints. That minimizes backend work, but it keeps old teacher coupled to operational admin semantics and makes it too easy to accidentally expose write actions.

### 2. Remove broad old teacher mutation calls from the frontend

`apps/web-teacher-old/src/api.ts` should export read functions, login/session helpers, and the old-only recommendation toggle. It must not export functions that call `POST`, `PUT`, `PATCH`, or `DELETE` for teacher demo data outside the legacy recommendation association.

Existing old teacher calls to remove or replace with display-only evidence:

- `createQuestionWorkbenchSession`
- any future old teacher call that creates/updates classes, rosters, questions, prompt settings, or analytics artifacts

Process states such as `AI辅助出题 -> 教师审核 -> 题库入库` may still be displayed, but as evidence/status copy, not as action buttons that mutate backend state.

Alternative considered: keep broad operation buttons but make them no-op or mocked. That is weaker because tests and future maintainers may miss that the product is meant to be demo-safe. The better boundary is no broad write API functions and no mutation-looking primary buttons outside the old-only recommendation toggle.

### 3. Reframe navigation around evidence, not operations

Recommended old teacher modules:

```text
工作台
视频资源
题库资源
班级
学情分析
评价体系
```

The existing `推荐学习` module should become part of the video/point resource module. Recommendation labels may still be shown when data exists, and old teacher must be able to set or unset them through the old-scoped recommendation association table.

The existing `AI出题与题库` module should become `题库资源` or similar. It should explain AI-assisted question-bank construction and teacher review as already-supported platform capabilities, while showing counts, coverage, and status.

The existing `学情分数` module can be expanded into `学情分析` and/or `评价体系`, with a reviewer-friendly explanation of BKT score semantics.

### 4. Keep the core path video-first

The teacher demo should mirror the student demo's main path:

```text
实验视频资源
  -> 学生学习
  -> 测评答题
  -> BKT 掌握度更新
  -> 教师查看学情
  -> 推荐复习 / 智能组卷权重
```

Video resources should therefore be the primary evidence path. The old teacher video page should support scanning by chapter/path, point, video availability, question coverage, recommendation labels, and a narrow recommendation toggle.

### 5. Expose BKT score evaluation as an explicit reviewer-facing model

Do not force reviewers to infer what `mastery_score` means from tables. The old teacher demo should include a stable evaluation-system section that explains:

- evaluated objects: experiment point, experiment, experiment group, student, class;
- evidence sources: video learning, assessment answers, wrong answers, post-learning tests, reports;
- update mechanism: BKT-style mastery update based on correctness and evidence count;
- score bands:
  - `0-59`: needs focused review;
  - `60-79`: basically mastered, should consolidate;
  - `80-100`: good mastery, can move to harder or integrated practice;
  - no evidence: not yet measured;
- outputs: class dashboard, weak-point ranking, student report, video review direction, assessment composition weights.

The old teacher UI may show `BKT`, `掌握度`, `薄弱点`, `分数评价`, `证据数`, and `复盘建议`; it must not show TKE/TKT internals, raw probability vectors, provider/model names, or Agent/RAG trace language.

### 6. Prefer aggregation over new storage

No new table should be required for the teacher demo. If old teacher needs a combined payload, build it from existing shared tables/read models and the existing old-only recommendation association table.

Possible aggregation sources:

- `formal_experiments`, catalog nodes, `media_bindings`, `media_assets`;
- `experiment_questions`, `experiment_question_drafts`;
- `classes`, `teacher_classes`, `roster_entries`, `student_profiles`;
- `experiment_question_attempts`, `student_events`;
- `student_experiment_progress`, `student_experiment_mastery`;
- `student_smart_assessment_sessions`, `student_assessment_reports`.

If an existing old-scoped recommendation association table already exists, the teacher demo may read it as evidence and the old teacher video page may update it as the only allowed old teacher write operation.

### 7. Make read-only behavior testable

Frontend tests should fail if old teacher sends non-GET requests after login, except the allowed old-only recommendation `PUT`. Backend route inventory or targeted tests should prove the new `teacher-demo` endpoints are only GET routes, while the existing legacy recommendation route remains outside that namespace. UI tests should scan visible text for forbidden terms and for absence of broad mutation labels such as `创建`, `保存`, `发布`, `导入`, and `重置密码` where those labels imply live operations.

## Risks / Trade-offs

- **Risk: Judges may expect to see teacher control ability** -> Mitigation: present process evidence and statuses, not live controls; label it as a teaching evidence console.
- **Risk: Current read APIs expose too much operational detail** -> Mitigation: use old-scoped DTOs that shape only demo-safe fields.
- **Risk: Existing old teacher tests expect broad write actions** -> Mitigation: invert those tests to assert no non-GET requests except old-only recommendation maintenance and no broad mutation controls.
- **Risk: Aggregating many metrics can be slow** -> Mitigation: limit payload sizes, return top-N rows, and reuse existing analytics read models.
- **Risk: Recommendation toggles are mistaken for full admin capability** -> Mitigation: keep them scoped to video resources and use the existing old-only recommendation route only.
- **Risk: Old and current teacher semantics drift** -> Mitigation: keep old teacher under a legacy namespace and avoid changing current admin APIs or current teacher UI.
- **Risk: Existing mojibake/old copy reduces demo credibility** -> Mitigation: rewrite old teacher visible copy in clean Chinese during implementation and keep forbidden-term tests.

## Migration Plan

1. Add old-scoped teacher demo schemas and read models.
2. Add `GET /api/admin/legacy/teacher-demo/*` endpoints and route inventory tests.
3. Rewrite `web-teacher-old/src/api.ts` so teacher demo data functions are read-only except the old-only recommendation toggle.
4. Rework `LegacyTeacherApp` navigation and pages around evidence modules.
5. Replace broad mutation-oriented tests with demo-safe behavior tests.
6. Run old teacher typecheck/tests/build and backend route/read-model tests.
7. Validate at `web-teacher-old` default port `15177`.

Rollback is straightforward because current operational teacher/admin APIs remain unchanged. If needed, the old teacher demo endpoints/pages can be hidden or reverted without affecting current `web-teacher`.

## Open Questions

- Should the old teacher demo include a drilldown from class matrix to individual student report detail in the first implementation, or should it stop at class/weak-point aggregate views?
- Should the evaluation-system page be entirely static copy backed by constants, or should it include live score-band counts from the selected class?
- Should existing legacy recommended-learning rows keep their current sort-order behavior after teachers update labels from the old teacher page?
