## Why

The learning assistant currently leaks raw LaTeX commands such as `\mathrm`, `\ce`, and `\rightarrow` into student-visible answers and evidence previews. This happens because model output, RAG text, and the frontend renderer do not share a strict chemistry/math rendering contract.

Students should never see raw LaTeX control words in normal learning answers. Chemistry formulas and reactions need a durable pipeline: model formatting rules, backend normalization, and frontend KaTeX/mhchem rendering with tests that prevent regressions.

## What Changes

- Add a chemistry/math answer-format contract for the learning assistant model prompt.
- Normalize generated answers on the backend before returning final responses, wrapping or repairing common raw LaTeX command leaks where safe.
- Render assistant Markdown through a robust math-capable renderer using KaTeX and mhchem instead of the current hand-written LaTeX parser.
- Keep authenticated RAG image rendering behavior while replacing text/Markdown parsing.
- Add regression coverage that forbids raw LaTeX command leakage in student-visible answer rendering.

## Capabilities

### New Capabilities
- `assistant-chem-latex-rendering`: Defines model, backend, and frontend behavior for chemistry/math formula formatting and rendering in learning assistant answers and evidence previews.

### Modified Capabilities
- None.

## Impact

- Backend agent instructions and response post-processing change for student learning assistant answers.
- Admin web dependencies add Markdown/math rendering libraries.
- Admin web learning assistant answer and evidence preview rendering changes.
- Tests add backend normalization coverage and frontend rendering leakage coverage.
