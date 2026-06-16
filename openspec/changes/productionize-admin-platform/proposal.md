## Why

The project has reached internal-beta scale: core teaching workflows, RAG, question banks, learning analytics, uploads, and admin operations are real, but current resources and historical artifacts are still interleaved. Productionizing now prevents future refactors from accidentally losing the current knowledge framework, point-aware question bank, canonical chunks, embeddings, or manually reviewed evidence bindings.

## What Changes

- Add a production-readiness governance contract that defines protected core resources, disposable historical materials, and validation requirements before cleanup or refactor work.
- Consolidate the current system resources into stable seed/resource locations with manifest counts and SHA256 checksums.
- Replace artifact-relative defaults in import/rebuild scripts with stable production resource defaults, while keeping explicit override paths for maintenance work.
- Clean historical audit materials, old intermediate versions, video/transcode files, screenshots, caches, and build outputs only after the protected resource manifest passes.
- Split the productionization program into staged, behavior-preserving work: resource consolidation, legacy artifact cleanup, frontend modularization, backend router/service split, and operational hardening.
- Add one-command validation for data integrity, OpenSpec state, backend tests, frontend typecheck/test/build, and production-readiness checks.
- No functional behavior, API contract, question content, point binding, or current RAG evidence semantics should change as part of the cleanup/refactor baseline.

## Capabilities

### New Capabilities

- `production-readiness-governance`: Defines protected resources, cleanup boundaries, staged refactor guardrails, and validation requirements for turning the admin platform into a production-maintainable project.

### Modified Capabilities

None.

## Impact

- Data/resources: `data/seed`, `data/processed`, current question-bank artifacts, current point inventory, canonical chunks, embeddings, and manually reviewed point evidence bindings become explicitly protected by manifests.
- Scripts: import, validation, and cleanup scripts will use stable resource paths and refuse to run destructive cleanup when protected resources are missing or mismatched.
- Repository hygiene: historical review packets, temporary video/rerank outputs, UI screenshots, caches, generated builds, and local media files become removable only through documented cleanup steps.
- Frontend/backend architecture: later phases will split large React and FastAPI modules without changing behavior or endpoint contracts.
- Operations: migration discipline, environment examples, Docker health, backup/restore, and CI/local validation become production-readiness requirements.
