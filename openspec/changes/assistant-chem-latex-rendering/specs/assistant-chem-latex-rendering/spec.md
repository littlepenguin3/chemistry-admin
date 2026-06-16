## ADDED Requirements

### Requirement: Model chemistry math output contract
The learning assistant SHALL instruct answer-generation models to emit chemistry and math notation in renderer-supported formats.

#### Scenario: Model formats chemistry reactions
- **WHEN** the assistant asks a model to answer a chemistry learning question
- **THEN** the prompt SHALL require inline formulas to use `$...$`
- **AND** block formulas to use `$$...$$`
- **AND** chemistry formulas or reactions to use `\ce{...}` when appropriate
- **AND** whole reaction equations to be emitted as one `\ce{...}` expression using mhchem arrows such as `->`, not split into multiple `\ce` fragments
- **AND** loose mhchem forms such as `\ceKMnO4`, `\ceCl2`, `\ceMn^{2+}`, and reaction arrows such as `-->`, `-- >`, or `\rightarrow` SHALL be explicitly forbidden
- **AND** raw LaTeX commands such as `\mathrm`, `\ce`, `\ch`, or `\rightarrow` SHALL NOT be emitted outside math delimiters.

### Requirement: Backend normalizes assistant formula output
The learning assistant backend SHALL normalize final assistant answers before returning them to clients.

#### Scenario: Bare chemistry command is produced
- **WHEN** a final answer contains bare formula commands such as `\ce{...}`, `\ch{...}`, or `\mathrm{...}` outside math delimiters
- **THEN** the backend SHALL repair the text by wrapping safe formula segments in math delimiters
- **AND** the final response SHALL avoid exposing the raw command as ordinary prose.

#### Scenario: Alternate math delimiters are produced
- **WHEN** a final answer contains `\(...\)` or `\[...\]`
- **THEN** the backend SHALL normalize those delimiters to renderer-supported inline or block math syntax.

#### Scenario: Loose mhchem reaction is produced
- **WHEN** a final answer contains malformed reaction notation such as `\ceCl2 + 2Br^- --> 2Cl^- + Br2`
- **THEN** the backend SHALL repair it to a renderer-supported whole-reaction expression such as `$\\ce{Cl2 + 2Br^- -> 2Cl^- + Br2}$`
- **AND** the final response SHALL NOT expose loose `\ce...` commands or non-mhchem reaction arrows as ordinary prose.

#### Scenario: Answer text contains code blocks
- **WHEN** a final answer contains fenced code blocks
- **THEN** backend formula normalization SHALL NOT rewrite content inside code blocks.

### Requirement: Frontend renders chemistry math robustly
The learning assistant frontend SHALL render Markdown with chemistry/math support instead of exposing raw LaTeX commands.

#### Scenario: Completed answer includes chemistry formulas
- **WHEN** a completed assistant answer contains `$\\ce{Cl2 + 2Br- -> 2Cl- + Br2}$`, `$\\mathrm{Cl_2}$`, or `$0.1\\,\\mathrm{mol\\cdot L^{-1}}$`
- **THEN** the frontend SHALL render the notation as math/chemistry content
- **AND** the student-visible answer SHALL NOT contain raw `\ce`, `\mathrm`, `\rightarrow`, or `\cdot` text.

#### Scenario: Evidence preview includes source LaTeX
- **WHEN** a fixed point source or RAG source preview contains chemistry/math LaTeX
- **THEN** the frontend SHALL render it through the same math-capable renderer
- **AND** authenticated RAG image rendering SHALL continue to work.

#### Scenario: Math rendering fails
- **WHEN** a formula segment cannot be parsed by the math renderer
- **THEN** the frontend SHALL fall back to readable sanitized text
- **AND** it SHALL NOT display common raw LaTeX command words to students.

### Requirement: Formula rendering regressions are tested
The project SHALL include regression tests that prevent common chemistry LaTeX leaks.

#### Scenario: Backend normalization test
- **WHEN** backend tests run against representative malformed assistant outputs
- **THEN** they SHALL verify final normalized text wraps or repairs common chemistry/math commands.

#### Scenario: Frontend no-leak test
- **WHEN** frontend rendering tests run against representative chemistry answers
- **THEN** they SHALL fail if student-visible rendered output contains raw `\ce`, `\ch`, `\mathrm`, `\rightarrow`, or `\cdot`
- **AND** they SHALL fail if KaTeX renders a chemistry formula as `.katex-error`.
