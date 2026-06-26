## ADDED Requirements

### Requirement: Precomputed Qwen RAG index restores without external API calls
The textbook RAG workflow SHALL support restoring precomputed Qwen Elasticsearch documents during bootstrap without calling Qwen embedding or rerank APIs.

#### Scenario: Precomputed RAG bundle imports
- **WHEN** complete production seed bootstrap imports the precomputed textbook RAG bundle
- **THEN** it MUST create or update the configured textbook RAG Elasticsearch index using the committed mapping/settings and documents bundle
- **AND** each document MUST include the expected chunk id, source metadata, embedding model, embedding dimension, and dense vector.

#### Scenario: Precomputed RAG bundle is validated
- **WHEN** production seed validation checks the precomputed RAG bundle
- **THEN** it MUST verify expected document count, embedding model, embedding dimension, and source chunk count
- **AND** it MUST fail if the bundle contains vectors from a different model or dimension than the configured active index metadata.

#### Scenario: Evidence refresh is not run during bootstrap
- **WHEN** complete production seed bootstrap restores RAG documents and evidence bindings
- **THEN** it MUST NOT call Qwen embedding, Qwen rerank, DeepSeek, or any final question LLM
- **AND** it MUST treat provider API keys and model names as runtime configuration needed only for future refresh/generation work.
