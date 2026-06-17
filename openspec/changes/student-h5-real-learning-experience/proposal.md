## Why

The student H5 app has been integrated, but its learning surface still reflects the earlier area/group/video prototype rather than the customer-facing "family properties -> experiment point learning" experience. The next local branch should turn the student app into a coherent production learning flow while preserving the current teacher/admin workflows and the in-progress learning-report work owned by another contributor.

## What Changes

- Add a student-facing app configuration endpoint so H5 feature entry points can respect admin-controlled switches for AI assistant and feedback without requiring WebSocket infrastructure.
- Align student account activation, first login, forced password change, and admin roster password reset semantics across the H5 login flow and admin class management.
- Replace the student learning page with a real learning surface centered on explicitly seeded element/family properties and the existing video/experiment-point learning flow.
- Store display-facing element/family facts in a maintained seed file instead of deriving UI facts from RAG chunks at request time.
- Upgrade the student chat surface to match the teacher learning assistant's useful behavior for markdown rendering, point context, quick prompts, and student-readable evidence/source summaries.
- Add a global authenticated H5 feedback entry point that submits to the existing feedback backend and honors the admin feedback switch.
- Keep changes local to the feature branch; do not push remote as part of this change.

## Capabilities

### New Capabilities
- `student-h5-learning-experience`: Defines the student H5 app configuration, real learning page, explicit element/family profile seed, related experiment-point display, and global feedback entry.

### Modified Capabilities
- `student-h5-login`: Clarify that first-login activation, forced password change, and post-reset login behavior must be consistent across H5.
- `class-roster-management`: Clarify admin reset behavior, activation state copy, and roster action behavior for activated versus pending students.
- `student-chat-guardrails`: Extend student chat requirements to include H5 presentation of markdown, point context, source summaries, and feature-switch visibility.
- `ai-access-configuration`: Clarify that learning-feature switches are exposed to H5 through a pull-based app config endpoint and enforced again on protected actions.

## Impact

- Backend APIs: add `/api/student/app-config`; add authenticated student feedback submission; add or adjust student learning endpoints for family/element profiles and related experiment points; adjust class roster password reset behavior where needed.
- Backend data/resources: add a maintained `data/seed/student_learning/element_profiles.json` seed and validation coverage.
- Student frontend: update login/password copy and state handling; rebuild the learning page around family/property cards and experiment-point lists; improve chat; add a global feedback entry.
- Admin frontend: refine class roster password reset copy/state if needed; preserve existing settings page controls.
- Validation: update OpenSpec specs, unit/contract tests, frontend typecheck/tests/build, resource validation, and local deployment smoke checks.
