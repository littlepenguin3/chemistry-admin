## ADDED Requirements

### Requirement: Chemistry math rendering works in streaming and completed paths
The learning assistant frontend SHALL preserve chemistry and math rendering behavior across both Streamdown active-answer rendering and static completed-answer rendering.

#### Scenario: Active streamed answer contains supported chemistry notation
- **WHEN** the active assistant answer contains supported chemistry notation such as `$\\ce{Cl2 + 2Br^- -> 2Cl^- + Br2}$`
- **THEN** the streaming renderer MUST attempt to render the notation using KaTeX with mhchem support
- **AND** the active answer MUST remain readable while the stream is still incomplete.

#### Scenario: Completed answer contains supported chemistry notation
- **WHEN** the same answer reaches final completion
- **THEN** the static renderer MUST render the completed notation through the chemistry/math-capable static Markdown path
- **AND** the visible completed answer MUST NOT expose supported raw `\\ce`, `\\ch`, `\\mathrm`, `\\rightarrow`, or `\\cdot` commands as ordinary prose.

#### Scenario: Streaming and static renderers differ internally
- **WHEN** Streamdown and `react-markdown` use different plugin chains internally
- **THEN** both renderers MUST still accept the established assistant output contract of `$...$`, `$$...$$`, and `\\ce{...}` inside math delimiters
- **AND** both renderers MUST share normalization rules for `\\(...\\)` and `\\[...\\]` delimiters where practical.

#### Scenario: Chemistry notation is split across stream events
- **WHEN** stream chunks divide a chemistry expression across multiple `delta` events
- **THEN** the active renderer MUST avoid crashing or permanently exposing partial parser errors
- **AND** the completed renderer MUST render the valid final formula when all chunks have arrived.

### Requirement: Formula normalization remains fenced-block aware
The learning assistant frontend SHALL keep formula normalization from corrupting fenced code blocks, Mermaid diagrams, or other preformatted Markdown blocks.

#### Scenario: Formula-like text appears inside Mermaid
- **WHEN** a Mermaid code fence contains chemistry labels, arrows, or formula-like text
- **THEN** frontend formula normalization MUST NOT rewrite Mermaid source in a way that breaks diagram parsing
- **AND** the Mermaid renderer or fallback block MUST receive the intended diagram source.

#### Scenario: Formula-like text appears inside fenced code fallback
- **WHEN** an answer contains a non-Mermaid fenced block with formula-like text
- **THEN** frontend formula normalization MUST NOT rewrite the fenced block content
- **AND** the block MUST render as safe preformatted fallback content.

#### Scenario: Formula-like text appears in ordinary prose
- **WHEN** ordinary answer prose contains supported alternate math delimiters such as `\\(...\\)` or `\\[...\\]`
- **THEN** frontend normalization SHOULD convert them to the renderer-supported inline or block math delimiters
- **AND** conversion MUST preserve the visible formula semantics.

### Requirement: Chemistry formula failures are student-readable
The learning assistant frontend SHALL handle math or chemistry render failures without breaking the answer turn.

#### Scenario: Streaming math plugin rejects a formula
- **WHEN** the Streamdown math plugin rejects or cannot yet parse a formula during active streaming
- **THEN** the active answer MUST remain visible
- **AND** the failure MUST NOT crash the assistant panel or block later chunks from rendering.

#### Scenario: Static renderer rejects a formula
- **WHEN** the static renderer cannot parse a completed formula
- **THEN** the answer MUST fall back to readable sanitized text or inline code treatment for that formula
- **AND** the rest of the Markdown answer MUST continue rendering.

#### Scenario: KaTeX error markup would be visible
- **WHEN** a formula failure would create `.katex-error` or equivalent error markup
- **THEN** student-facing tests MUST detect the leak
- **AND** the implementation MUST prefer readable fallback text over exposed renderer error chrome.

### Requirement: Chemistry Markdown examples cover teaching patterns
The learning assistant frontend SHALL validate chemistry-rich Markdown using examples that match the application's teaching context.

#### Scenario: Acid-base answer is rendered
- **WHEN** a representative answer explains pH or acid-base equilibrium using `$pH=-\\log[H^+]$` and `$$K_a=\\frac{[H^+][A^-]}{[HA]}$$`
- **THEN** the formulas MUST render in both active and completed answer states where supported
- **AND** the completed state MUST be regression tested.

#### Scenario: Reaction equation answer is rendered
- **WHEN** a representative answer contains a whole reaction equation such as `$\\ce{2H2 + O2 -> 2H2O}$`
- **THEN** the chemistry equation MUST render through mhchem
- **AND** the visible answer MUST avoid raw command leakage.

#### Scenario: Observation table answer is rendered
- **WHEN** a representative answer uses a GFM table to compare `CO2`, `NH3`, `Cl2`, and `O2` test methods
- **THEN** the table MUST render as a table
- **AND** formulas inside table cells MUST remain readable and overflow-safe.
