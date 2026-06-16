## Context

The learning assistant is now used as a multi-turn chat simulation for the student learning page. Students are expected to arrive from a chapter page and often select a video-point prompt. Today that point context is mostly encoded in natural language, while the backend request only receives chapter/experiment fields and the optional RAG flag.

The current policy gate runs before answer generation and does not receive conversation history or a resolved follow-up question. It can therefore misclassify short follow-ups such as "why" and normal point explanation prompts as out-of-scope or resource availability requests.

The current platform-resource rail is intended to prevent fabricated claims about published videos or files. Its keyword boundary is too broad: ordinary point explanations that mention videos/materials can be routed to `published_resource_lookup`, producing "no published resources" instead of answering the learning question.

## Goals / Non-Goals

**Goals:**
- Treat chapter/experiment/video-point context as the base learning context, independent from optional RAG lookup.
- Add structured `point_key` support to learning assistant requests and debug prompt suggestions.
- Build a fixed point evidence package when point context is present.
- Make guardrail decisions context-aware by using recent conversation context or a resolved question before policy classification.
- Restrict platform resource availability handling to actual published-resource inventory questions.
- Keep RAG as supplemental recall/rerank for broader theory and figures.

**Non-Goals:**
- Do not require the model to understand video pixels or decode video content.
- Do not replace the hybrid BGE RAG service.
- Do not alter teacher-facing question-generation guardrails.
- Do not guarantee every point has perfect textbook evidence; missing evidence should be visible and handled gracefully.

## Decisions

### Manual-reviewed video-point evidence is the fixed source

The offline GPU rerank spike has been completed and manually reviewed from the beginning. The final artifact is `manual_reviewed_point_evidence.jsonl`, covering all 300 formal experiment video points with no duplicate `point_key` values, no bad chunk ids, and `manual_reviewed=true` on every row. Its quality grades are `pass`, `usable`, and `weak_but_best_available`.

This reviewed artifact is not a runtime RAG service and does not replace `source_chunks`. It is a point-to-existing-chunk binding layer:
- `experiment_id` and stable `point_key` identify the formal experiment video point;
- `experiment_chunk_ids` are direct experiment/procedure/phenomenon evidence;
- `theory_chunk_ids` are supporting textbook theory evidence;
- `review_grade` is surfaced in diagnostics so weaker best-available bindings are visible.

The application should import this reviewed artifact into a small read-only database binding table. The student learning assistant then reads this table by `(experiment_id, point_key)` and hydrates source previews from `source_chunks`. Raw candidate artifacts and the temporary GPU service remain offline-only and are not part of the online answer path.

Question-bank `source_audit` metadata is no longer a point evidence source for the student assistant. It may remain useful for historical questions or teacher workflows, but the student assistant must not depend on finding an existing question before it can explain a selected video point, and it must not use question-bank rows as the fallback fixed evidence path.

### Structured point context is the stable contract

Learning assistant requests will accept an optional `point_key`. The frontend prompt card will send `chapter_id`, `experiment_id`, `point_key`, and the student-facing question. The text can stay natural, but backend behavior must not rely on parsing the point title from that text.

Alternative considered: keep embedding the point in the prompt only. This is fragile for guardrails, diagnostics, and fixed evidence assembly.

### Point evidence package precedes RAG

The agent will assemble a point evidence package before optional RAG lookup. Sources include:
- selected chapter and experiment metadata;
- selected experiment video point metadata;
- manual-reviewed point evidence bindings for the selected `(experiment_id, point_key)`;
- available source previews/assets for the reviewed experiment and theory chunk ids.

This package is passed to the model regardless of `allow_rag_lookup`. Hybrid RAG may still add broader theory/figure evidence when enabled.

Alternative considered: put all point lookup through BGE. This makes point explanations fail when RAG is off or slow. Alternative considered: infer point evidence from existing question-bank `source_audit`; this reverses the dependency and fails for points that have no accepted question yet.

### Policy classification uses resolved context

Before model policy classification, the backend will create a lightweight resolved context:
- current raw question;
- short conversation history;
- previous in-scope topic if the current question is a short follow-up;
- structured chapter/experiment/point fields.

The policy gate will classify against the resolved question/context. Deterministic safety and assessment checks still win.

Alternative considered: only send full history to the final answer model. That is too late because policy gating can already short-circuit the request.

### Platform resource rail is inventory-only

The platform resource path applies only to availability/lookup questions such as "is there a published video", "where can I watch/download", or "has the teacher uploaded this material". It does not apply to "explain this video point", "use the material to explain", "what does this figure show", or follow-up conceptual questions.

If inventory lookup finds nothing, the assistant answers normally with "not published/found" rather than labeling the turn as a safety refusal.

## Risks / Trade-offs

- [Risk] A small number of reviewed rows are `weak_but_best_available` -> Surface the grade in diagnostics and instruct the model not to overstate source strength.
- [Risk] The reviewed evidence artifact may be missing from a fresh database -> Provide an explicit import step and diagnostics rather than silently falling back to question-bank evidence or RAG-only behavior.
- [Risk] Resolved follow-up may inherit the wrong prior topic -> Only inherit context for short/deictic follow-ups and preserve raw question in diagnostics.
- [Risk] Resource rail may become too narrow -> Keep explicit resource availability patterns and tests for published-resource lookup.

## Migration Plan

1. Add schema fields and frontend prompt metadata without removing existing natural-language prompt behavior.
2. Add manual-reviewed point evidence import/read path plus point evidence package diagnostics.
3. Update policy-gate payload and deterministic classifier.
4. Update debug UI to show point context and route prompt cards with `point_key`.
5. Add tests covering RAG-disabled point explanation, resource lookup, and multi-turn follow-up.

Rollback is straightforward: ignore `point_key` in requests and retain current RAG behavior. Existing clients without `point_key` continue to work.
