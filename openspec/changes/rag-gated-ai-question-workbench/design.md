## Context

The learning assistant admin page already implements the strongest AI interaction pattern in this codebase: it polls `/api/admin/learning-assistant/runtime`, renders RAG/BGE health, streams multi-turn chat, and exposes retrieval diagnostics from `rag_trace`. The question-bank AI workbench is persistent and non-mutating, but it currently opens as a generation drawer from the selected experiment/question and uses static `source_refs` loaded from canonical evidence ranking. That makes AI repair/create feel detached from the RAG evidence path that teachers trust.

The desired teacher workflow is evidence-first:

```text
Create: chapter -> experiment -> one/many video points -> reranked RAG chunks -> prompt refinement -> AI candidates -> validation/publish
Repair: chapter -> experiment -> bound question/points -> reranked RAG chunks -> prompt refinement -> AI repair candidates -> validation/publish
```

The guardrail is product-level, not merely UI-level: teachers should not directly edit question structure in this workflow because the question schema, answer shape, point bindings, source audit, and option diagnostics must stay machine-valid.

## Goals / Non-Goals

**Goals:**
- Reuse the learning assistant RAG runtime health contract on the question-bank page.
- Disable AI repair/create starts and message sends unless RAG is healthy enough for grounded suggestions.
- Make the workbench context panel show the selected experiment, selected/bound points, evidence package, and RAG status before generation.
- Support create sessions for single-point or multi-point targets.
- Preserve the existing persistent session, turn history, candidate validation, rejection, and publish behavior.
- Add backend enforcement so disabled UI cannot be bypassed.

**Non-Goals:**
- Do not let teachers directly edit generated question JSON in this change.
- Do not replace the learning assistant RAG implementation.
- Do not change student-facing learning assistant behavior.
- Do not promote generated suggestions into the imported default bank automatically.
- Do not require a schema migration unless the existing JSON context snapshots can carry the new fields.

## Decisions

### Use learning-assistant runtime as the gate source

The frontend will reuse `/api/admin/learning-assistant/runtime` to derive a question workbench gate:

```text
rag_runtime.rag_enabled
AND rag_runtime.hybrid_bge_enabled
AND rag_runtime.query_generation_enabled
AND bge_status == healthy
```

This matches the operational truth already shown on the learning assistant and AI access surfaces. The UI can still show explanatory states such as RAG closed, BGE unreachable, or query generation disabled.

Alternative considered: add a separate question-bank runtime endpoint first. That would duplicate health logic before the workflow actually needs a different runtime contract.

### Enforce the gate server-side

Workbench session creation and message generation will check the same effective AI/RAG settings plus BGE health before creating sessions or generating candidates. UI gating improves clarity, but backend gating is required because these endpoints are teacher/admin APIs.

Alternative considered: only disable buttons in React. That would still allow direct API calls to produce source-light suggestions.

### Store evidence diagnostics in existing context JSON

The existing `context_snapshot`, generation `rag_sources`, and turn/candidate metadata are enough to carry:
- selected point keys and point titles
- source refs
- RAG health summary
- retrieval trace or a compact diagnostic
- gate decision and reason

This avoids a migration. If later analytics need queryable evidence runs, a dedicated workbench evidence table can be added.

Alternative considered: add normalized tables for workbench evidence immediately. That is heavier than needed for the current workflow and risks slowing the UI iteration.

### Create mode supports multi-point context, repair mode remains question-bound

Create sessions may target multiple point keys under one experiment. The generated candidate must preserve point bindings and source audit. Repair sessions should derive bound points from the selected question and let the teacher refine intent without changing the target structure manually.

Alternative considered: keep one point per create session. That conflicts with the desired multi-point experiment-level authoring flow and forces teachers to open too many sessions.

### Workbench UI follows the learning assistant layout grammar

The drawer can stay for this change, but its internal hierarchy should become:

```text
left: context/evidence/RAG gate
middle: teacher prompt chat
right: candidate versions/validation/publish
```

The composer should remain visible with a current context strip. Candidate controls remain validation-gated.

Alternative considered: build a new full route immediately. That may be better later, but the existing workbench state and screenshots already validate a drawer entry point.

## Risks / Trade-offs

- [Risk] Local development may often have RAG or BGE unavailable, blocking teacher AI testing. -> Mitigation: show a clear disabled state with the exact missing runtime condition and keep non-AI question browsing available.
- [Risk] Multi-point generation can create diffuse candidates. -> Mitigation: cap point selection in the UI initially and record all target point keys in the context snapshot for validation.
- [Risk] Static `source_refs` and hybrid RAG traces may disagree. -> Mitigation: label evidence source explicitly and prefer hybrid reranked evidence when the gate is healthy.
- [Risk] Backend BGE health checks can add latency to workbench starts. -> Mitigation: use a short timeout and fail closed with a readable reason.

## Migration Plan

1. Add RAG gate helpers on the frontend and backend.
2. Extend workbench request/context handling to carry multi-point target context and evidence diagnostics in existing JSON fields.
3. Update the question-bank workbench UI to show gate/evidence state and disable AI actions when unhealthy.
4. Add focused tests for server-side gate behavior and run frontend validation.

Rollback: remove the frontend gate and server checks, while leaving any additional context JSON fields ignored by older UI behavior.

## Open Questions

- Should a future admin override allow local template generation when RAG is down, or should all question-bank AI authoring stay fail-closed?
- Should repair publication eventually support explicit replace/disable-original/add-as-new choices in the first publish modal?
