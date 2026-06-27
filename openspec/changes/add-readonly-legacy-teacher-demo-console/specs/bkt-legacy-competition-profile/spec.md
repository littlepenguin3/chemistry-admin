## ADDED Requirements

### Requirement: Legacy teacher demo console is demo-safe
The legacy teacher product SHALL behave as a competition demo console and MUST NOT expose broad live resource-creation or mutation workflows. It MAY expose narrow existing mainline class and roster creation workflows needed to make the old student frontend usable, and the old-only recommended-learning video-point toggle MAY remain because it is part of the legacy competition profile.

#### Scenario: Teacher opens legacy teacher product
- **WHEN** an authenticated teacher or admin opens `web-teacher-old`
- **THEN** the visible teacher modules MUST focus on resource evidence, class evidence, learning analytics, and BKT evaluation
- **AND** the visible UI MAY show `创建班级` and `创建学生` only on the old class page when those actions call existing class/roster APIs
- **AND** the visible UI MUST NOT show broad live mutation controls such as `保存`, `发布`, `导入`, `重置密码`, `AI出题`, `通过入库`, or `退回修改` when those controls would mutate shared resource, catalog, question, report, prompt, media, analytics, or account-state data
- **AND** the video-resource page MAY show `设为推荐` and `取消推荐` controls only for the old-scoped recommended-learning point association
- **AND** the old teacher product MUST remain separate from the current `web-teacher` operational console

#### Scenario: Old teacher frontend API usage is inspected
- **WHEN** maintainers inspect `apps/web-teacher-old/src/api.ts` and old teacher data-loading code
- **THEN** old teacher demo resource functions MUST use read-only requests for demo data
- **AND** old teacher class management MAY call existing mainline `GET /api/admin/classes`, `POST /api/admin/classes`, `GET /api/admin/classes/{class_id}/students`, and `POST /api/admin/classes/{class_id}/students`
- **AND** old teacher demo resource functions MUST NOT call `PUT`, `PATCH`, or `DELETE` for classes or rosters
- **AND** old teacher demo resource functions MUST NOT call `POST`, `PUT`, `PATCH`, or `DELETE` for questions, question workbench sessions, prompt settings, reports, media, catalog nodes, or analytics
- **AND** the frontend MAY call the existing old-scoped recommendation `PUT` route to mark or unmark recommended-learning video points
- **AND** login/session calls MAY remain because authentication is not teacher demo data mutation

#### Scenario: Old teacher action affordances are tested
- **WHEN** old teacher pages are rendered in tests
- **THEN** tests MUST fail if a user interaction sends a non-GET request after login for teacher demo data, except the existing class/roster creation `POST` calls and the old-scoped recommendation `PUT`
- **AND** tests MUST fail if visible mutation-only labels are shown as active primary commands

### Requirement: Legacy teacher demo uses old-scoped read-only aggregation APIs
The backend SHALL provide old-scoped read-only teacher demo APIs when current admin endpoints are too broad, too operational, or expose unsafe implementation fields for the old competition surface.

#### Scenario: Legacy teacher demo API routes are inspected
- **WHEN** backend route inventory is inspected
- **THEN** old teacher demo routes MUST be namespaced under a legacy admin path such as `/api/admin/legacy/teacher-demo`
- **AND** every teacher demo data route under that namespace MUST use `GET`
- **AND** the namespace MUST NOT contain write routes for creating, updating, deleting, publishing, importing, resetting, or generating resources
- **AND** recommendation writes MUST remain outside `/api/admin/legacy/teacher-demo` on the existing old-scoped recommendation route

#### Scenario: Legacy teacher demo endpoint reads shared data
- **WHEN** a legacy teacher demo endpoint returns overview, video, question, class, analytics, weak-point, or evaluation-system data
- **THEN** it MUST read from current shared backend records and identities
- **AND** it MUST NOT require an old-only database, old-only seed corpus, old-only question records, old-only class records, old-only BKT state, or old-only report identities
- **AND** it MAY aggregate current read models into a smaller old-facing DTO

#### Scenario: Current teacher APIs are inspected after this change
- **WHEN** current `web-teacher` or current admin API behavior is inspected
- **THEN** current operational create/update/delete/import/publish/admin behavior MUST remain unchanged
- **AND** old teacher read-only constraints MUST NOT remove or weaken current product administration features

### Requirement: Legacy teacher overview demonstrates the BKT feedback loop
The old teacher `工作台` SHALL present a reviewer-friendly overview of the experiment-learning feedback loop and the resources that support it.

#### Scenario: Teacher opens old overview
- **WHEN** the teacher opens the old teacher overview page
- **THEN** the page MUST show aggregate evidence such as video point count, playable video count, question count, class count, student count, assessment/report count, or mastery evidence count when available
- **AND** the page MUST show a BKT feedback-loop explanation from experiment video learning to assessment, mastery update, teacher analytics, and review/assessment guidance
- **AND** the page MUST NOT describe the old product as a RAG, Agent, Atom, chatbot, provider-monitoring, or retrieval-diagnostic system

#### Scenario: Overview data is unavailable
- **WHEN** overview resource counts cannot be loaded
- **THEN** the old teacher product MUST show a controlled old-style unavailable state
- **AND** it MUST NOT show raw SQL, stack traces, provider names, model names, route diagnostics, or retrieval/Agent wording

### Requirement: Legacy teacher video resources page presents video-first evidence
The old teacher video resource page SHALL present the shared experiment point and video-resource inventory as the primary teacher-side evidence path.

#### Scenario: Teacher opens video resources
- **WHEN** the teacher opens the old video resource page
- **THEN** the page MUST list shared experiment point or catalog point resources with titles, catalog path, video availability, published media count, and resource status when available
- **AND** point rows with playable video MUST be visually distinguishable from point rows without playable video
- **AND** recommendation labels MAY be shown when existing legacy recommendation data is present
- **AND** the page MAY allow the teacher to mark or unmark recommended-learning point associations through the old-scoped recommendation route
- **AND** the page MUST NOT allow the teacher to reorder recommendations, upload, bind, publish, archive, or delete video resources

#### Scenario: Teacher searches or filters video resources
- **WHEN** the teacher searches or filters old video resources
- **THEN** the operation MUST filter or query read-only video-resource evidence
- **AND** it MUST NOT create saved filters or change catalog/media bindings

### Requirement: Legacy teacher question resources page presents question-bank evidence
The old teacher question resources page SHALL present AI-assisted question-bank construction as resource evidence without exposing live generation or approval actions.

#### Scenario: Teacher opens question resources
- **WHEN** the teacher opens the old question resources page
- **THEN** the page MUST show question-bank totals, published question counts, draft or review counts, question-type distribution, and chapter/experiment/point coverage when available
- **AND** the page MAY explain the legacy process as `教材/实验资料 -> AI辅助出题 -> 教师审核 -> 题库`
- **AND** the page MUST present that process as existing platform capability or resource status
- **AND** the page MUST NOT provide a real `AI出题`, workbench-session creation, publish, disable, import, export, edit, approve, or reject action

#### Scenario: Question resources use current data
- **WHEN** old teacher question resources are loaded
- **THEN** rows and counts MUST be derived from current question-bank, catalog, experiment, or draft records
- **AND** question, experiment, and point identifiers MUST remain current backend identities

### Requirement: Legacy teacher class page provides basic class and student management
The old teacher class page SHALL provide the minimal operational class and student roster management needed for the old student frontend while leaving broad administration in the current teacher console.

#### Scenario: Teacher opens class resources
- **WHEN** the teacher opens the old class page
- **THEN** the page MUST list teacher-visible classes with class name, status, description, and student count when available
- **AND** the page MUST allow creating a class through the existing mainline class creation API
- **AND** selecting a class MUST load the existing roster entries for that class
- **AND** the page MUST allow creating a roster student with student id and student name through the existing mainline roster creation API
- **AND** the page MUST explain that the old student login account is the student id and the first-login password follows the current class initial-password strategy, such as a shared class password or the student id
- **AND** the page MUST show student id, student name, activation status, and login mode for visible roster entries
- **AND** the page MUST NOT allow editing classes, assigning teachers, importing rosters, editing students, disabling students, or resetting passwords

#### Scenario: Teacher cannot access a class
- **WHEN** the teacher tries to load a class outside their access boundary
- **THEN** the backend MUST enforce the same class-access restrictions as current teacher analytics
- **AND** the old frontend MUST render a controlled legacy-facing error without exposing raw authorization diagnostics

### Requirement: Legacy teacher learning analytics page presents BKT class and weak-point evidence
The old teacher learning analytics page SHALL present class-level and point-level learning evidence derived from current BKT/mastery and assessment records.

#### Scenario: Teacher opens class learning analytics
- **WHEN** the teacher opens old learning analytics for a class
- **THEN** the page MUST show class metrics such as student count, active students, completion rate, average mastery or score, and missing students when available
- **AND** the page MUST show a student matrix or list with average score/mastery and evidence count when available
- **AND** the page MUST show weak experiment points or knowledge points with incorrect count, attempt count, and incorrect rate when available
- **AND** all analytics MUST be read-only

#### Scenario: Teacher opens student analytics from old teacher
- **WHEN** the old teacher product provides a student drilldown
- **THEN** the detail MUST read current student progress, attempts, reports, weak points, weak video points, and mastery records
- **AND** it MUST NOT expose raw TKE/TKT internals, probability vectors, Agent/RAG traces, provider names, or SQL/JSON diagnostics
- **AND** it MUST NOT allow editing the student's scores, reports, attempts, mastery state, or profile

### Requirement: Legacy teacher evaluation system explains BKT score semantics
The old teacher product SHALL provide an explicit read-only explanation of the BKT score and point-evaluation system for reviewers.

#### Scenario: Teacher opens evaluation system page
- **WHEN** the teacher opens the old evaluation-system page
- **THEN** the page MUST explain evaluated objects such as experiment point, experiment, experiment group, student, and class
- **AND** it MUST explain evidence sources such as video learning, assessment answers, wrong answers, post-learning tests, student reports, and mastery evidence
- **AND** it MUST explain that BKT-style mastery updates produce score or mastery evidence used for weak-point review and smart assessment composition
- **AND** it MUST NOT require reviewers to inspect raw backend fields to understand the evaluation system

#### Scenario: Score bands are shown
- **WHEN** the old teacher product explains score bands
- **THEN** it MUST define student-facing or teacher-facing bands equivalent to `0-59` needs focused review, `60-79` basically mastered but should consolidate, `80-100` good mastery, and no-evidence/not-yet-measured
- **AND** the page MAY show live counts per band for the selected class when available
- **AND** it MUST NOT show raw BKT probability vectors, TKE/TKT labels, or internal algorithm debug fields

### Requirement: Legacy teacher visual and copy boundaries remain old-profile safe
The old teacher demo console SHALL preserve the legacy SYSU-red teaching-platform identity and hide modern implementation language.

#### Scenario: Old teacher visible UI is scanned
- **WHEN** old teacher navigation, pages, cards, tables, loading states, empty states, errors, and toasts are scanned
- **THEN** visible UI MUST NOT contain `Atom`, `RAG`, `Agent`, `chunk`, `embedding`, `rerank`, `Qwen`, `BGE`, `OpenAI`, provider names, retrieval diagnostics, learning assistant, intelligent monitoring, or modern assistant trace wording
- **AND** visible UI MAY contain legacy-facing terms such as `AI辅助出题`, `教师审核`, `题库`, `BKT`, `掌握度`, `薄弱点`, `学情分析`, `视频资源`, and `评价体系`

#### Scenario: Old teacher visual style is inspected
- **WHEN** the old teacher product is visually inspected
- **THEN** it MUST use the SYSU-red legacy theme and traditional square teaching-platform layout
- **AND** it MUST NOT adopt the current green modern teacher shell, current monitoring dashboard style, or rounded modern AI assistant surface

### Requirement: Legacy teacher validation proves demo-safe behavior
Validation for the old teacher demo console SHALL prove both product behavior and API usage are demo-safe, with only existing class/roster creation writes and old-scoped recommendation writes allowed.

#### Scenario: Old teacher tests are run
- **WHEN** old teacher frontend tests run
- **THEN** tests MUST cover navigation, overview, video resources, question resources, class list, analytics, evaluation-system copy, and forbidden-term gating
- **AND** tests MUST assert that old teacher data interactions after login do not issue non-GET requests except `POST /api/admin/classes`, `POST /api/admin/classes/{class_id}/students`, and the old-scoped recommendation `PUT`

#### Scenario: Backend route tests are run
- **WHEN** backend route inventory or targeted route tests run
- **THEN** tests MUST prove old teacher demo routes are registered under the legacy namespace
- **AND** tests MUST prove those teacher demo data routes are GET-only
- **AND** tests MUST prove current mainline teacher/admin write routes remain registered outside the old demo namespace when they previously existed

## MODIFIED Requirements

### Requirement: Legacy student enhancement preserves shared data boundaries
The legacy student video library, legacy student learning drilldown, and paired legacy teacher resource evidence surfaces SHALL reuse current backend data and MUST NOT create a parallel old content corpus.

#### Scenario: Legacy student loads video and learning content
- **WHEN** old `主页` or `学习` loads videos, learning profiles, directories, or point details
- **THEN** it MUST call shared backend APIs or old-scoped adapters over shared records
- **AND** it MUST use shared catalog, media, learning-profile, assessment, and mastery identities
- **AND** it MUST NOT require old-only seed records, old-only media bindings, old-only point ids, or a separate old database

#### Scenario: Legacy student implementation is inspected
- **WHEN** maintainers inspect the old student implementation
- **THEN** any copied or adapted periodic-table and catalog logic MUST remain scoped to the old frontend or shared frontend-safe utilities
- **AND** it MUST NOT modify chemistry seed data, production resource manifests, BKT model state, or current student app behavior merely to support the old UI

#### Scenario: Legacy student first-login activation uses current roster accounts
- **WHEN** a roster student created from the old teacher class page signs in to `web-student-old` with the class initial password
- **THEN** the old student frontend MUST call the current student login API and accept the returned activated student session
- **AND** if the returned student user has `must_change_password`, the old frontend MUST show a legacy-styled first-login password page before entering learning content
- **AND** changing the password MUST call the current student password API and then continue with the returned student session
- **AND** the old frontend MUST NOT create a separate old activation API, old student account table, or old-only password store

#### Scenario: Legacy backend support becomes necessary
- **WHEN** the old competition profile requires backend support that cannot be satisfied by existing shared student APIs
- **THEN** the implementation MUST add old-scoped backend adapters, routes, schemas, or services rather than changing existing mainline student or teacher API semantics
- **AND** any old-scoped backend route MUST be clearly namespaced for the legacy product, such as an `old` or `legacy` module or route prefix
- **AND** the old-scoped backend MAY read shared database tables and shared published content identities
- **BUT** it MUST NOT require old-only seed records, mutate shared seed/resource manifests, fork catalog/media/BKT identities, or change the behavior of current `web-student`, `web-teacher`, or shared API clients

#### Scenario: Legacy home uses an old-scoped point library endpoint
- **WHEN** old `主页` loads its default point list or query results
- **THEN** it MAY call a legacy namespaced endpoint that returns only old-home point-library fields
- **AND** that endpoint MUST include published point nodes without playable video media
- **AND** point nodes with playable published video media MUST be returned before point nodes without playable video media
- **AND** seed placeholder videos such as `no-video-placeholder.mp4` or media marked `placeholder_video` MUST be treated as no playable video for counts, thumbnails, and ordering
- **AND** point thumbnails returned by the endpoint MUST use student-accessible media thumbnail API routes rather than raw media storage-relative file paths
- **AND** existing teacher-selected recommended learning points MAY be returned before ordinary point nodes only within the same video-availability group
- **AND** it MUST NOT return modern browse recommendations, AI prompt targets, diagnostic metadata, provider names, retrieval fields, or category-chip payloads
- **AND** current mainline video-library search and home-feed endpoints MUST keep their existing response shapes and semantics

#### Scenario: Legacy teacher manages recommended learning points
- **WHEN** a teacher or admin opens the legacy teacher demo console
- **THEN** existing recommended-learning labels MAY be displayed as resource evidence
- **AND** the old teacher video-resource page MAY allow teachers to mark or unmark recommended-learning point associations
- **AND** the old teacher demo console MUST NOT allow teachers to reorder, create arbitrary, or delete recommended-learning point associations outside that mark/unmark operation
- **AND** the old student video library MAY continue to display existing `推荐学习` labels from shared or old-scoped read-only data
- **AND** any old-scoped recommendation storage that already exists MUST remain isolated from main catalog/media/BKT identities
