## 1. OpenSpec And Branch Context

- [x] 1.1 Validate the OpenSpec proposal, design, and spec deltas for `student-h5-real-learning-experience`.
- [x] 1.2 Keep all implementation work on local branch `codex/student-h5-real-learning-experience` and avoid remote push.

## 2. Backend Contracts And Seed

- [x] 2.1 Add explicit student learning profile seed data for the customer-facing family/property cards and related property sections.
- [x] 2.2 Add validation coverage for the student learning profile seed and required fields.
- [x] 2.3 Add student app-config schemas/service/route that exposes AI and feedback feature flags to authenticated H5 users.
- [x] 2.4 Add student feedback schemas/service/route that writes to the existing feedback backend and enforces the feedback switch.
- [x] 2.5 Extend student learning schemas/service/routes to return family/property profile payloads and related experiment-point groups.
- [x] 2.6 Preserve or improve activation-aware admin roster password reset behavior and copy without adding per-student pending passwords.
- [x] 2.7 Update backend route contract tests for new student app-config, feedback, and learning routes.

## 3. Student H5 Frontend

- [x] 3.1 Add student API types and client functions for app config, learning profile payloads, point detail, feedback submit, and assistant final response metadata.
- [x] 3.2 Wire H5 app-config refresh into the authenticated app and use it to hide/show AI and feedback entries.
- [x] 3.3 Rebuild the learning page around family/property overview plus related experiment-point list, preserving pretest/posttest navigation.
- [x] 3.4 Add point detail display with video empty states, context summary, and point-aware assistant context.
- [x] 3.5 Upgrade student chat rendering to support markdown-style content, final response metadata, and compact source summaries.
- [x] 3.6 Add global authenticated H5 feedback entry with page/screen context capture and switch-aware visibility.
- [x] 3.7 Keep H5 responsive and visually aligned with the provided three-layer customer design direction.

## 4. Admin Touchpoints

- [x] 4.1 Refine class roster status/reset copy so pending students and reset activated students match the H5 lifecycle.
- [x] 4.2 Ensure existing settings page switches remain the owner for H5 AI and feedback visibility.

## 5. Verification And Local Deployment

- [x] 5.1 Run OpenSpec strict validation for this change.
- [x] 5.2 Run backend tests covering auth, learning, assistant, feedback, and route contracts.
- [x] 5.3 Run frontend typecheck/tests/build for the admin and student apps as configured by the repo.
- [x] 5.4 Run production resource validation, including the new student learning seed.
- [x] 5.5 Start the local deployment/dev server stack needed for manual H5/admin inspection.
- [x] 5.6 Perform local smoke checks for login/app-config, learning page, chat visibility, feedback visibility/submission, and admin settings effects.

  Automated local smoke covered service startup, student/admin login pages, frontend API target wiring to the local new-code backend, and unauthenticated API boundaries. Authenticated H5 learning/chat/feedback behavior is ready for manual check with a real local student account.
- [x] 5.7 Document the student H5 phone-first WebView contract and require mobile viewport QA for future student-web changes.
