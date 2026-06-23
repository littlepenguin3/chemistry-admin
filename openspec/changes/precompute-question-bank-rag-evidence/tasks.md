## 1. Data Model And Retrieval Core

- [x] 1.1 Add migrations for section evidence roles, partial evidence status, retrieval fingerprints, and cache-path cleanup/deprecation.
- [x] 1.2 Add textbook evidence retrieval helpers that return selected evidence and candidate diagnostics per point section.
- [x] 1.3 Update static evidence payload hydration to expose section roles, source boundary, fingerprints, selected evidence, and candidate diagnostics.

## 2. Evidence Refresh Jobs And APIs

- [x] 2.1 Replace `rag_evidence_refresh` processing with Qwen ES textbook retrieval and sectioned evidence binding writes.
- [x] 2.2 Add question-bank evidence refresh APIs for current chapter and selected point, with force/skipped counts and Qwen call estimates.
- [x] 2.3 Add refresh/generation readiness payloads that separate Qwen/ES refresh health from DeepSeek generation health.
- [x] 2.4 Add tests for sectioned binding writes, partial/missing states, and refresh API route registration.

## 3. Question Generation Path

- [x] 3.1 Change workbench evidence loading to read precomputed fresh/partial bindings only.
- [x] 3.2 Remove dynamic Qwen retrieval fallback and stop using `textbook_rag_evidence_cache` as a generation source.
- [x] 3.3 Preserve point three-part content and selected evidence in the LLM prompt, deduplicating repeated chunk text while retaining section roles.
- [x] 3.4 Add tests that generation is allowed with precomputed evidence and blocked without it, regardless of Qwen refresh health.

## 4. Teacher Question-Bank UI

- [x] 4.1 Add refresh current chapter and selected point controls with paid-operation confirmation copy.
- [x] 4.2 Show chapter evidence summary, point evidence states, refresh readiness, and generation readiness separately.
- [x] 4.3 Show selected evidence and candidate diagnostics in the workbench context without sending candidates to generation.
- [x] 4.4 Add or update frontend type/display tests for the new readiness and evidence status states.

## 5. Verification

- [x] 5.1 Apply migrations locally and verify the backend starts with the new schema.
- [x] 5.2 Run targeted backend tests and frontend typecheck/build.
- [x] 5.3 Open the local question-bank page, verify it loads without console errors, and verify refresh/generation status surfaces render correctly.
- [x] 5.4 Smoke-test service APIs for catalog question-bank loading, evidence refresh enqueueing, and workbench generation gating.
