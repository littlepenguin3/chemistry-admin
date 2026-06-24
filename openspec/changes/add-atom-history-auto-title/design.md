## Context

The student H5 Atom root assistant already persists local chat history in `window.localStorage` under `student-ai-chat-history:v1`. A history entry title is currently derived synchronously from the first user message by `historyTitleFromMessages`, which is reliable but often reads like a raw prompt rather than a learning topic.

The backend student assistant stream has two distinct phases:

1. `run_agent_stream` streams answer text and emits the original `final` response.
2. `stream_student_assistant_answer` intercepts that `final` response and runs a final-metadata post-processing step that currently attaches sanitized `suggested_prompts`.

That post-processing step is already designed for student-facing metadata and is isolated from the answer body. It is therefore the right integration point for a generated conversation title. The title must remain a local-history convenience and must not turn Atom history into a backend-persisted chat-session feature.

## Goals / Non-Goals

**Goals:**

- Produce a concise, student-readable history title for first-turn Atom conversations.
- Preserve the current local fallback title whenever generated metadata is unavailable or invalid.
- Keep title generation out of streamed answer text and out of backend `conversation_history`.
- Store the accepted generated title in the same local history entry that already holds the conversation turns and context.
- Keep old local history entries readable without migration.

**Non-Goals:**

- Do not add backend chat-session persistence.
- Do not rename titles on later follow-up turns.
- Do not require the main answer model stream to emit machine-readable JSON.
- Do not expose raw model title payloads, generation diagnostics, prompt internals, or guardrail metadata to students.
- Do not block or fail the assistant answer if title generation fails.

## Decisions

### Generate title in final metadata post-processing

The backend should extend the existing follow-up metadata generation path so it can return both:

```json
{
  "conversation_title": "氯水与KI变色",
  "suggested_prompts": ["该实验观察什么", "现象说明什么"]
}
```

This keeps title generation adjacent to `suggested_prompts`, where the backend already has the current student question, completed answer, active context, and recent conversation history. The final SSE event remains the only place where the frontend receives this metadata.

Alternative considered: ask the main answer stream to include title JSON. Rejected because the main stream is student-facing prose; mixing answer text and metadata would make parsing fragile and could leak metadata into visible answers.

### Generate only for the first submitted question

The backend should request a `conversation_title` only when the incoming payload has no `conversation_history`. For later turns, the metadata generator may still return `suggested_prompts`, but it should not rename the conversation.

This matches how chat products usually title a conversation from the first exchange and avoids surprising students when a later follow-up shifts the visible history row label.

Alternative considered: update the title after every turn. Rejected because it creates unstable history labels and complicates local history restore semantics.

### Sanitize before accepting model output

The backend should sanitize `conversation_title` before attaching it to final metadata. The frontend should also validate the field before using it, so legacy clients and malformed server responses remain safe.

Suggested constraints:

- Treat only strings as candidates.
- Collapse whitespace and trim punctuation-like wrappers.
- Require a small visible length range, such as 4 to 18 visible characters.
- Reject Markdown, JSON-like braces, newlines, diagnostic terms, teacher/admin/internal words, and prompt boilerplate such as "我正在学习", "请解释", "这个内容主要".
- Prefer chemistry/topic wording over assistant-offer wording.

The exact sanitizer can reuse the style of `_sanitize_followup_prompts`, but should be title-specific rather than sharing the follow-up length and question-voice rules wholesale.

### Keep local fallback as the source of resilience

The frontend should continue creating or updating the history entry immediately using the current fallback title. When the final event arrives, if `response.conversation_title` passes validation, the same local entry can be rewritten with the generated title. If the field is absent or invalid, the current title stays.

This means no answer request is delayed for title generation from the user's perspective beyond the already-existing final metadata wait, and no history row becomes blank or broken.

### Preserve metadata isolation

`conversation_title` is local-history metadata. It must not be appended to the assistant answer content, copied answer text, visible thinking, quick-prompt chips, source summaries, raw `conversation_history`, or any student-facing diagnostics. Restoring a history entry should use the saved title for the history row, while follow-up requests continue sending only recent `{ role, content }` messages.

## Risks / Trade-offs

- [Risk] The post-processing model may return a vague or promotional title. -> Mitigation: hard sanitizer plus fallback to the existing first-question title.
- [Risk] Adding title generation to the metadata prompt could reduce suggested prompt quality. -> Mitigation: use a structured JSON contract and independent sanitizers for title and suggestions.
- [Risk] First-turn final metadata may take slightly longer. -> Mitigation: reuse the existing final metadata call instead of adding another request; keep failure non-blocking.
- [Risk] Legacy history entries lack generated titles. -> Mitigation: normalization continues accepting existing `title` values and derives fallback titles from messages when absent.
- [Risk] A generated title could accidentally include internal context or raw identifiers. -> Mitigation: reject diagnostic/internal terms and never render raw metadata outside the history title field.

## Migration Plan

- No storage migration is required. Existing `student-ai-chat-history:v1` entries remain readable.
- New clients may save generated titles into the existing `title` field.
- Rollback is safe: if backend stops returning `conversation_title`, the frontend fallback title path remains valid.

## Open Questions

- Final visible length should be tuned during implementation. A practical starting range is 4 to 18 visible characters.
- The title prompt may use Chinese only, or allow chemical formulas and short Latin symbols such as `KI`, `Cl2`, `CCl4`; implementation should preserve formulas because they are meaningful history cues.
