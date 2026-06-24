## 1. Architecture And State Model

- [x] 1.1 Audit `StudentAiChatPanel`, `StudentAiChatTab`, `AiRootPage`, and `AiChatPage` for logic currently gated only by `variant === "root"`.
- [x] 1.2 Split route role from Atom feature capability with explicit props or local state such as modern surface, full controls, route mode, and initial context policy.
- [x] 1.3 Define a single context-binding lifecycle used by root and detail: seed, editable selected chip, submitted/locked context, restored history context, and new-chat reset.
- [x] 1.4 Ensure restored history context wins over route seed until the student starts a new chat.

## 2. Context Chip And Picker

- [x] 2.1 Generalize the composer `+` action so both `/ai` and `/ai/chat` can open the Atom context picker.
- [x] 2.2 Treat `/ai/chat` `contextKey` as an initial editable context chip before the first user turn.
- [x] 2.3 Keep context removal and replacement available before the first user turn on both root and detail surfaces.
- [x] 2.4 Lock the context chip after the first submitted user message and require new chat before binding a different context.
- [x] 2.5 When reopening the picker with an existing selected context, navigate/highlight the selected row where the catalog/search data can represent it.
- [x] 2.6 Keep picker opening, dismissal, keyboard behavior, and selection inside the current route without navigating to search or video-library pages.

## 3. Detail Route Modernization

- [x] 3.1 Update `/ai/chat` to use the modern Atom conversation surface while keeping it a second-level detail route.
- [x] 3.2 Remove or hide the old detail "current context" card and legacy detail composer treatment.
- [x] 3.3 Show Atom history and new-chat actions on the detail surface.
- [x] 3.4 Keep bottom navigation hidden on `/ai/chat` in normal, focused, picker-open, and keyboard-active states.
- [x] 3.5 Preserve source-aware back behavior from `/ai/chat` after history restore, new chat, and context replacement.

## 4. History Semantics

- [x] 4.1 Allow the Atom history drawer to open from both `/ai` and `/ai/chat`.
- [x] 4.2 Restore any local Atom history entry inside the current Atom surface, regardless of whether it originated from root or detail.
- [x] 4.3 Save contextual detail conversations into the same local history store with enough context to restore the chip and future backend requests.
- [x] 4.4 Keep generated history titles, context chip labels, picker state, and UI-only metadata out of copied answer text and backend `conversation_history`.
- [x] 4.5 Keep the "clear all" and per-row delete behavior consistent across root and detail history drawers.

## 5. First-Turn Prompt Experience

- [x] 5.1 Render context-start prompts only when a selected context exists and no user message has been submitted.
- [x] 5.2 Use context-start prompt copy such as observation, phenomenon explanation, principle, design reason, comparison, and common mistakes.
- [x] 5.3 Avoid horizontal scrollbar chrome for the first-turn prompt stack in mobile and teacher preview frames.
- [x] 5.4 Keep post-answer `suggested_prompts` as a separate latest-successful-turn mechanism.

## 6. Tests And Validation

- [x] 6.1 Update student-web tests that currently assert `/ai/chat` omits root actions.
- [x] 6.2 Add tests proving `/ai/chat` exposes history, new chat, context chip, and picker while bottom navigation remains hidden.
- [x] 6.3 Add tests for route-seeded context editability before first send and lock behavior after first send.
- [x] 6.4 Add tests for history restore precedence over route seed and new-chat reseeding behavior.
- [x] 6.5 Add tests proving backend `conversation_history` remains `{ role, content }` and excludes context chip/picker metadata.
- [x] 6.6 Run focused student-web tests, typecheck, build, and a mobile/teacher-preview visual QA pass.
