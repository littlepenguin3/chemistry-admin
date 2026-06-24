## Why

Atom history rows currently use the first student question truncated to 28 characters, so many entries read like raw prompts such as "我正在学习..." or "请解释..." rather than the learning topic the student will recognize later. The assistant already has a final-metadata phase for student-facing follow-up prompts, making it a good place to add a lightweight generated title while preserving local-only history storage.

## What Changes

- Add an optional `conversation_title` field to the student assistant final metadata for first-turn Atom conversations.
- Generate the title only for the first submitted question in a conversation, using the same completed answer, active assistant context, latest student question, and recent-history payload shape already used for follow-up metadata.
- Keep local browser history as the persistence layer; do not add backend chat-session storage or migrate existing history entries.
- Update the H5 history save/restore path so a valid generated title replaces the current first-question truncation for the same local history entry.
- Preserve the existing title fallback whenever the model omits a title, returns an invalid title, metadata generation fails, or a legacy history entry is restored.
- Keep `conversation_title` out of assistant answer text, copied answer content, visible thinking, raw diagnostics, and backend `conversation_history`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `student-h5-ai-assistant`: Local Atom history entries may use a sanitized generated first-turn title from final metadata, with the existing local fallback preserved.

## Impact

- Backend student assistant stream final metadata generation in `server/app/domains/assistant/student_assistant.py`.
- Student assistant API metadata typing in `apps/web-student/src/api.ts`.
- Student local history normalization/save logic in `apps/web-student/src/features/assistant/assistantHistoryStore.ts` and the root chat persistence path in `StudentAiChatPanel.tsx`.
- Student H5 tests for first-turn title generation, fallback, restored history, and metadata isolation.
- No database migration, no new persistent backend session table, and no change to the answer streaming `delta` contract.
