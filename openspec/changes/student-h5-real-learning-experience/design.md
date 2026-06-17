## Context

The current `main` branch is the productionized baseline. The student H5 app is served at `/`, the admin console remains under `/admin`, and the backend already has student login, forced password change, class roster management, platform feature switches, student AI guardrails, and admin feedback management.

The customer-facing student learning page still needs to move from the prototype shape (`area -> experiment group -> experiment detail/video`) to a more polished "family properties -> related experiment points -> point video/explanation" learning experience. The customer's reference design emphasizes visually attractive base chemistry facts, but the product learning focus remains video/experiment points rather than long textbook reading.

Another contributor is working on learning reports. This change must avoid report/analytics feature work except for preserving existing student events.

## Goals / Non-Goals

**Goals:**
- Preserve and clarify student activation/login/password semantics across H5 and admin class management.
- Add a stable student app configuration contract so H5 can hide/show AI and feedback entry points based on admin settings.
- Add explicit display-oriented seed data for element/family properties; do not derive H5 display facts from RAG chunks at request time.
- Rebuild the student learning surface around:
  1. an upper family/element property section; and
  2. a lower related experiment-point flow, where videos and point explanations remain the primary learning activity.
- Improve student chat with markdown rendering, point-aware quick prompts, and student-readable evidence/source summaries while keeping teacher-only diagnostics out of H5.
- Add a global H5 feedback entry that submits to the existing `student_feedback` storage and admin feedback management.
- Keep work on a local feature branch and do not push remote during this change.

**Non-Goals:**
- No learning-report or analytics redesign.
- No WebSocket/SSE settings broadcast infrastructure.
- No migration of RAG chunk or embedding data.
- No new video-processing pipeline.
- No teacher learning assistant redesign beyond reusing compatible presentation ideas.
- No hard dependency on external AI calls to generate runtime UI facts.

## Decisions

### Decision: Student H5 is a phone-first mini-program/WebView surface

Treat `apps/student-web` as the student-facing H5 / mini-program WebView client. It is not a desktop admin console and must not inherit admin-console density, table-first layouts, or hover-only interaction patterns.

The design target is common phone viewports, especially 360px to 430px CSS pixel widths. Desktop browser usage is a development convenience only: the app may center or constrain a phone-width layout on desktop, but the product experience must be judged by phone ergonomics.

Practical guardrails:
- primary flows must be fully touch reachable: login, initial password change, temporary pretest skip, learning profile, property selection, point detail, chat, feedback, and logout;
- bottom navigation, floating feedback, chat controls, and sticky actions must avoid overlap and respect mobile safe-area expectations;
- repeated point cards and property cards must use responsive constraints that prevent horizontal scroll at phone widths;
- future visual QA should include at least 360x780, 390x844, and 430x932 viewports before considering student H5 changes complete.

Rationale: the user population will experience this as a phone H5 / mini-program page. A layout that only looks acceptable in a desktop browser is not acceptable for this product surface.

### Decision: Pull-based student app configuration instead of WebSocket

Add `GET /api/student/app-config` for authenticated students. It returns learning feature flags from `platform_settings` and AI enabled flags from `ai_configuration`.

The student H5 app refreshes this config on app start, route/screen changes, and window focus. A light periodic refetch is acceptable. Protected actions still enforce flags server-side:
- student chat rejects when `learning_features.ai_assistant_enabled` or `enabled_features.student_ai_assistant` is false;
- feedback submission rejects when `learning_features.feedback_enabled` is false.

Rationale: the product only needs near-real-time H5 entry visibility and immediate server-side enforcement. WebSocket would add authentication, reconnect, deployment, and operational complexity without enough value for this stage.

Alternative considered: WebSocket broadcast from admin settings save. Rejected for this iteration because it is overbuilt and does not replace server-side authorization checks.

### Decision: Explicit element/family profile seed

Create a maintained seed such as `data/seed/student_learning/element_profiles.json`. It contains display fields for the H5 learning page:
- chapter/family identity and display order;
- hero/summary information;
- basic property cards, including atomic number, electron configuration, group, common valence, elemental state, oxidizing/reducing tendency;
- property categories such as oxidation, reduction, metal/non-metal reaction, disproportionation, and memorable caution/exception items;
- optional element symbols to highlight.

Rationale: the customer wants polished common-knowledge display cards. RAG chunks and table records remain evidence resources, but runtime H5 display data must be stable, curated, and testable.

Alternative considered: parse canonical chunks dynamically. Rejected because chunk structure is optimized for retrieval, not stable UI contracts.

### Decision: Keep video/point as the learning spine

The new learning API should aggregate current `formal_experiments` rows by existing `metadata.parent_code`/`parent_title`, where each row is effectively a point/module in the student flow. Related point cards use existing fields:
- `id`, `code`, `title`, `summary`;
- `metadata.parent_code`, `parent_title`, `module_display_title`;
- `metadata.video_candidates`;
- published media bindings when available;
- published question count.

The H5 page presents:
- family overview;
- property list;
- selected property's experiment-point list;
- point detail with video when available, phenomenon/principle placeholders from seed or existing summaries, and chat context.

Rationale: this preserves current data, events, posttest linkage, and video assets while making the top-level UI match customer intent.

### Decision: Student chat shows useful evidence, not teacher diagnostics

The backend already streams final agent response objects with `sources`, `mode`, `classification`, `guardrail_decisions`, and `rag_trace`. H5 will store the final response and show:
- markdown/KaTeX-capable answers;
- context title and active point;
- quick prompts derived from property/point context;
- a compact "依据来源" summary from `sources`.

H5 will not show full guardrail diagnostics, full RAG trace JSON, policy internals, or asset debugging controls.

Rationale: students need trust and source hints; teachers need diagnostics. The two surfaces share data but not the same UI density.

### Decision: Feedback uses the existing feedback backend

Add a student-scoped feedback route that derives `student_id` and `class_id` from the authenticated token and accepts only the student-entered feedback fields plus page context. The route calls the existing `create_feedback_record` function, so admin feedback management continues to work unchanged.

The H5 global feedback entry is visible only when authenticated and feedback is enabled. It captures:
- feedback type;
- content;
- current screen/path;
- chapter/experiment/point context;
- client metadata such as user agent and viewport.

Rationale: the backend already has the storage and admin workflow; only the student entry is missing.

### Decision: Admin roster reset stays class-level and activation-aware

The existing model intentionally keeps initial-password policy at the class level rather than per student. This change should keep that boundary:
- pending/unactivated roster entries use the current class initial-password policy for first login;
- activated students can be reset to a new temporary password or to student ID, with `must_change_password=true` by default;
- the admin UI copy explains that pending students have not created an account yet, while activated students can be reset.

If a per-student pending password is desired later, it should be a separate data-model change.

## Risks / Trade-offs

- [Risk] Seed profile facts can be wrong or incomplete. → Add schema-like validation and tests that required display fields exist for every supported chapter/family.
- [Risk] H5 app config can be stale for up to the refetch interval. → Enforce switches again in backend action routes and refresh on focus/screen change.
- [Risk] Student chat markdown adds bundle weight. → Lazy-load markdown rendering if practical and keep H5 evidence rendering compact.
- [Risk] Existing student H5 is still a large single file. → Keep this feature scoped but extract new pieces where it lowers risk; larger modularization can follow.
- [Risk] Learning-page route changes can affect posttest event assumptions. → Preserve `experiment_detail_opened`/learning event recording for selected point details and avoid changing posttest APIs in this iteration.
- [Risk] UI has no real videos in local seed after `data/media` cleanup. → Render point cards and empty video states gracefully; keep video stream behavior when media exists.

## Migration Plan

1. Add seed file and validation/tests.
2. Add backend schemas/services/routes in a backward-compatible way.
3. Add H5 app config, feedback API, learning API, and chat response typing.
4. Replace H5 learning surface while preserving existing auth/pretest/posttest route flow.
5. Run backend tests, frontend typecheck/tests/build, OpenSpec validation, resource validation, and local deployment smoke checks.

Rollback is straightforward: the new seed file and routes are additive; frontend changes can be reverted on the local branch before merge if the learning page needs visual revision.

## Open Questions

- Exact final UI copy and imagery can be refined after local visual review.
- Whether to keep the old area/periodic-table learning endpoint public after the H5 page stops using it can be decided after this change is stable.
