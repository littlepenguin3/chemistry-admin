## 1. Baseline And Scope

- [x] 1.1 Confirm the branch is clean and aligned with `origin/codex/productionize-admin-platform`.
- [x] 1.2 Confirm production readiness workflow remains manual-only and no CI trigger changes are needed.
- [x] 1.3 Record current frontend large-file hotspots and build chunk owners.
- [x] 1.4 Commit the OpenSpec proposal, design, specs, and task list before implementation begins.

## 2. Frontend Feature Decomposition

- [x] 2.1 Select one low-risk feature slice from the largest frontend modules.
- [x] 2.2 Extract pure helpers, display tags, or presentational subcomponents into feature-local modules.
- [x] 2.3 Preserve existing exports, route paths, query keys, mutation behavior, and visible workflows.
- [x] 2.4 Update the frontend split map to reflect moved modules and remaining hotspots.

## 3. Bundle And Lazy-Load Review

- [x] 3.1 Run frontend build and build chunk report after the extraction.
- [x] 3.2 Confirm route-level lazy loading still isolates heavy feature chunks.
- [x] 3.3 Document any remaining large vendor chunks as known owners rather than regressions.
- [x] 3.4 Avoid adding new eager imports of charts, markdown/math, upload, or other heavy feature-only dependencies into the app shell.

## 4. Validation And Handoff

- [x] 4.1 Run OpenSpec strict validation for `production-quality-iteration-four`.
- [x] 4.2 Run frontend typecheck, frontend tests, production build, and build chunk report.
- [x] 4.3 Run backend/protected-resource checks only if touched files or imports make them relevant.
- [x] 4.4 Run opt-in e2e smoke if route boundaries or runtime behavior changed.
- [x] 4.5 Write final notes with completed work, validation results, remaining risks, and the next recommended slice.
- [x] 4.6 Commit coherent phases and push `codex/productionize-admin-platform`.
