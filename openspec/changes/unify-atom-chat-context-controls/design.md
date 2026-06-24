## Context

The current implementation has two Atom-like paths:

- `/ai` root: modern Atom surface with top actions, local history, new chat, composer `+`, context picker, context chip, root prompt behavior, flat answers, and keyboard-aware layout.
- `/ai/chat` detail: old contextual assistant wrapper reached from other pages. It loads an optional `contextKey`, renders a detail route header, and uses the shared `StudentAiChatPanel` in `variant="detail"`, but many modern Atom behaviors are gated by `isRootVariant`.

The important product realization is that the context chip is now the unit of meaning. The opening route can seed that chip, but it should not define a separate assistant product.

## Goals

- Make `/ai/chat` feel like the same Atom assistant, not a legacy contextual page.
- Keep route stack semantics intact: `/ai/chat` is still a detail route, hides bottom navigation, and returns to its source.
- Allow a student to enter Atom from history, new chat, or a scene-provided context without losing the same controls.
- Keep the route-provided context editable until the student sends the first user question.
- Preserve one bound context per chat after the first submitted user message.
- Avoid future rewrites when new context sources appear beyond video point scenes.

## Non-Goals

- Do not add backend durable chat sessions.
- Do not change the shape of `conversation_history` sent to the backend.
- Do not make directories, chapters, or unsupported objects bindable unless they can produce a supported `AssistantContext`.
- Do not show the bottom navigation on `/ai/chat`.
- Do not keep the old detail "current context" card as a parallel context UI.

## Design Decisions

### Split route role from Atom feature capability

The implementation should stop using `variant === "root"` as the single switch for every modern feature.

Instead, separate concerns:

```text
route role       = root tab | detail route
surface style    = modern Atom | legacy detail | artifact detail
controls         = full Atom controls | read-only/minimal controls
context lifecycle= editable before first turn | locked after first turn
navigation       = bottom nav aware | source-aware back route
```

Practical naming can vary, but the code should make these states explicit. For example:

- `surface="atom"` or `modernSurface`
- `controls="full"` or `enableFullAtomControls`
- `routeMode="root" | "detail"`
- `initialContextPolicy="global" | "seeded-editable"`

This avoids the current pattern where history, context picker, flat answer styling, composer geometry, prompt rows, keyboard behavior, and root route assumptions are all accidentally coupled to `isRootVariant`.

### Treat `contextKey` as an initial editable seed

When `/ai/chat` is opened with a valid `contextKey`, the page should load that `AssistantContext` and place it into the same composer chip state used by the root assistant.

Before the first submitted user message:

- the chip is visible;
- the student may remove it;
- tapping the context icon may reopen the picker;
- choosing another point replaces the seed;
- local history id is not forced by the route seed.

After the first submitted user message:

- the active chat is locked to the context used for that first turn;
- changing to another context requires a new chat;
- the chip remains visible as the bound learning background;
- no hidden route seed should overwrite a restored or selected history context.

### New chat behavior on a seeded detail route

The new-chat action should clear visible turns, draft text, loading state, generated suggestions, and active local history id.

On `/ai/chat`, the fresh state should be seeded from the current route context when one exists because the student is still in that source scene. That seeded chip remains editable before the next first turn. If the route has no valid seed, new chat starts from the default global Atom context.

This gives the user the expected behavior in both cases:

- "I am still in this experiment scene; start over here."
- "I can clear or replace the chip if I want a different background."

### History is an Atom capability, not a root-only capability

The history drawer should be reachable from both `/ai` and `/ai/chat`. It should read the same local history store and show entries regardless of whether they originated from root or detail.

Selecting a history entry should restore:

- visible messages;
- active local history id;
- saved assistant context;
- context chip title/path state;
- latest successful suggestions when present;
- generated local title when present.

Selecting history from `/ai/chat` should not promote the page into the root route. It should restore the chat inside the focused detail surface and keep detail back behavior.

### Context picker is shared across root and detail

The existing Atom picker already has the right product shape:

- empty query: catalog tree / chapter directory selection;
- non-empty query: compact one-line/two-line point search;
- point rows are bindable;
- directory rows are navigational;
- selected point is highlighted when reopening the picker;
- mobile keyboard changes resize the picker instead of covering the Atom title area.

This picker should open from `/ai/chat` as well. The bottom sheet remains a transient overlay inside the current Atom page and must not navigate to `/search`, `/video-library`, or another route.

### Modern detail surface without bottom navigation

The focused `/ai/chat` surface should inherit the modern Atom conversation language:

- Atom title/identity;
- top history and new-chat actions;
- modern composer with embedded send action;
- context chip in the composer;
- optional first-turn prompt stack when a context is selected;
- flat successful assistant replies and modern running state where scoped by this change;
- no old "current context" card above the conversation.

But it should keep detail-route shell behavior:

- bottom navigation hidden;
- source-aware back affordance available;
- browser/WebView back remains route-stack based;
- no duplicate first-level root header.

### First-turn prompts are context-seeded, not generic system reply prompts

When an Atom chat has a selected experiment/point context and no submitted messages, the first-turn prompt suggestions should use the special context-start prompt design rather than the post-answer dynamic suggestion row.

The prompt stack should be vertical or otherwise fit a phone viewport without horizontal scrollbar chrome. Copy should be directly tied to the selected context, such as:

- `该实验中观察什么`
- `该实验中现象说明什么`
- `该实验背后原理是什么`
- `为什么这样设计`
- `和其他点位对比`
- `哪里容易错`

Each item should carry the experiment/Atom icon cue. These starter prompts submit a first question using the currently selected context and then enter the locked-context conversation state.

Dynamic `suggested_prompts` returned after an assistant answer remain a separate post-answer mechanism.

### Local history remains local and metadata-safe

The frontend can store enough local metadata to restore the UI, but backend request history remains only recent messages:

```json
[
  { "role": "user", "content": "..." },
  { "role": "assistant", "content": "..." }
]
```

Context chip labels, route ids, picker state, generated titles, selected-row highlight, scroll positions, and UI prompt labels must not be injected into assistant answer text or backend `conversation_history`.

## Risks / Trade-offs

- [Risk] Reusing root styles too broadly may accidentally show bottom navigation or root-only spacing on `/ai/chat`. Mitigation: split route role from surface capability and add route-role tests.
- [Risk] History restore from `/ai/chat` could conflict with the route seed. Mitigation: restored history context wins until new chat is activated.
- [Risk] A seeded detail route may feel locked before the student asks. Mitigation: seeded context is editable/removable before first turn and visually uses the same chip affordance.
- [Risk] Existing tests assert that detail routes omit root actions. Mitigation: update those tests to the new product rule and add regression tests for bottom-nav hiding.
- [Risk] Context picker may overfit point/video data. Mitigation: keep the binding API based on `AssistantContext`, and allow future context-source parameters without redesigning the chat shell.

## Migration Plan

- Existing local history entries remain readable.
- Existing `/ai/chat?contextKey=...` links continue to work and now seed the full Atom context chip.
- Legacy history entries that lack context still restore as global conversations.
- No backend migration is required.

## Open Questions

- Whether non-point contexts such as chapter, assessment report, or mistake review should become bindable immediately or remain seed-only until a supported `AssistantContext` mapping exists.
- Whether `/ai/chat` should use a visible detail back arrow inside the Atom title row or keep the current shared detail header outside the Atom surface. The route must keep source-aware back behavior either way.
