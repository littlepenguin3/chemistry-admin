## 1. Legacy Report Navigation

- [x] 1.1 Rename the old student fourth navigation item from `我的` to `报告` while preserving the square bottom-nav visual language.
- [x] 1.2 Update old route handling so the report module opens a report-centered surface, with compatible redirect behavior for existing `/profile` or `/reports` routes if needed.
- [x] 1.3 Keep the student identity card on the report page, but remove visible copy that frames the page primarily as a personal center.
- [x] 1.4 Update old student tests to assert `报告` is visible and `我的` is not used as the module label.

## 2. Report List Experience

- [x] 2.1 Extend old student API types/functions for report summaries and report detail payloads, reusing current assessment/report identities.
- [x] 2.2 Render the report list as old-style square report rows/cards with title, completion time, score or answered count, wrong count, and review entry action.
- [x] 2.3 Add old-style loading, empty, and error states for report list loading.
- [x] 2.4 Ensure report list visible copy does not expose `TKE`, `TKT`, raw mastery score, raw mastery probability, JSON payloads, provider names, Agent/RAG wording, or retrieval diagnostics.
- [x] 2.5 Add old student tests for report list loading, empty state, student identity card, and forbidden terms.

## 3. Report Detail Experience

- [x] 3.1 Add an old report detail route such as `/reports/:reportId` using the existing lightweight old routing style.
- [x] 3.2 Render report detail with score/completion overview, report title, completion time, and old-style back navigation to the report list.
- [x] 3.3 Render an `AI 学情总结` section that presents natural-language conclusions and next-step review advice.
- [x] 3.4 Render a wrong-question section with stem, submitted answer, reference answer, and explanation for each wrong answer.
- [x] 3.5 Render a controlled `本次没有错题。` state for perfect reports.
- [x] 3.6 Ensure report detail does not show TKE/TKT/raw mastery values or modern Agent/RAG/Atom implementation wording.
- [x] 3.7 Add old student tests for report detail summary, wrong-question explanation display, no-wrong state, and forbidden terms.

## 4. Legacy Backend Report Adapter

- [x] 4.1 Decide whether current `/api/student/assessment-reports` detail is sufficient for old reports; if not, add legacy-namespaced report routes under `/api/student/legacy`.
- [x] 4.2 Implement old-scoped report detail shaping that can read current `student_assessment_reports`, smart assessment sessions, attempt rows, report payloads, and question explanations.
- [x] 4.3 Ensure old report routes reuse current student, report, session, experiment, question, and point identities.
- [x] 4.4 Ensure old report routes do not require old-only report ids, old-only question records, old-only mastery rows, old-only seed records, or a separate legacy database.
- [x] 4.5 Register old report routes in the backend app and backend route inventory if new routes are added.
- [x] 4.6 Add backend tests for route registration, student auth boundary, shared identity reuse, and controlled legacy-facing errors.

## 5. AI Summary and Question Explanation

- [x] 5.1 Reuse the current AI assessment-report generation chain for legacy smart/custom/point assessment reports.
- [x] 5.2 Expose persisted AI `summary` and `mistake_explanation` through legacy-shaped report detail payloads.
- [x] 5.3 Keep deterministic local fallback builders only for AI unavailable/error/unsafe cases.
- [x] 5.4 Ensure answer submission remains bounded and report detail can hydrate/retry from completed session payloads.
- [x] 5.5 Ensure generated/fallback text may use `AI总结`, `AI学情总结`, `AI错题解析`, `掌握度`, `薄弱点`, `复盘建议`, and `解析`, but not Agent/RAG/Atom/provider/retrieval/TKE/TKT terminology.
- [x] 5.6 Add tests proving AI mistake explanation is exposed as legacy-facing `ai_generated` text and fallback remains useful.

## 6. Validation

- [x] 6.1 Run old student typecheck, tests, and production build.
- [x] 6.2 Run backend tests for any new or changed old report routes.
- [x] 6.3 Run backend route inventory tests if route inventory changes.
- [x] 6.4 Run `openspec validate enhance-legacy-report-ai-summary --strict`.
- [x] 6.5 Manually inspect old report list/detail at mobile width to confirm square SYSU-red styling, readable text, and no overlap with the bottom navigation.
