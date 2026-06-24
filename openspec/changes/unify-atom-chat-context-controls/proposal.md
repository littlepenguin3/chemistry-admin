## Why

The Atom root page now treats context as a composer-level learning-background chip: the `+` action selects a point, the selected point becomes an experiment chip, and a chat is locked to one bound context after the first user turn. That model is broader than the current `/ai` root page.

The `/ai/chat` detail route still behaves like an older contextual assistant page. It accepts a `contextKey` from a video or learning source, but it omits the modern Atom controls, uses older detail chrome, and treats the opening context as a fixed route-specific premise rather than as the same context chip used by the root assistant. This creates a product split that will not scale when Atom can be opened from videos, catalog nodes, assessments, mistakes, assignments, or future learning scenes.

Atom should have one conversation model:

- a conversation may start globally, from local history, or from a seeded source context;
- the composer `+`/context chip is the universal way to bind or replace context before the first user turn;
- after the first user turn, one chat remains bound to at most one context;
- history and new-chat controls are Atom controls, not root-only controls.

## What Changes

- Upgrade the contextual `/ai/chat` detail route into a full Atom conversation surface while preserving its second-level route role, back behavior, and hidden bottom navigation.
- Expose Atom history, new chat, and context selection on both `/ai` and `/ai/chat`.
- Treat route-provided `contextKey` values as an initial editable context seed before the first user turn, not as a permanently fixed page-only context.
- Generalize the composer learning-background chip so selected contexts can be shown, cleared, replaced, restored from history, and locked after the first submitted user message across Atom entry points.
- Reuse the existing Atom context picker bottom sheet for contextual detail chats, including catalog browsing, compact point search, selected-row highlighting, and keyboard-safe geometry.
- Preserve local browser history as the persistence layer and keep backend `conversation_history` limited to recent `{ role, content }` turns.
- Replace the old `/ai/chat` card-like "current context" treatment with the modern Atom composer, message, prompt, and context-chip model.

## Capabilities

### Modified Capabilities

- `student-h5-ai-assistant`: Atom history, new-chat, context chip, first-turn lock, and modern conversation surface apply to both the root assistant and the focused detail assistant.
- `student-h5-atom-context-picker`: The learning-background picker may be opened from any Atom composer that supports full controls, including `/ai/chat`.
- `student-h5-route-stack-navigation`: `/ai/chat` remains a second-level detail route, but route role no longer limits Atom's internal conversation controls.

## Impact

- Student H5 AI route and panel composition:
  - `apps/web-student/src/routes/ai/AiRootPage.tsx`
  - `apps/web-student/src/routes/ai/AiChatPage.tsx`
  - `apps/web-student/src/features/assistant/StudentAiChatPanel.tsx`
  - `apps/web-student/src/features/assistant/StudentAiChatTab.tsx`
- Atom context picker and local history helpers:
  - `apps/web-student/src/features/assistant/AtomContextPickerSheet.tsx`
  - `apps/web-student/src/features/assistant/assistantHistoryStore.ts`
- Student H5 route, shell, and assistant CSS:
  - `apps/web-student/src/styles/assistant.css`
  - route stack/detail page styles that control bottom navigation and safe areas
- Student-web tests covering root/detail Atom controls, history restore, context locking, picker reuse, keyboard behavior, and local-history isolation.

## Non-Goals

- No backend chat-session table or server-side history persistence.
- No change to the student assistant answer stream `delta` contract.
- No requirement to support arbitrary uploaded files, images, voice, model pickers, or external chat tools from the `+` action.
- No change to the one-chat-one-context principle after the first submitted user message.
- No promotion of `/ai/chat` into a first-level root tab and no bottom navigation on the detail route.
