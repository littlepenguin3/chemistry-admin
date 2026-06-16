## 0. Temporary Default Evidence Spike

- [x] 0.1 Start a temporary GPU BGE rerank service separate from the existing online `bge-rag` service, using local BGE-M3 and reranker models with 1024-token rerank length.
- [x] 0.2 Build a read-only batch script that enumerates all formal experiment video points from `formal_experiments.metadata.video_candidates` and reconstructs stable `point_key` values.
- [x] 0.3 For each point, recall experiment-chunk candidates and theory-chunk candidates from existing pgvector `chunk_embeddings`, keeping experiment/chapter scope signals but recording raw candidates.
- [x] 0.4 Rerank candidates on GPU and write per-point default experiment chunk ids, default theory chunk ids, raw candidate rows, vector scores, rerank scores, and source chunk text to an artifact directory.
- [x] 0.5 Spot-check known risky points such as SO2 bleaching versus SO3^2- detection, H2O2 oxidation/reduction, Hg(I) + KI, and AgX photosensitivity before considering the artifact usable by the assistant.
- [x] 0.6 Keep the GPU/raw-candidate spike temporary: do not update question-bank rows, do not alter published status, and do not put raw candidates or the temporary GPU service on the online path.

## 1. Request Contract

- [x] 1.1 Add optional `point_key` to learning assistant and agent request/response diagnostics schemas.
- [x] 1.2 Pass `point_key` through admin learning-assistant JSON and streaming endpoints.

## 2. Point Evidence Package

- [x] 2.1 Resolve selected experiment video point metadata from `experiment_id` and `point_key`.
- [x] 2.2 Collect point-linked question-bank source-audit chunk ids and expose a fixed point evidence package.
- [x] 2.3 Include point evidence in model prompt payload even when `allow_rag_lookup` is false.
- [x] 2.4 Add a database-backed manual-reviewed video-point evidence binding layer sourced from `manual_reviewed_point_evidence.jsonl`.
- [x] 2.5 Make the student learning assistant use manual-reviewed point evidence as the fixed/no-RAG fallback path and stop using question-bank `source_audit` for student point evidence packages.
- [x] 2.6 Expose manual review status, review grade, experiment evidence count, and theory evidence count in point-context diagnostics.

## 3. Policy Gate And Resource Rail

- [x] 3.1 Add resolved follow-up context and recent conversation summary to policy gate input.
- [x] 3.2 Narrow deterministic and model policy resource classification to platform availability questions only.
- [x] 3.3 Ensure true resource availability misses answer with factual unavailable state rather than safety/out-of-scope refusal.

## 4. Debug Console

- [x] 4.1 Send structured `experiment_id` and `point_key` when a centered point prompt suggestion is clicked.
- [x] 4.2 Show fixed point context diagnostics separately from supplemental RAG diagnostics.

## 5. Validation

- [x] 5.1 Add or update backend tests for RAG-disabled point explanation, resource availability lookup, and short follow-up context.
- [x] 5.2 Run OpenSpec validation, backend targeted tests, frontend typecheck, and frontend build.

## 6. Remaining Acceptance Gaps From Review

- [x] 6.1 Add an explicit UI acceptance task so true platform-resource misses are labeled as "resource unavailable/platform not found" rather than "guardrail/refusal" in the debug console.
- [x] 6.2 Decide and implement the point-context continuity rule for typed/manual prompts and follow-up turns: either carry the selected point context forward after a prompt card, or clearly show that the turn is chapter-only.
- [x] 6.3 Add an explicit image-evidence requirement/scenario: source figures and evidence images must stay in the evidence rail, must not be routed to platform resource availability, and the assistant may only reference images that exist in fixed point or RAG evidence assets.
- [x] 6.4 Add validation coverage for image-evidence behavior, including "image asset present" and "no image asset present" cases.
- [x] 6.5 Re-run OpenSpec validation, targeted backend tests, frontend typecheck, and frontend build after the remaining acceptance gaps are handled.
