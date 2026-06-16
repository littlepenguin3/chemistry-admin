## 1. Backend Contract And Normalization

- [x] 1.1 Add a learning-assistant chemistry/math formatting contract to model instructions for chat completion, streaming chat completion, and Agents SDK paths.
- [x] 1.2 Implement deterministic backend normalization for final assistant answers, preserving fenced code blocks.
- [x] 1.3 Apply normalization to non-streaming and streaming final response payloads.

## 2. Frontend Renderer

- [x] 2.1 Add Markdown/math rendering dependencies for KaTeX, mhchem, and remark/rehype rendering.
- [x] 2.2 Replace the learning assistant hand-written math renderer with Markdown + KaTeX/mhchem rendering while preserving authenticated RAG image rendering.
- [x] 2.3 Add frontend fallback sanitization so failed math segments do not expose common raw LaTeX commands.

## 3. Regression Coverage

- [x] 3.1 Add backend tests for bare command wrapping, delimiter normalization, and code-block preservation.
- [x] 3.2 Add frontend rendering tests that fail on visible `\ce`, `\ch`, `\mathrm`, `\rightarrow`, or `\cdot` leaks.

## 4. Validation And Runtime

- [x] 4.1 Run OpenSpec validation, backend targeted tests, frontend typecheck, frontend tests, and frontend build.
- [x] 4.2 Rebuild and recreate the Docker backend so `localhost:8000` uses the new backend normalization code.
