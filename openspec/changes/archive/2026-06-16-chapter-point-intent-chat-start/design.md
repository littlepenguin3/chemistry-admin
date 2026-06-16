## Context

The learning assistant debug console already has a left-side context card, a central multi-turn chat card, and a right-side diagnostics inspector. The backend request contract already accepts `chapter_id`, `experiment_id`, and `point_key`, and the agent already assembles fixed point evidence when structured point context is present.

The current empty-chat state in the central chat card shows a flat set of prompt cards generated from the selected chapter's first video points. Clicking a card immediately submits a default question. This is too shallow for the desired student flow because the chapter is selected in the left panel, but the student should explicitly choose an experiment, then a point under that experiment, then an intent/question direction.

## Goals / Non-Goals

**Goals:**
- Keep the left context card as the only chapter selector.
- Replace the central chat empty state with a chapter-scoped experiment, point, and intent selection panel.
- Preserve the existing chat timeline, streaming response behavior, composer, clear action, and diagnostics after a question is sent.
- Submit stable structured point context with generated intent questions.
- Let typed/manual questions continue to work with the selected point context when present.

**Non-Goals:**
- Do not change backend learning-assistant request or response schemas.
- Do not change fixed point evidence assembly, RAG behavior, guardrails, or diagnostics payloads.
- Do not add a new data source for experiments or video points.
- Do not build the final student-facing production page; this remains the admin debug console behavior.

## Decisions

### Empty state becomes a point-start state machine

The central chat card will use a small local state machine while `turns.length === 0`:

```text
selected chapter from left form
  -> available experiments for that chapter
  -> selected experiment
  -> video candidates under that experiment
  -> selected point
  -> selected intent
  -> generated/prefilled question
  -> submit through existing chat flow
```

The chat timeline remains the rendered state after the first send. The empty state is therefore a chat starter, not a replacement for chat.

Alternative considered: keep flat point prompt cards and improve labels. That still hides the experiment hierarchy and does not let students choose a question intent.

### Display grammar is separated from request contract

The UI displays human-friendly labels such as `19-1-01 · 点位 1`, but the request uses a structured `LearningAssistantPointContext` containing experiment id/code/title, point key/title, and point index. Generated question text remains natural language, while backend behavior relies on `experiment_id` and `point_key`.

Alternative considered: continue using point titles as `point_key` values. This works only because the backend has compatibility resolution, but it keeps display text and stable contract mixed together.

### Intents are controlled templates, not standalone prompt cards

The starter panel provides a small fixed intent set, for example:
- 观察什么
- 现象说明什么
- 背后原理
- 为什么这样设计
- 和其他点位对比
- 易错点
- 我自己问

Each intent can generate or prefill a question using the selected experiment and point. The custom/manual path leaves the composer available for the admin/student to type their own question.

The intent selection automatically syncs the generated question into the normal composer. The preview area keeps one prominent "start with this question" action; there is no separate "fill input" action because filling is an automatic state update.

Alternative considered: make every intent immediately submit. Prefilling keeps the user in control and preserves chat ergonomics.

### Starter CTA uses an open-source designed button pattern

The starter preview CTA should feel like a polished AI entry action, not a locally invented prompt button. Use open-source designed button patterns, now closer to Magic UI's Shiny Button and Pulsating Button than Border Beam, adapted only as much as needed for this Ant Design/Vite codebase. Keep the component isolated so the page owns the action and copy, while the button component owns CSS variables and motion grammar.

The default state should avoid orbiting border motion. Instead, the button uses a non-rotating AI glow treatment: a deep green pill, slow internal green shimmer, subtle text shine, and a soft breathing backlight below the button. The default glow should be visible before hover, using several larger irregular aurora/blob clusters with independent slow drift, scale, and shape morphing so the button reads as an AI start action rather than a plain green pill. The CTA copy is `从这个问题开始`, matching the user's mental model that the generated question is ready to send.

Hover and keyboard focus preserve the existing slower left-to-right green ink-wash lightening pass rather than a white glare. This gives the button a clear "start with AI" affordance without the fragile compact-pill border-orbit behavior that previously produced simultaneous top and bottom arcs.

Alternative considered: keep the existing page-local Motion button. That improves animation mechanics but still leaves the design language authored inside the page.

### Active point context survives into normal chat until changed or cleared

When a generated intent question is submitted, the selected point context becomes `activePointContext`. Subsequent typed follow-ups continue to send that context, matching the existing continuity rule from the completed point-context change. The UI should show a lightweight current point strip near the composer so the active context is visible and clearable.

Alternative considered: only send point context for the first generated question. That makes short follow-ups less reliable and conflicts with the multi-turn point-context behavior already implemented.

## Risks / Trade-offs

- [Risk] A chapter can contain many experiments and points, crowding the empty state. -> Mitigate with a compact split panel, scrollable lists, and default selection of the first available experiment/point.
- [Risk] Some experiments have no `metadata.video_candidates`. -> Show a clear empty state for that experiment and keep the composer usable for chapter-only questions.
- [Risk] Point keys reconstructed in the frontend can drift from backend reconstruction. -> Use the same `candidate-{index}-{sha1(title)[:8]}` algorithm or a shared API response if available; keep title fallback only as compatibility, not as the primary value.
- [Risk] The starter panel could feel like a separate tool. -> Keep it inside the chat card only when there are no turns, with the original composer always visible at the bottom.

## Migration Plan

1. Add typed helpers for chapter-scoped experiment/point options and intent templates.
2. Replace only the empty-chat prompt-card markup with the starter panel.
3. Extend point context state and generated-question submission to include stable point keys and display metadata.
4. Add a current point strip near the composer with clear behavior.
5. Validate with frontend typecheck/build and OpenSpec validation.

Rollback is straightforward: restore the prior empty-state prompt-card rendering while retaining the existing backend contract.
