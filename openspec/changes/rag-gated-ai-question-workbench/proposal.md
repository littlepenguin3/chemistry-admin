## Why

The question-bank AI workbench currently behaves like a generation drawer with static source snippets, while the learning assistant already has the stronger RAG contract: runtime health, hybrid recall/rerank, and per-turn evidence diagnostics. AI repair and AI question creation should only start when RAG is healthy enough to provide grounded evidence, because teachers are intentionally not editing question structure directly.

## What Changes

- Gate `AI 新增建议` and `AI 修正建议` behind a healthy RAG runtime instead of allowing source-light generation.
- Reuse the learning-assistant RAG runtime state on the question-bank page so teachers can see whether RAG is enabled, BGE rerank is available, and why AI actions are disabled.
- Make create sessions start from chapter-scoped experiment and single/multi-point selection, then user prompt refinement, then AI-generated candidate drafts.
- Make repair sessions start from the selected question's bound experiment and point context, then RAG evidence and user prompt refinement, then AI-generated candidate repair drafts.
- Preserve the non-mutating AI policy: teachers can prompt, compare, reject, continue, or publish validated candidates, but they cannot directly edit the canonical question structure inside the workbench.
- Store and display the evidence package used by the workbench, including retrieved source refs and retrieval diagnostics where available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `point-aware-ai-question-workbench`: Add RAG health gating, evidence-first start flow, multi-point create context, and workbench evidence diagnostics.
- `point-aware-question-bank-ai-suggestions`: Require AI suggestions to be grounded by usable RAG evidence and keep the user prompt as refinement rather than direct structural editing.
- `hybrid-bge-rag-retrieval`: Allow teacher-side question-bank workbench flows to reuse the same hybrid RAG retrieval health and diagnostics contract used by the learning assistant.

## Impact

- Admin web: question-bank page AI action enablement, workbench start controls, workbench context/evidence display, and candidate review messaging.
- Backend admin APIs: workbench session creation and message generation must enforce RAG health server-side and return structured evidence context.
- Retrieval: question-bank workbench source loading should align with the learning-assistant hybrid RAG route when available, while retaining deterministic fallback messaging for unhealthy RAG.
- Tests/validation: frontend typecheck/build, backend focused tests for RAG gate behavior, and OpenSpec validation.
