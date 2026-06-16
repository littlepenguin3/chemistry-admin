## 1. Starter Data Model

- [x] 1.1 Extend learning assistant point-context types to carry chapter, experiment, point, and display metadata.
- [x] 1.2 Add helpers for stable candidate point keys, chapter experiment grouping, point options, and intent templates.

## 2. Empty-State Starter Panel

- [x] 2.1 Replace the flat empty-chat prompt cards with an experiment -> point -> intent starter panel scoped to the selected chapter.
- [x] 2.2 Ensure chapter changes reset stale experiment, point, intent, and active point selections before submission.
- [x] 2.3 Generate or prefill natural-language questions from the selected point and intent while keeping manual input available.

## 3. Chat Continuity

- [x] 3.1 Submit starter-panel questions through the existing streaming chat flow with `chapter_id`, `experiment_id`, and stable `point_key`.
- [x] 3.2 Add a visible current-point context strip near the composer with clear behavior for chapter-only questions.
- [x] 3.3 Preserve the existing timeline, follow-up, clear conversation, and diagnostics behavior after the first message.

## 4. Validation

- [x] 4.1 Run OpenSpec validation for the change.
- [x] 4.2 Run frontend typecheck and production build.

## 5. CTA Polish

- [x] 5.1 Remove the redundant manual fill-input action and keep generated questions synced automatically.
- [x] 5.2 Promote the starter preview to a single centered animated start button with exploratory motion.
- [x] 5.3 Replace the page-local animated CTA with an adapted open-source Magic UI animated button component.
- [x] 5.4 Refine the CTA copy and combine default glow with hover/focus shine motion.
- [x] 5.5 Slow the CTA motion and replace white glare with a thicker green ink-wash shimmer.
- [x] 5.6 Reassess the perimeter shimmer direction and replace it with a more reliable non-orbiting CTA motion direction.
- [x] 5.7 Replace the CTA border-orbit treatment with a non-orbiting AI glow button while preserving hover highlight.
- [x] 5.8 Strengthen the default CTA glow with larger multi-cluster irregular aurora motion.
