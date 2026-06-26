## Why

The legacy student report surface is currently too thin for a competition demo: students can see a score summary, but they cannot understand why they got questions wrong or what the BKT/TKE-style learning signal means in plain language. The old product should still hide the modern Agent/RAG/Atom product line, but it can present legacy-facing AI teaching support such as AI learning summaries and AI wrong-question explanations.

## What Changes

- Rename the old student bottom navigation entry from `我的` to `报告` and reposition the page as a learning-report center rather than a personal center.
- Keep the student identity card on the report page, but make the main content a list of learning reports.
- Add an old-style report detail page for each assessment report.
- Show student-facing AI learning summaries in each report detail, translating internal BKT/TKE/TKT-style signals into readable conclusions without exposing those terms or raw mastery scores.
- Show wrong-question review in each report detail, including question stem and a true AI-generated teaching explanation for the completed attempt.
- Use the existing backend AI/assessment-agent report generation path to produce the old report summary and mistake explanation; local deterministic text is only a failure fallback, not the normal "AI" path.
- Keep legacy report AI independent from the modern Agent/RAG/Atom UI surface and avoid exposing provider, retrieval, model, chunk, embedding, or diagnostic wording.
- Do not change current `web-student`, current assessment-report APIs, or mainline report UI behavior merely to support the old report experience.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bkt-legacy-competition-profile`: change the old student report/navigation contract and add legacy-facing AI summary and wrong-question explanation requirements.

## Impact

- `apps/web-student-old`: bottom navigation label/icon semantics, report list page, report detail route, old report display components, and tests.
- `server/app/api/student/student_legacy.py` and old-scoped report domain code for legacy report shaping while reusing the current AI report generation chain.
- Existing report tables and assessment payloads may be read, but no old-only question, experiment, mastery, or report identity fork should be introduced.
- OpenSpec main capability `bkt-legacy-competition-profile` receives new requirements after archive.
