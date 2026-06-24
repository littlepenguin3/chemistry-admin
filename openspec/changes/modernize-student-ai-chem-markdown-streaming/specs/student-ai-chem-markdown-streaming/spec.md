## ADDED Requirements

### Requirement: Assistant answers use mode-specific Markdown renderers
The student AI answer surface SHALL use a streaming-capable Markdown renderer only for the active assistant answer turn and SHALL use the stable static Markdown renderer for completed or restored answer content.

#### Scenario: Active assistant turn uses streaming renderer
- **WHEN** the student assistant has an active loading assistant turn with non-empty answer content
- **THEN** that latest assistant turn MUST render answer Markdown through the Streamdown-based renderer
- **AND** the renderer MUST be scoped to answer content only
- **AND** the visible thinking line, status text, composer, quick prompts, and turn actions MUST remain outside the Streamdown answer body.

#### Scenario: Completed assistant turn uses static renderer
- **WHEN** the active assistant turn receives a successful final state and loading ends
- **THEN** the completed answer MUST render through the static `react-markdown` rendering path
- **AND** the completed answer MUST preserve the final full answer text
- **AND** renderer-specific streaming state MUST NOT remain visible in the completed turn.

#### Scenario: Restored local history uses static renderer
- **WHEN** the student restores a conversation from local AI history
- **THEN** all restored assistant answers MUST render as completed static Markdown
- **AND** restored messages MUST NOT replay Streamdown animations or CJK smooth-stream timers
- **AND** follow-up questions MUST continue using the restored plain-text `conversation_history`.

#### Scenario: Non-streaming AI text surfaces stay static
- **WHEN** student-facing assessment summaries, mistake explanations, or other non-chat AI text render Markdown
- **THEN** those surfaces MUST keep using the static Markdown rendering path
- **AND** they MUST NOT load Streamdown solely for static content.

#### Scenario: Empty active turn keeps existing loading UI
- **WHEN** an assistant turn is loading but has not yet received answer text
- **THEN** the UI MUST continue showing the established running/thinking treatment for that route
- **AND** it MUST NOT mount an empty Streamdown answer block that changes layout or accessibility announcements.

### Requirement: Chinese smooth streaming controls visible answer cadence
The student AI chat SHALL smooth visible answer updates so Chinese learning answers are released in readable segments rather than raw network chunks.

#### Scenario: Delta chunks are buffered before display
- **WHEN** the stream emits multiple `delta` events for an active assistant answer
- **THEN** the frontend MUST accumulate the exact raw answer text separately from the displayed answer text
- **AND** visible updates SHOULD be released by readable CJK words, short phrases, punctuation boundaries, Markdown block boundaries, or bounded cadence intervals
- **AND** the UI MUST NOT call the Markdown renderer for every raw network chunk when buffering can combine them safely.

#### Scenario: Segmenter is available
- **WHEN** `Intl.Segmenter` is available for Chinese text segmentation
- **THEN** the smoothing layer SHOULD prefer it for word-level CJK segmentation
- **AND** it MUST still preserve the exact answer text order and content.

#### Scenario: Segmenter is unavailable
- **WHEN** `Intl.Segmenter` is unavailable or fails
- **THEN** the smoothing layer MUST fall back to deterministic segmentation using punctuation, whitespace, newlines, and safe size thresholds
- **AND** answer rendering MUST continue without throwing.

#### Scenario: Final event flushes display text
- **WHEN** the assistant stream emits `final` or the request resolves successfully
- **THEN** the smoothing layer MUST flush all pending raw answer content into the visible answer
- **AND** the final persisted message content MUST equal the complete final answer text
- **AND** no characters MAY remain only in a timer buffer after completion.

#### Scenario: Replace event resets source of truth
- **WHEN** the assistant stream emits `replace` with answer text
- **THEN** the smoothing layer MUST treat the replacement as the new raw source of truth
- **AND** previously buffered raw or displayed text that conflicts with the replacement MUST be discarded
- **AND** the visible answer MUST converge to the replacement text before final completion.

#### Scenario: Error stops smoothing
- **WHEN** the assistant turn fails through an `error` event or frontend request error
- **THEN** all smoothing timers for that turn MUST be stopped
- **AND** pending answer buffers MUST NOT append text to the later error message
- **AND** the error message MUST render through the established error turn treatment.

#### Scenario: Reduced motion preference is honored
- **WHEN** the user agent reports `prefers-reduced-motion: reduce`
- **THEN** the answer MUST remain readable
- **AND** Streamdown animation and local smooth-stream animation MUST be reduced or disabled
- **AND** answer content MUST still update and flush correctly.

### Requirement: Static Markdown supports chemistry-learning GFM
The static Markdown path SHALL support chemistry-learning Markdown content, including GFM tables, task lists, formulas, links, lists, headings, and fallback fenced blocks.

#### Scenario: Assistant answer contains a GFM table
- **WHEN** a completed assistant answer contains a GFM table comparing chemistry observations, reagents, phenomena, or conclusions
- **THEN** the table MUST render as a table rather than plain pipe text
- **AND** the table MUST remain readable on common phone widths without causing page-level horizontal overflow.

#### Scenario: Assistant answer contains task list items
- **WHEN** a completed assistant answer contains GFM task list items such as `- [x]` or `- [ ]`
- **THEN** the task list MUST render with aligned checkbox affordances and readable labels
- **AND** the checkboxes MUST NOT imply that the student can persistently edit the answer unless edit behavior is explicitly implemented.

#### Scenario: Assistant answer contains strikethrough
- **WHEN** a completed assistant answer contains GFM strikethrough text
- **THEN** the strikethrough MUST render visibly
- **AND** it MUST remain legible against the Atom assistant background.

#### Scenario: Assistant answer contains ordinary links
- **WHEN** a completed assistant answer contains a Markdown link
- **THEN** the link MUST render as an accessible external or internal link according to the existing URL policy
- **AND** unsafe protocols MUST NOT execute.

#### Scenario: Assistant answer contains a fenced block fallback
- **WHEN** a completed assistant answer contains a fenced block that is not supported as a diagram or formula
- **THEN** the block MUST render as a safe overflow-aware code/preformatted block
- **AND** code-block chrome MUST remain secondary because the application is a chemistry learning assistant.

### Requirement: Math and mhchem render in streaming and static answers
The student AI answer renderer SHALL render math and chemistry notation in both streaming and completed answer states without exposing supported raw LaTeX commands as ordinary student text.

#### Scenario: Streaming answer contains inline math
- **WHEN** an active assistant answer contains inline math such as `$pH=-\\log[H^+]$`
- **THEN** the streaming renderer MUST render the expression through the configured math renderer when enough syntax is available
- **AND** incomplete math syntax MUST fail gracefully while the stream is still active.

#### Scenario: Completed answer contains block math
- **WHEN** a completed assistant answer contains block math such as `$$K_a=\\frac{[H^+][A^-]}{[HA]}$$`
- **THEN** the static renderer MUST render it as display math
- **AND** the display math container MUST allow horizontal overflow inside the answer area rather than widening the page.

#### Scenario: Answer contains mhchem chemistry notation
- **WHEN** a streaming or completed assistant answer contains mhchem notation such as `$\\ce{2H2 + O2 -> 2H2O}$`
- **THEN** the renderer MUST render the chemistry notation through KaTeX with mhchem support when supported
- **AND** the student-visible answer MUST NOT expose raw supported `\\ce`, `\\ch`, `\\rightarrow`, or `\\cdot` command words as normal prose.

#### Scenario: Formula syntax is split across chunks
- **WHEN** the stream splits a formula across multiple `delta` events
- **THEN** the active answer renderer MUST avoid breaking the entire chat turn
- **AND** the final flushed answer MUST render the complete formula correctly if the final syntax is valid.

#### Scenario: Formula rendering fails
- **WHEN** a formula segment cannot be parsed by KaTeX or the streaming math plugin
- **THEN** the renderer MUST fall back to readable sanitized text or inline code treatment
- **AND** the failed formula MUST NOT crash the chat page.

### Requirement: Mermaid learning diagrams are mobile-safe
The student AI answer renderer SHALL support Mermaid diagrams as mobile-safe learning visualizations for chemistry explanation flows.

#### Scenario: Answer contains a Mermaid flowchart
- **WHEN** an assistant answer contains a fenced Mermaid flowchart for experiment steps, substance identification, or reasoning flow
- **THEN** the renderer MUST render it as a diagram when Mermaid rendering succeeds
- **AND** the rendered diagram MUST remain inside the answer turn's visual bounds.

#### Scenario: Mermaid fence is incomplete during streaming
- **WHEN** a Mermaid fenced block is still incomplete during active streaming
- **THEN** the renderer MUST avoid repeatedly rendering invalid partial diagrams
- **AND** it MAY show safe pending/fallback block content until the code fence becomes complete.

#### Scenario: Diagram is wider than phone viewport
- **WHEN** a rendered Mermaid diagram is wider than the available chat width on a phone viewport
- **THEN** the diagram container MUST support horizontal scrolling or equivalent pan behavior
- **AND** the page itself MUST NOT gain destructive horizontal overflow.

#### Scenario: Diagram is tall on a phone viewport
- **WHEN** a rendered Mermaid diagram exceeds the comfortable mobile reading height
- **THEN** the diagram container MUST constrain the initial displayed height or offer fullscreen viewing
- **AND** the student MUST be able to inspect the diagram without losing access to the chat composer after closing or scrolling away.

#### Scenario: Mermaid render fails
- **WHEN** Mermaid cannot parse or render a diagram
- **THEN** the answer MUST show a safe fallback representation or a student-readable diagram failure treatment
- **AND** the failure MUST NOT crash the assistant route.

#### Scenario: Mermaid controls are shown
- **WHEN** Mermaid controls such as fullscreen, download, copy, zoom, or pan are visible
- **THEN** every visible control MUST have a student-readable accessible name
- **AND** the controls MUST use phone-appropriate hit targets
- **AND** the controls MUST visually fit the Atom assistant theme.

### Requirement: Markdown presentation is Atom-themed and overflow-safe
The student AI answer renderer SHALL apply Atom assistant presentation rules to generated Markdown instead of relying on browser defaults or unstyled plugin output.

#### Scenario: Table styles are applied
- **WHEN** an answer table renders inside `.ai-markdown`
- **THEN** it MUST use Atom-themed borders, cell padding, header treatment, and readable text color
- **AND** it MUST avoid card-inside-card styling on the root flat assistant canvas.

#### Scenario: Task list styles are applied
- **WHEN** an answer task list renders inside `.ai-markdown`
- **THEN** checkbox markers and labels MUST align consistently with the surrounding body font
- **AND** the list MUST not collapse row height or overlap adjacent content.

#### Scenario: Formula overflow is contained
- **WHEN** inline or display math is wider than the answer content area
- **THEN** the formula container MUST wrap or scroll within the answer content area
- **AND** it MUST not overlap the phone frame, composer, bottom navigation, or next chat turn.

#### Scenario: Streamdown animation is themed
- **WHEN** Streamdown animates newly visible answer content
- **THEN** the animation MUST feel subtle and readable within the Atom assistant
- **AND** it MUST not reanimate old completed content after the answer has settled.

#### Scenario: Plugin controls are themed
- **WHEN** Streamdown or Mermaid plugin controls render
- **THEN** their color, border, background, focus state, and disabled state MUST fit the green Atom assistant visual language
- **AND** they MUST not look like unrelated desktop developer-tool controls.

### Requirement: Answer rendering remains student-safe
The student AI answer renderer SHALL preserve student-role boundaries, sanitization, and copy behavior while rendering rich Markdown.

#### Scenario: Raw HTML appears in model output
- **WHEN** assistant answer text contains raw HTML
- **THEN** the renderer MUST sanitize, skip, or safely unwrap it according to the chosen renderer configuration
- **AND** scripts, event handlers, unsafe iframes, and unsafe embedded objects MUST NOT execute.

#### Scenario: Diagnostic text is present outside answer content
- **WHEN** the frontend has access to RAG traces, source chunks, tool calls, guardrail decisions, provider details, or visible thinking events
- **THEN** those values MUST NOT be passed into the Markdown answer renderer unless they are already part of sanitized final answer text
- **AND** the answer renderer MUST NOT create a new path for exposing teacher/admin diagnostics.

#### Scenario: Student copies an assistant answer
- **WHEN** the student uses the assistant answer copy action
- **THEN** the copied text MUST contain the assistant answer content only
- **AND** it MUST NOT include Streamdown controls, Mermaid control labels, hidden metadata, raw sources, visible thinking status, or quick prompt chips.

#### Scenario: External link is activated
- **WHEN** the student activates an external link rendered from Markdown
- **THEN** the link MUST use safe browser behavior such as `rel="noreferrer"` or an equivalent link-safety treatment
- **AND** unsafe protocols MUST be rejected or neutralized.

### Requirement: Rich Markdown behavior is regression tested
The project SHALL include regression coverage for the modern chemistry Markdown streaming path.

#### Scenario: Representative chemistry answer renders
- **WHEN** frontend tests render a representative chemistry answer containing Chinese prose, a GFM table, a task list, inline math, block math, mhchem notation, and a Mermaid flowchart
- **THEN** tests MUST verify that key rendered structures are present
- **AND** tests MUST verify that supported raw chemistry commands do not leak as ordinary visible text.

#### Scenario: Split chunks complete correctly
- **WHEN** a mocked assistant stream splits Markdown syntax across multiple `delta` events
- **THEN** tests MUST verify that the final completed answer contains the full text
- **AND** the completed answer MUST render through the static renderer after final completion.

#### Scenario: History remains plain text
- **WHEN** a completed rich Markdown answer is saved and restored through local history
- **THEN** tests MUST verify that the stored message content remains plain Markdown text
- **AND** renderer mode, Streamdown state, animation state, and Mermaid render cache MUST NOT be persisted.

#### Scenario: Mobile overflow is checked
- **WHEN** mobile QA runs against the AI route at common phone widths
- **THEN** rich Markdown tables, formulas, and Mermaid diagrams MUST not cause destructive horizontal page overflow
- **AND** the composer and bottom navigation MUST remain reachable.
