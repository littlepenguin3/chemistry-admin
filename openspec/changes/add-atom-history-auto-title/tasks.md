## 1. Backend Final Metadata

- [x] 1.1 Extend the student assistant final metadata contract to allow optional `conversation_title` without changing streamed answer `delta` events.
- [x] 1.2 Replace or extend the current follow-up prompt generation payload so the metadata model can return both `suggested_prompts` and `conversation_title`.
- [x] 1.3 Request `conversation_title` only when the incoming student assistant payload has empty `conversation_history`.
- [x] 1.4 Add a title-specific sanitizer that accepts concise learning-topic titles, preserves meaningful formulas such as `KI`, `Cl2`, and `CCl4`, and rejects markdown, JSON wrappers, prompt boilerplate, internal diagnostics, teacher/admin terms, and unsafe/off-scope wording.
- [x] 1.5 Ensure metadata post-processing failure still returns the original final response with `suggested_prompts: []` and no blocking exception.

## 2. Student Web Local History

- [x] 2.1 Add `conversation_title?: string` to the student assistant final metadata type used by the H5 frontend.
- [x] 2.2 Add frontend validation for generated history titles before accepting `response.conversation_title`.
- [x] 2.3 Keep the immediate local history save using the existing `historyTitleFromMessages` fallback while the answer is streaming.
- [x] 2.4 When the first final response includes a valid generated title, update the same local history entry's `title` without changing messages, context, history id, or created timestamp.
- [x] 2.5 Preserve existing behavior for restored legacy history entries and for final metadata that omits or invalidates `conversation_title`.
- [x] 2.6 Ensure accepted titles are used only in the history row and never in visible answer text, copied answer text, quick prompts, visible thinking, sources, or outbound `conversation_history`.

## 3. Tests And Validation

- [x] 3.1 Add backend tests proving first-turn final metadata may include a sanitized `conversation_title`.
- [x] 3.2 Add backend tests proving follow-up turns do not request or attach a new title.
- [x] 3.3 Add backend tests for invalid title payloads, metadata generation failure, and preservation of `suggested_prompts` behavior.
- [x] 3.4 Add student-web tests proving a generated title replaces the fallback title in local history after final metadata.
- [x] 3.5 Add student-web tests proving fallback title behavior remains when the title is absent, invalid, or a legacy history entry is restored.
- [x] 3.6 Add student-web tests proving `conversation_title` is not sent in backend `conversation_history` and is not copied as answer content.
- [x] 3.7 Run focused backend and student-web test suites plus the normal student-web type/build checks.
