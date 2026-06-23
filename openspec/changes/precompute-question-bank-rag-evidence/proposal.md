## Why

Teacher question generation currently depends on live Qwen/ES retrieval at the moment the AI workbench opens or generates candidates. That makes "RAG unavailable" block generation even when a point could already have usable textbook evidence, and it hides paid Qwen embedding/rerank calls behind the generate action.

We need to move textbook evidence retrieval into an explicit teacher-controlled preparation step: refresh point evidence for the current chapter, bind selected textbook chunks to points, and let question generation read those bindings without calling Qwen at generation time.

## What Changes

- Add teacher-facing evidence refresh actions in question-bank management for the current chapter and current point.
- Precompute textbook evidence per catalog point using the configured Qwen embedding model, Elasticsearch textbook chunk index, and Qwen rerank model.
- Store selected evidence in `experiment_catalog_point_evidence_state` and `experiment_catalog_point_evidence_bindings` as the authoritative question-generation evidence source.
- Store candidate evidence diagnostics separately from selected evidence so operators can inspect broader retrieval results without sending all candidates to the LLM.
- Change AI question generation to read fresh/partial catalog point evidence bindings and stop doing dynamic Qwen retrieval during generation.
- Split UI/runtime status into:
  - evidence refresh service readiness: Qwen + ES + rerank;
  - AI generation readiness: DeepSeek + selected point evidence.
- Stop using `textbook_rag_evidence_cache` as the main question-generation path.
- Keep DeepSeek usage limited to actual question generation; evidence refresh SHALL NOT call DeepSeek.

## Capabilities

### New Capabilities
- `qwen-es-textbook-rag-retrieval`: Textbook chunk retrieval with Qwen embeddings, Elasticsearch recall, Qwen rerank, selected evidence, and candidate diagnostics.

### Modified Capabilities
- `catalog-point-index-evidence-jobs`: RAG evidence refresh jobs will bind Qwen ES textbook chunks by point section instead of relying on the legacy BGE refresh path.
- `point-aware-ai-question-workbench`: The workbench will use precomputed point evidence bindings for generation readiness and will not dynamically call Qwen retrieval during generation.
- `experiment-question-bank-management`: The question-bank page will expose chapter/point evidence refresh actions, progress/status, and separate refresh/generation availability.

## Impact

- Backend domains:
  - `server/app/domains/catalog_tree/jobs.py`
  - `server/app/domains/catalog_tree/ai_context.py`
  - `server/app/domains/questions/workbench.py`
  - `server/app/domains/questions/generation.py`
  - `server/app/domains/textbook_rag/*`
- Admin APIs:
  - question-bank evidence refresh endpoints
  - question-bank catalog response evidence status fields
  - workbench RAG/generation readiness payloads
- Database:
  - evidence binding roles and state diagnostics for principle/phenomenon/safety sections
  - optional cleanup/deprecation of the previous `textbook_rag_evidence_cache` path
- Frontend:
  - `QuestionBanksPage.tsx`
  - `question-bank.css`
  - question-bank API/types/display helpers
- Tests:
  - textbook RAG retrieval tests
  - catalog point job/evidence binding tests
  - question workbench gate tests
  - question bank route/UI helper tests
