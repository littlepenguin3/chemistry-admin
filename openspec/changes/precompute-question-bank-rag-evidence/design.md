## Context

The current question-bank workbench can generate point-aware objective questions with textbook RAG evidence. The latest implementation added a runtime cache around `retrieve_textbook_evidence`, but generation still attempts to retrieve textbook evidence when a teacher opens or uses the workbench. That means Qwen embedding/rerank availability remains part of generation availability, and paid Qwen calls can happen from an ordinary "generate" action.

The catalog tree already has a Postgres job model and evidence tables:

- `experiment_catalog_point_jobs`
- `experiment_catalog_point_evidence_state`
- `experiment_catalog_point_evidence_bindings`

Those tables are the correct business model for point evidence, but the current `rag_evidence_refresh` job path still uses the legacy hybrid/BGE retriever. The new design reuses the job/evidence tables while replacing the evidence refresh implementation with Qwen ES textbook retrieval and moving question generation to read only precomputed evidence bindings.

## Goals / Non-Goals

**Goals:**

- Let teachers explicitly refresh textbook evidence for the current chapter or current point from the question-bank page.
- Run Qwen embedding + ES recall + Qwen rerank during evidence refresh, not during question generation.
- Persist selected section evidence in `experiment_catalog_point_evidence_bindings`.
- Persist broader candidate evidence in evidence-state diagnostics for inspection only.
- Allow question generation when DeepSeek is available and selected points have fresh or partial evidence bindings, even if Qwen/ES/rerank is currently unavailable.
- Block question generation when selected points lack usable precomputed evidence.
- Stop using `textbook_rag_evidence_cache` as the authoritative question-generation path.

**Non-Goals:**

- No teacher manual chunk binding or chunk locking workflow.
- No automatic paid evidence refresh immediately after import.
- No DeepSeek calls during evidence refresh.
- No dynamic Qwen fallback when a point lacks precomputed evidence.
- No full candidate chunk dump in the LLM prompt.
- No requirement to implement cancellation or full refresh history in the first delivery.

## Decisions

### Use formal point evidence bindings as the only generation evidence source

Question generation will use `experiment_catalog_point_evidence_state` and `experiment_catalog_point_evidence_bindings` as the authoritative source of textbook evidence. The previous `textbook_rag_evidence_cache` table is a technical cache and will be removed or bypassed so there is one visible evidence state per point.

Alternative considered: keep using the cache table and mirror it into bindings. That creates two sources of truth and makes it possible for the UI to show one evidence state while generation reads another.

### Refresh evidence asynchronously per point

The question-bank page will enqueue point-level `rag_evidence_refresh` jobs for the selected chapter or selected point. Each point remains independently pending/running/succeeded/partial/missing/failed, so one bad point does not block the chapter.

Alternative considered: one large chapter job. That is simpler to enqueue, but harder to retry and more likely to time out or lose partial progress.

### Bind selected evidence by section

Refresh will retrieve separately for `principle`, `phenomenon`, and `safety`. Selected evidence bindings will record the section role, score/rerank score, source boundary, ES index, and source metadata. Generation will use selected evidence grouped by section and deduplicate repeated chunk text in the prompt while preserving section roles.

Alternative considered: bind a flat point-level chunk list. That loses which evidence supports which part of the point and makes partial evidence handling imprecise.

### Keep selected evidence small and candidate diagnostics broader

Selected evidence is capped at 3 chunks per section and is the only evidence sent to DeepSeek. Candidate diagnostics retain up to 20 reranked candidates per section with preview text and metadata, but not full chunk text.

Alternative considered: bind all candidates. That makes prompts noisy and expensive, and causes unrelated or weakly related chunks to influence generated questions.

### Treat partial evidence as usable but constrained

If at least one section has selected evidence, the point can be marked `partial` when other sections are missing. Generation can proceed but should only cover supported sections. If no section has evidence, the point is `missing` and generation is blocked for that point.

Alternative considered: require all three sections. That would unnecessarily block useful principle/phenomenon questions when only safety evidence is missing.

### Split refresh readiness from generation readiness

Qwen/ES/rerank health determines whether "refresh evidence" can run. DeepSeek plus precomputed evidence determines whether AI question generation can run. Generation must not fail only because Qwen is currently down when fresh/partial evidence already exists.

Alternative considered: keep a single "RAG available" gate. That preserves current behavior but defeats the purpose of precomputation.

### Refresh defaults skip fresh points

"Refresh current chapter evidence" should enqueue missing, stale, failed, and partial points by default and skip fresh points. A force option can reprocess all points in the chapter. The confirmation dialog should show point count and estimated maximum Qwen embedding/rerank calls.

Alternative considered: always refresh all points. That wastes Qwen calls and overwrites current evidence even when nothing changed.

## Risks / Trade-offs

- [Risk] Existing static evidence tables reference `source_chunks`, while Qwen ES textbook chunks may not have rows there. → Mitigation: either ensure canonical textbook chunks are available in `source_chunks` for selected bindings or relax the binding FK through a migration while retaining source metadata and boundary.
- [Risk] Section evidence roles require schema changes. → Mitigation: extend or replace the existing evidence-role check constraint and update payload mapping tests.
- [Risk] Background job processing may not be running in local dev. → Mitigation: expose an admin/manual processor endpoint or ensure the existing job worker can be invoked and verified locally.
- [Risk] Partial evidence can lead to missing-section question requests. → Mitigation: preserve supported/missing section diagnostics in the workbench prompt and validation lineage.
- [Risk] Removing dynamic fallback can temporarily block points without evidence. → Mitigation: show clear "refresh evidence first" actions and chapter coverage counts.

## Migration Plan

1. Add or adjust evidence-role/status schema for sectioned Qwen textbook evidence and partial evidence state.
2. Deprecate or drop the `textbook_rag_evidence_cache` table/code path from workbench generation.
3. Update `rag_evidence_refresh` processing to call Qwen ES textbook retrieval and write sectioned bindings.
4. Add question-bank APIs for chapter/point evidence refresh enqueueing and evidence refresh service status.
5. Update workbench generation to require static precomputed bindings and stop dynamic Qwen retrieval.
6. Update the question-bank page with refresh buttons, confirmation, progress/status, and separate refresh/generation availability labels.
7. Verify migrations, backend tests, frontend build, API behavior, and browser-visible service health.

Rollback: disable the new refresh action and fall back to existing evidence state if available. Published questions are not mutated by evidence refresh; generated candidates remain review-gated.

## Open Questions

- Whether canonical textbook ES chunk ids are guaranteed to exist in `source_chunks`. If not, the evidence binding FK needs to be relaxed or a dedicated textbook evidence binding table is needed.
- Whether local development should process refresh jobs inline after enqueue for easier teacher testing, or require the existing worker loop.
