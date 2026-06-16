## Context

The current repository contains a working education admin platform with real production-like domains: formal experiments, a point-aware question bank, a knowledge framework, RAG chunks and embeddings, learning-assistant evidence, class/student workflows, feedback, media resources, Docker services, and migrations. The code and resources grew through multiple implementation rounds, leaving current release data mixed with historical audit files, generated review packets, video intermediates, screenshots, caches, and large local media.

The key production risk is not simply file size. It is that the current system of record is partly implicit:

- 77 formal experiments live in `data/seed/formal_experiments.json`.
- The JSON fallback knowledge framework in `data/processed` represents 11 chapters, 133 units, and 385 knowledge points.
- Canonical RAG chunks live outside the repo under `E:\chemistry-rag\data\rag_ready\chunks`, with 3288 textbook chunks and 349 experiment chunks.
- Canonical embeddings live under `E:\chemistry-rag\data\rag_ready\embeddings\canonical_base_v1`, with 3637 embeddings.
- The current imported point-aware question bank is `artifacts/point-aware-question-bank/reviewed_old_bank_chunks/slim_release_work_v1/rebuilt_question_bank_merged_v1.json`, with 2310 questions.
- The current experiment point inventory is `artifacts/point-aware-question-bank/formal_experiment_point_inventory.json`, with 300 experiment points.
- The current point-to-chunk evidence binding is `artifacts/video-point-default-evidence/gpu-rerank-direct-v2-20260616T1140Z/manual-reviewed-from-start-20260616T2135Z/manual_reviewed_point_evidence.jsonl`, with 300 point bindings. Despite the path name, this is core learning evidence, not disposable video output.

Productionization should therefore start with durable resource boundaries before large code moves. Once the platform can be rebuilt from stable resources and manifests, frontend and backend modularization can proceed with much lower risk.

## Goals / Non-Goals

**Goals:**
- Preserve every current system resource used by the platform: knowledge framework, formal experiments, point inventory, question bank, canonical chunks, embeddings, point evidence bindings, schemas, and current import reports.
- Move or mirror protected resources into clear production seed/resource locations and record count/checksum manifests.
- Make destructive cleanup impossible unless protected resource validation succeeds.
- Remove or archive historical audit materials, obsolete generated packages, transient video/rerank outputs, UI screenshots, caches, local build outputs, and stale media files that are not current system dependencies.
- Split later code work into behavior-preserving refactors with stable validation after each phase.
- Establish a local/CI validation chain that proves the current system can still build, test, and rebuild core data.

**Non-Goals:**
- Do not change teacher/admin/student feature behavior in this change.
- Do not rewrite the question bank, regenerate embeddings, or alter evidence ranking semantics as part of cleanup.
- Do not delete protected current resources, even if they live under an artifact path with a misleading historical name.
- Do not perform broad frontend/backend rewrites before the resource manifest and cleanup guardrails exist.
- Do not commit local dependency directories, generated frontend builds, temporary logs, or test caches as production resources.

## Productionization Tracks

### 1. production-resource-consolidation

Create stable production resource locations and manifests. A suitable target shape is:

```text
data/seed/formal_experiments.json
data/seed/knowledge_framework/
data/seed/question_bank/rebuilt_question_bank_merged_v1.json
data/seed/question_bank/point_aware_question_bank_schema.json
data/seed/experiment_points/formal_experiment_point_inventory.json
data/seed/point_evidence/manual_reviewed_point_evidence.jsonl
data/seed/manifests/core_resources.json
```

External canonical chunks and embeddings may either be mirrored into a documented resource directory or referenced by manifest entries with absolute/source path, count, size, and SHA256. The implementation decision can depend on repository size constraints, but the validation contract must be the same: a fresh environment must know exactly which resource version to use.

### 2. cleanup-legacy-artifacts

After protected manifests pass, remove or move historical materials out of the active repo:

- old point-aware review packets, rebuilt packages, semantic work packets, pilot reviews, and obsolete release files
- video-point raw candidates, smoke packages, rerank scratch outputs, and review packets except the final reviewed evidence file and its manifest/summary
- Playwright screenshots, root UI screenshots, `.tmp`, logs, pytest caches, frontend `dist`, frontend `node_modules`, Vite logs, and other generated outputs
- local video files under `data/media` only together with a database/UI plan for `media_assets` so the admin UI does not point to missing files

Cleanup must be reproducible and documented rather than an ad hoc manual deletion.

### 3. frontend-admin-modularization

Split `apps/admin-web/src/App.tsx` and `apps/admin-web/src/styles.css` by route, feature, reusable component, API client, and style scope. Keep current routes and UI behavior intact. Large modules such as charts, KaTeX, Uppy/tus uploads, learning assistant, videos, and question-bank workbench should be lazy-loaded where page boundaries allow.

### 4. backend-admin-router-split

Split `server/app/experiment_admin.py` into routers and services around existing domain boundaries: experiments, question banks, workbench, analytics, learning resources, media, and student submissions. Preserve existing endpoint paths, request/response shapes, permissions, and database behavior unless a later feature spec explicitly changes them.

### 5. production-ops-hardening

Normalize migration numbering from the next migration forward, maintain `.env.example`, document backup/restore, keep Docker health checks accurate, add production-readiness validation, and make the CI/local validation chain explicit.

## Decisions

### Start With Resources, Not Code Split

The first implementation phase should consolidate and validate resources before deleting old artifacts or moving large modules. This makes the current data state recoverable and gives later refactors a clear invariant.

### Treat The Reviewed Point Evidence As Core Data

The final `manual_reviewed_point_evidence.jsonl` lives under a video-named artifact directory, but it is the current point-to-canonical-chunk evidence binding for the learning assistant. Cleanup rules must classify it as protected core data.

### Validate Counts And Hashes Before Destructive Cleanup

Protected resources must have a manifest that captures at least path, required/optional status, count, size, SHA256, and semantic role. Cleanup scripts should refuse destructive operations if any protected resource fails validation.

### Prefer Equivalent Refactors

Frontend and backend splits should be mechanical, domain-oriented refactors. Any feature behavior change, endpoint contract change, question content change, or evidence semantic change should get a separate OpenSpec change.

### Preserve A Thin Current-State Commit

This change should be committed separately from unrelated dirty work so it can serve as the durable refactor starting point. The commit should include only the productionization OpenSpec artifacts.

## Risks / Trade-offs

- [Risk] External canonical chunks/embeddings may be unavailable on another machine. -> Mitigation: manifest them explicitly and decide whether to mirror them before declaring production readiness.
- [Risk] Deleting `data/media` without DB cleanup can leave broken admin records. -> Mitigation: treat media cleanup as a guarded task requiring DB/UI consistency handling.
- [Risk] Large module splits can accidentally change UI or API behavior. -> Mitigation: split after resource consolidation, keep endpoint contracts stable, and run tests/typecheck/build after each phase.
- [Risk] Old artifacts may contain the only copy of a current resource. -> Mitigation: core manifest validation must happen before removal, and cleanup rules must whitelist protected files even under historical directories.

## Validation Strategy

Production-readiness validation should include:

- resource manifest validation with counts and SHA256 checks
- database/core data validation for current counts: 77 active formal experiments, 11 chapters, 133 units, 385 knowledge points, 300 experiment points, 2310 questions, 3637 chunks, 3637 embeddings, and 300 point evidence bindings
- import/rebuild dry run or documented restore path from seed/resources to an empty database
- backend tests with `python -m pytest`
- frontend typecheck, tests, and build
- `openspec validate --strict` for active changes and specs
- targeted smoke checks for admin routes and learning-assistant evidence behavior after refactor phases

## Open Questions

- Should canonical chunks and embeddings be copied into this repository, stored in an external versioned data package, or referenced by a manifest with restore instructions?
- Should local uploaded videos be completely removed from the production baseline, or should a tiny placeholder/sample media set remain for UI smoke tests?
- Should cleanup move historical materials to an external archive location first, or delete them directly after manifest validation?
