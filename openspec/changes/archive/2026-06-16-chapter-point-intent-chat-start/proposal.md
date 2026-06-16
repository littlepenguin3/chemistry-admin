## Why

The learning assistant empty state currently behaves like a small set of direct prompt shortcuts. That hides the real student path: chapter context is chosen separately, while the student should choose an experiment, then a video point under that experiment, then the kind of question they want to ask before entering normal chat.

## What Changes

- Replace the empty-chat prompt-card start screen with a chapter-scoped experiment -> video point -> question-intent starter panel.
- Keep the existing multi-turn chat, composer, streaming answer flow, and per-turn diagnostics behavior after the first question is sent.
- Let the selected chapter continue to come from the left-side context controls.
- Let the student/admin choose the experiment, video point, and question intent in the chat empty state.
- Generate or prefill a student question from the selected point and intent while submitting structured `chapter_id`, `experiment_id`, and `point_key`.
- Preserve typed/manual questions, including the ability to use the selected point context or clear it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-assistant-debug-console`: Empty-chat start behavior changes from flat prompt suggestions to a chapter-scoped experiment, point, and intent selection panel while retaining normal chat behavior.

## Impact

- Admin web: learning assistant page empty state, point context state, prompt generation helpers, and related responsive CSS.
- Request contract: no backend API change expected; existing `chapter_id`, `experiment_id`, `point_key`, `conversation_history`, and chat streaming endpoints remain in use.
- Backend: no core agent change expected because fixed point evidence already resolves from `experiment_id` and `point_key`.
- Validation: frontend typecheck/build and OpenSpec validation should cover the change.
