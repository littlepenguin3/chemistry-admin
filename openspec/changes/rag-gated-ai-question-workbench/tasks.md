## 1. Backend Gate And Evidence Context

- [x] 1.1 Add backend helpers to evaluate question-workbench RAG readiness from effective settings and BGE metrics.
- [x] 1.2 Enforce the RAG gate when creating workbench sessions and when sending workbench messages.
- [x] 1.3 Extend workbench session context snapshots to include gate status, selected point keys, and evidence package diagnostics.
- [x] 1.4 Preserve prior turns/candidates when generation is blocked by an unhealthy RAG runtime.

## 2. Frontend Workbench Flow

- [x] 2.1 Reuse learning-assistant runtime polling on the question-bank page and derive teacher-readable workbench gate state.
- [x] 2.2 Disable AI create/repair actions and prompt sending when RAG is unhealthy, with clear reason messaging.
- [x] 2.3 Add single/multi-point create selection before starting AI creation.
- [x] 2.4 Update the workbench context panel to show RAG status, target points, and evidence package details.
- [x] 2.5 Keep teacher prompts as refinement instructions and keep candidate publication validation-gated.

## 3. Validation

- [x] 3.1 Add focused backend tests for workbench RAG gate allow/block behavior.
- [x] 3.2 Run OpenSpec validation for the change.
- [x] 3.3 Run frontend typecheck/build and relevant backend tests.
