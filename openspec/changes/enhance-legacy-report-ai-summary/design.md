## Context

The legacy student product already has four modules and a SYSU-red old-style shell. Its current fourth module is visible as `我的`, but the intended legacy competition narrative is not a personal-center product; it is an experiment-learning feedback loop. The user-facing fourth module should therefore become `报告`.

Current backend state:

- Smart/custom/point assessment submission produces a `StudentSmartAssessmentReport` with score, wrong answers, `next_recommendation`, mastery change fields, and question-level `explanation` when the question bank has one.
- The mainline `/api/student/smart-assessment/submit` path also calls `create_smart_assessment_report`, which can generate and store `summary` and `mistake_explanation` in `student_assessment_reports`.
- The legacy submit path must reuse the mainline assessment report generation capability so the old report is produced by the real AI-backed report chain, not by a local template pretending to be AI.
- `student_assessment_reports` already supports persisted report summaries, generated summary text, generated mistake explanation text, and raw payload snapshots.

The old report experience should use these data sources, but it must not expose TKE/TKT labels, raw mastery probabilities, raw BKT state vectors, provider names, model names, RAG diagnostics, Agent wording, or any modern assistant UI.

## Goals / Non-Goals

**Goals:**

- Rename the old fourth student module from `我的` to `报告`.
- Keep the student information card at the top of the report page as identity context, not as the main purpose of the module.
- Render a report list that shows the student's completed learning/assessment reports.
- Add a report detail view that is useful to students: score overview, AI learning summary, wrong-question explanations, and next-step review advice.
- Hide TKE/TKT/raw mastery score concepts from students. Students should read conclusions such as "本次主要薄弱点在氯气制备与氧化性判断", not "TKE=0.42" or "mastery_score=42".
- Allow legacy-facing AI capability in the form of "AI学情摘要" and "AI错题解析", while keeping Agent/RAG/Atom implementation language invisible.
- Prefer persisted AI assessment-report summary and mistake-explanation text. Deterministic fallback text remains only for AI unavailable/error cases and must not be labeled as a successful AI generation.
- Keep all new backend behavior old-scoped or legacy-scoped when mainline endpoints are not a safe fit.

**Non-Goals:**

- Do not introduce a new old-only question bank, old-only report identity, old-only mastery state, or separate legacy database.
- Do not expose the modern student AI assistant, Atom workspace, RAG retrieval controls, provider settings, or diagnostic trace UI in old reports.
- Do not make students inspect TKE/TKT/BKT numeric internals.
- Do not let answer submission hang indefinitely on slow AI report generation; if generation fails, store a fallback report and let the report detail retry/hydrate from the completed session on demand.
- Do not change current `web-student` report UI or mainline assessment report semantics merely for the old product.

## Decisions

### 1. Treat `报告` as a learning-report center, not a personal profile page

The old bottom navigation should show `主页 / 学习 / 评测 / 报告`. The report page may keep the current student identity card because competition reviewers need to see the student/class context, but the page title and content should be report-oriented.

Alternative considered: keep `我的` and add report content below it. This keeps implementation small, but the product reads like a personal-account page and weakens the BKT feedback-loop narrative.

### 2. Add a report detail route instead of expanding every report inline

The report list should remain compact. Each report row/card opens a detail view. The detail view can then show AI summary and wrong-question explanations without making the report list too tall.

Suggested old routes:

- `/reports`: report list
- `/reports/:reportId`: report detail loaded from backend/persisted report if available
- optionally `/reports/session/:sessionId`: transient detail for the just-submitted legacy session before persisted report lookup is complete

The exact route names can follow existing old `pushState` patterns, but visible navigation should say `报告`.

### 3. Use old-scoped report adapters for generation and fallback

The old product should not visually surface the modern Agent/RAG report flow, but the backend may call the existing assessment-agent report generation path. If persisted `student_assessment_reports` already exists, the old frontend can read a legacy-shaped projection of it. If a just-submitted legacy assessment only has a lightweight `StudentSmartAssessmentReport`, the old-scoped adapter should call the current AI report generator, then expose only legacy-facing fields.

Recommended backend shape:

- Reuse existing `student_assessment_reports` rows when available.
- Add a legacy-namespaced route when needed, for example:
  - `GET /api/student/legacy/reports`
  - `GET /api/student/legacy/reports/{report_id}`
  - `POST /api/student/legacy/smart-assessment/report` or create report as part of legacy submit if it remains fast and bounded
- The adapter should call current AI report generation first.
- The adapter must sanitize all AI errors and unsafe/internal responses into legacy-facing fallback text.

This preserves the old frontend boundary while ensuring the report content is actually generated by the configured AI capability in the normal path.

### 4. Explain wrong answers per question, not as one global paragraph

Question explanations should be credible and should stay attached to the wrong question that caused them. The old UI should not render a single full-width `AI错题解析` paragraph above the wrong-question list because it is hard to scan and pushes per-question context out of view.

Use this visible precedence for each wrong-question card:

1. Structured per-question AI explanation if a future backend adds one.
2. Stored question `explanation` from the current question bank or report payload, displayed as `AI 解析` for the legacy teaching narrative.
3. Local fallback template:
   - "本题应先识别题干中的实验现象/试剂/条件，再对照正确选项判断。建议回看相关实验点位。"

The old card should show `做错项` and `正确选项` as compact rows, then show the per-question `AI 解析` block. Persisted report-level `mistake_explanation` can remain in the backend payload for provenance/fallback, but it should not be the primary visible interpretation when per-question cards are available.

### 5. Translate internal mastery signals into prose, not scores

The report detail can read `mastery_changes`, wrong answer count, covered experiments, point titles, score, and next recommendation. It should not display raw `mastery_score`, `mastery_prob`, `TKE`, `TKT`, probability vectors, or low-level algorithm terms to students.

Example student-facing phrasing:

- "本次错题集中在卤素氧化性判断和实验现象辨认。建议先复盘氯水、溴离子、碘离子相关点位，再完成一轮学后测评。"
- "本轮测试覆盖 9 个实验点位，答对 4/10。系统判断你需要优先巩固试剂颜色变化和反应先后顺序。"

Teacher-facing analytics can still expose richer mastery/score details elsewhere if already supported, but this change concerns old student visible reports.

### 6. Keep submission responsive

Legacy submit should attempt to create the AI report immediately through the current report generator. If that generation errors or becomes unsafe, prefer:

- submit still returns the score result with a fallback report record when possible;
- result page offers `查看报告` and report detail can retry/hydrate AI text from the completed session on demand;
- report detail endpoint can generate or hydrate AI text on demand;
- failed generation falls back to local text without calling that text a successful AI generation.

This preserves the old competition flow while keeping the normal path honest: successful report interpretation is AI-generated.

## Risks / Trade-offs

- **AI generation can be slow or unavailable** → Attempt real AI generation first, then use stored explanations and deterministic fallback text only as failure protection.
- **"AI" wording could accidentally reveal Agent/RAG internals** → Keep all visible labels legacy-facing (`AI学情摘要`, `AI助学解析`) and add forbidden-term tests for report list/detail/error states.
- **Students may misunderstand BKT/TKE numeric evidence** → Do not show TKE/TKT/raw mastery numbers; translate signals into short conclusions and concrete review actions.
- **Duplicate report generation can create conflicting rows** → Use existing `student_assessment_reports` uniqueness by report type/session id or an equivalent idempotent old adapter.
- **Old report route could drift from mainline report data** → Reuse current report rows and current assessment session/question identities; add backend tests proving no old-only question/report identity fork.
- **Report detail may be empty for older lightweight legacy submissions** → Build detail from stored session/report payload when available; otherwise show a controlled "暂无解析，建议重新完成一轮测评" state rather than raw errors.

## Migration Plan

1. Update old student navigation and route handling so the fourth module is visibly `报告`.
2. Add old report list/detail frontend types and API functions.
3. Implement or adapt legacy report backend routes if the current `/api/student/assessment-reports` detail endpoints are insufficient for just-submitted legacy sessions.
4. Add old report detail UI with score overview, AI summary, wrong-question explanation list, and next-step action.
5. Add tests for visible copy, forbidden terms, no TKE/TKT/raw mastery numbers, and fallback behavior.
6. Run old frontend typecheck/tests/build and relevant backend route/report tests.

Rollback is straightforward: the old report UI can continue using the existing report list summary while the old report detail route is disabled or falls back to the current compact report card.
