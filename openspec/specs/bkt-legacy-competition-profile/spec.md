# bkt-legacy-competition-profile Specification

## Purpose
TBD - created by archiving change add-bkt-legacy-competition-profile. Update Purpose after archive.
## Requirements
### Requirement: Legacy competition profile is a separate product profile
The system SHALL provide a legacy competition profile made of separate old student and old teacher frontend products that share the current backend and core data.

#### Scenario: Legacy profile is inspected
- **WHEN** a maintainer inspects the implemented legacy profile
- **THEN** it MUST expose a student product identified as `web-student-old`
- **AND** it MUST expose a teacher product identified as `web-teacher-old`
- **AND** both products MUST use the same backend API and database as the current products
- **AND** the profile MUST NOT require a separate legacy database, legacy seed corpus, or legacy backend fork

#### Scenario: Current products are inspected after legacy profile is added
- **WHEN** a maintainer opens the current `web-student` or `web-teacher` products
- **THEN** the current green Atom/RAG product behavior MUST remain available
- **AND** old-profile navigation, old SYSU-red theme, and old forbidden-term gating MUST NOT replace current product behavior

### Requirement: Legacy profile centers the BKT competition narrative
The legacy profile SHALL present BKT knowledge tracing as the core personalization mechanism for experiment-video learning and smart assessment composition.

#### Scenario: Legacy product narrative is shown
- **WHEN** a student, teacher, or competition reviewer views the legacy profile's primary pages
- **THEN** visible copy MUST frame the system around inorganic chemistry experiment learning, experiment knowledge units, BKT knowledge tracing, student mastery, personalized video recommendation, smart assessment composition, and teacher learning-score review
- **AND** visible copy MUST NOT frame the old product around RAG, Agent, Atom, retrieval diagnostics, provider monitoring, or generic chatbot capability

#### Scenario: Legacy feedback loop is demonstrated
- **WHEN** the legacy profile is used for a demo flow
- **THEN** the flow MUST be able to demonstrate `AI出题 -> 教师审核 -> 题库 -> 学生测评 -> BKT掌握度 -> 推荐视频/智能组卷 -> 教师查看学情分数`
- **AND** every visible step MUST have a legacy student or teacher surface that explains the step without exposing RAG/Agent internals

### Requirement: Legacy profile hides RAG Agent Atom implementation language
The legacy profile SHALL hide implementation terminology associated with the current RAG/Agent/Atom product line from all old visible user interfaces.

#### Scenario: Legacy visible UI is scanned
- **WHEN** rendered legacy student and teacher pages, navigation, modals, drawers, toasts, empty states, error states, table headers, and button labels are scanned
- **THEN** they MUST NOT contain visible terms such as `Atom`, `RAG`, `Agent`, `chunk`, `embedding`, `rerank`, `Qwen`, `BGE`, `OpenAI`, `ES诊断`, `智能监控`, or `学习助手`
- **AND** the scan MUST allow legacy-facing terms such as `AI出题`, `BKT`, `掌握度`, `个性化推荐`, `智能组卷`, `学情分数`, `教材依据`, and `出题依据`

#### Scenario: Backend returns diagnostic or provider wording to an old frontend
- **WHEN** a backend response or error contains raw diagnostic, retrieval, provider, model, or agent wording
- **THEN** the old frontend MUST render a controlled legacy-facing message
- **AND** it MUST NOT show the raw internal wording as normal visible UI

### Requirement: Legacy visual identity uses SYSU red branding
The legacy profile SHALL use official SYSU red branding and traditional teaching-platform visual language that is distinct from the current green modern product.

#### Scenario: Legacy brand tokens are inspected
- **WHEN** the legacy frontend theme is inspected
- **THEN** it MUST define SYSU red as the canonical primary brand color using the official SVG-derived red value approximately `#740003`
- **AND** the legacy theme MUST NOT depend on the current green Atom/RAG theme tokens for primary navigation, primary buttons, active states, or brand marks

#### Scenario: Legacy SYSU assets are used
- **WHEN** a legacy frontend is built
- **THEN** required SYSU logo assets MUST be loaded from repository-managed old-app assets
- **AND** those assets MUST originate from the official SYSU asset directory supplied during specification
- **AND** the build MUST NOT reference `E:\迅雷下载\sysu-logo-main` as a runtime or build-time path

#### Scenario: Reviewer compares old and current products
- **WHEN** a reviewer compares the old products with the current products
- **THEN** the old products MUST differ in primary color, school identity, navigation composition, page layout rhythm, player treatment, and AI/RAG copy exposure
- **AND** the difference MUST be more substantial than a color-token swap

### Requirement: Legacy profile preserves shared data self-consistency
The legacy profile SHALL reuse current runtime data without creating old-only seed mutations that can diverge from the current backend state.

#### Scenario: Legacy products read catalog and assessment data
- **WHEN** the old student or teacher frontend loads catalog, video, question bank, assessment, mastery, or analytics data
- **THEN** it MUST read from the same backend API and database records used by current products
- **AND** it MUST NOT transform seed identities into old-only ids that cannot be used by current backend services

#### Scenario: Legacy profile is deployed after seed validation
- **WHEN** production resource validation or seed validation is run
- **THEN** legacy frontend assets MUST NOT require changing chemistry dictionaries, question-bank seed records, student learning profiles, or media binding identities
- **AND** any legacy-specific sample or branding asset MUST be isolated from runtime chemistry seed data

### Requirement: Legacy runtime validation uses an old-only compose boundary
The legacy product SHALL provide a compose entrypoint that validates the old student, old teacher, and old-scoped backend runtime without starting the unrelated mainline application stack.

#### Scenario: Maintainer starts the legacy runtime
- **WHEN** a maintainer needs to run or validate the old competition profile in containers
- **THEN** they MUST be able to use an old-specific compose file or profile that starts only the old frontend services and the backend surface needed by old
- **AND** the runtime MUST NOT start current `web-student`, `web-teacher`, `web-admin`, Elasticsearch, video worker, or other mainline-only services by default
- **AND** old student MUST default to port `15176`
- **AND** old teacher MUST default to port `15177`
- **AND** the old runtime MAY connect to the shared core database and media storage rather than creating a parallel old database

#### Scenario: Maintainer verifies old backend changes
- **WHEN** old-scoped backend routes, schemas, services, or association tables are changed
- **THEN** validation MUST rebuild or restart the old backend runtime so Python changes are present in the running container
- **AND** validation MUST check backend health and route registration/auth boundaries
- **AND** validation MUST execute the old service or endpoint path against the real database schema, not only mocked sessions
- **AND** validation MUST prove old-only storage such as recommended-learning association tables is isolated from main catalog/media/BKT identities
- **AND** any temporary recommendation toggles or smoke-test rows MUST be removed after validation
- **AND** a real-schema failure such as a missing SQL column MUST block acceptance until fixed

### Requirement: Legacy student navigation exposes four first-level modules
The legacy student product SHALL expose four first-level modules labeled `主页`, `学习`, `评测`, and `报告`.

#### Scenario: Legacy student opens the old product
- **WHEN** an authenticated student opens `web-student-old`
- **THEN** the first-level navigation MUST show exactly the student modules `主页`, `学习`, `评测`, and `报告`
- **AND** `主页` MUST be the default active module
- **AND** the bottom navigation active tab treatment MUST remain square with no rounded modern-pill styling
- **AND** the navigation MUST NOT show Atom, RAG, Agent, learning assistant, intelligent monitoring, provider, or retrieval-diagnostic entries

#### Scenario: Student switches modules
- **WHEN** the student selects a first-level module
- **THEN** the old app MUST route to that module without loading the modern student app shell
- **AND** current `web-student` routes and navigation MUST remain unchanged

### Requirement: Legacy student home is a finite all-point video library
The legacy student `主页` SHALL behave as an experiment video-point library that defaults to all student-visible experiment point nodes, not as a personalized discovery or infinite recommendation stream.

#### Scenario: Student opens legacy home without a query
- **WHEN** an authenticated student opens old `主页` without a search query
- **THEN** the page MUST render published experiment point nodes from the finite video-point library
- **AND** point nodes MUST be shown whether or not they currently have bound playable video media
- **AND** the data request MUST use shared student learning/catalog APIs or an equivalent finite all-point data source
- **AND** the page MUST NOT request or render the personalized `发现`/`discover` stream as the primary home content
- **AND** the page MUST NOT repeat canonical point nodes merely to keep the home scrolling

#### Scenario: Legacy home copy is inspected
- **WHEN** visible old `主页` copy is inspected
- **THEN** the page MUST present itself as `实验视频库`, `全部视频点位`, or equivalent all-point video-library wording
- **AND** it MUST NOT describe the primary home list as a personalized recommendation feed, discovery stream, or infinite recommendation flow
- **AND** BKT recommendation wording, if present elsewhere in old student, MUST NOT redefine old `主页` as personalized video recommendation

#### Scenario: Legacy home reaches the end of available point nodes
- **WHEN** all matching video-point library items have been loaded for the current old home view
- **THEN** the page MUST stop showing more items
- **AND** any additional loading control MUST preserve finite all-point pagination
- **AND** the page MUST render a controlled old-style empty or end state rather than cycling point nodes

### Requirement: Legacy student search is owned by the home video library
The legacy student product SHALL provide experiment-video search only from `主页`.

#### Scenario: Student searches from legacy home
- **WHEN** the student enters a query on old `主页`
- **THEN** the app MUST search within student-visible experiment video and point content
- **AND** the results MUST replace or filter the home video-library list in one coherent result view
- **AND** the results MUST route video or point selections to old point detail using shared catalog identities
- **AND** the search MAY use an old-scoped lightweight backend endpoint when the main video-library search endpoint is too broad or slow for the legacy surface
- **AND** the page MUST NOT render modern no-query recommendation sections, recommended search terms, category chips, or learning-scope search panels

#### Scenario: Student opens legacy learning
- **WHEN** the student opens old `学习`
- **THEN** the page MUST NOT show the old home video-library search box
- **AND** it MUST NOT provide a global search entry for videos, directories, Atom, RAG, or all-site content
- **AND** any future element locator in the periodic table MUST only select or highlight elements and MUST NOT call video-library search

### Requirement: Legacy student learning uses periodic-table catalog drilldown
The legacy student `学习` module SHALL provide a chemistry-logic navigation path from periodic table selection to catalog directories and point detail.

#### Scenario: Student opens legacy learning root
- **WHEN** an authenticated student opens old `学习`
- **THEN** the page MUST show a periodic-table entry surface rather than a textbook chapter tree as the first learning surface
- **AND** the page MUST load available learning profiles from the shared student learning API
- **AND** the periodic table MUST render a complete table including separate lanthanide and actinide rows
- **AND** the page MUST use old SYSU-red/traditional styling rather than the current green modern H5 shell

#### Scenario: Student filters learning chapters by periodic-table area
- **WHEN** the student opens old `学习`
- **THEN** `可学习章节` MUST default to all loaded learning profiles
- **WHEN** the student selects an element-area chip such as `p区元素` or `s区元素`
- **THEN** `可学习章节` MUST update to only profiles whose element symbols belong to the selected area
- **AND** selecting the same area again MAY clear the area filter and restore all profiles
- **AND** learning chapter cards MUST show only the short family or chapter name inside parentheses, such as `卤素`, not the full `17族（卤素）` label

#### Scenario: Student selects an element with a matching learning profile
- **WHEN** the student selects an element on the old periodic table and a matching family or chapter profile exists
- **THEN** the app MUST open the matching family or chapter learning view
- **AND** the view MUST preserve selected element context where available
- **AND** the app MUST NOT open an Atom model, AI assistant, or modern element-detail route as the primary action

#### Scenario: Student browses family or chapter content
- **WHEN** the student is on a family or chapter learning view
- **THEN** the page MUST show catalog-backed learning entries such as property categories, directories, subdirectories, and point entries for the selected profile
- **AND** selecting a directory MUST move to that directory layer while preserving profile/chapter context
- **AND** selecting a point MUST open old point detail for that point
- **AND** unavailable, draft, archived, or unplayable student-hidden content MUST NOT be rendered as normal learning entries

#### Scenario: Student views old chapter or directory drilldown
- **WHEN** the student is on an old family/chapter view or a nested directory view
- **THEN** the upper section MUST show only the same-family element cards and the current selected element card
- **AND** the drilldown top bar MUST show an old-style breadcrumb entry for `元素周期表` plus the current chapter label, where `元素周期表` returns to the periodic-table root
- **AND** the content section MUST render each directory or video point as one full-width row entry
- **AND** the view MUST NOT render extra chapter hero copy, property-card grids, breadcrumb strips, or directory-positioning description blocks

#### Scenario: Student opens point detail from legacy learning
- **WHEN** the student opens a point from the old learning drilldown
- **THEN** point detail MUST use the old native/simple video treatment
- **AND** point detail MUST show traditional experiment content sections such as phenomenon, principle, safety, or learning notes when available
- **AND** point detail MUST show related experiment links when the shared point-detail payload provides related points
- **AND** related experiment links MUST open the old native/simple point detail using shared catalog node identities
- **AND** point detail opened from old `主页` MUST show `返回首页` and navigate back to the old home video library
- **AND** point detail opened from old `学习` MUST show `返回学习目录` and navigate to the owning catalog directory for the current experiment point
- **AND** point detail MUST provide a full-width `进行学后测评` action after the learning content and related experiment links
- **AND** the `进行学后测评` action MUST start a point-scoped post-learning assessment for the current point
- **AND** point detail MUST NOT render the modern custom player chrome, Atom action surface, RAG explanation controls, or assistant context tools
- **AND** point detail MUST NOT render a synthetic `BKT 后续建议` content block in place of related experiment links or the assessment action

#### Scenario: Selected element has no published profile
- **WHEN** the student selects an element that cannot be mapped to a published learning profile
- **THEN** the app MUST render a controlled old-style unavailable state
- **AND** it MUST NOT expose raw backend errors, seed identifiers, retrieval internals, or provider/model wording

### Requirement: Legacy student enhancement preserves shared data boundaries
The legacy student video library and learning drilldown SHALL reuse current backend data and MUST NOT create a parallel old content corpus.

#### Scenario: Legacy student loads video and learning content
- **WHEN** old `主页` or `学习` loads videos, learning profiles, directories, or point details
- **THEN** it MUST call shared backend APIs and use shared catalog, media, learning-profile, assessment, and mastery identities
- **AND** it MUST NOT require old-only seed records, old-only media bindings, old-only point ids, or a separate old database

#### Scenario: Legacy student implementation is inspected
- **WHEN** maintainers inspect the old student implementation
- **THEN** any copied or adapted periodic-table and catalog logic MUST remain scoped to the old frontend or shared frontend-safe utilities
- **AND** it MUST NOT modify chemistry seed data, production resource manifests, BKT model state, or current student app behavior merely to support the old UI

#### Scenario: Legacy backend support becomes necessary
- **WHEN** the old competition profile requires backend support that cannot be satisfied by existing shared student APIs
- **THEN** the implementation MUST add old-scoped backend adapters, routes, schemas, or services rather than changing existing mainline student or teacher API semantics
- **AND** any old-scoped backend route MUST be clearly namespaced for the legacy product, such as an `old`/`legacy` module or route prefix
- **AND** the old-scoped backend MAY read shared database tables and shared published content identities
- **BUT** it MUST NOT require old-only seed records, mutate shared seed/resource manifests, fork catalog/media/BKT identities, or change the behavior of current `web-student`, `web-teacher`, or shared API clients

#### Scenario: Legacy home uses an old-scoped point library endpoint
- **WHEN** old `主页` loads its default point list or query results
- **THEN** it MAY call a legacy namespaced endpoint that returns only old-home point-library fields
- **AND** that endpoint MUST include published point nodes without playable video media
- **AND** point nodes with playable published video media MUST be returned before point nodes without playable video media
- **AND** point thumbnails returned by the endpoint MUST use student-accessible media thumbnail API routes rather than raw media storage-relative file paths
- **AND** teacher-selected recommended learning points MUST be returned before ordinary point nodes only within the same video-availability group
- **AND** it MUST NOT return modern browse recommendations, AI prompt targets, diagnostic metadata, provider names, retrieval fields, or category-chip payloads
- **AND** current mainline video-library search and home-feed endpoints MUST keep their existing response shapes and semantics

#### Scenario: Teacher sets legacy recommended learning points
- **WHEN** a teacher or admin opens the legacy teacher backend
- **THEN** they MUST be able to mark or unmark published experiment point nodes as `推荐学习`
- **AND** the setting MAY be stored in an old-scoped association table separate from the main catalog identity tables
- **AND** marked points MUST show a `推荐学习` label in the old student video library
- **AND** marked points MUST be ordered before ordinary points within the same video-availability group in the old student video library

### Requirement: Legacy student assessment uses a unified setup page
The old student `评测` module SHALL present smart weak-point testing and self-selected experiment practice as one traditional assessment setup page rather than separate modern entry cards.

#### Scenario: Student opens legacy assessment root
- **WHEN** a logged-in old student opens `评测`
- **THEN** the page MUST render a SYSU-red old-style assessment setup form
- **AND** it MUST show the BKT assessment narrative in legacy-facing terms such as `掌握度`, `薄弱项`, `智能组卷`, `实验范围`, and `题数`
- **AND** it MUST NOT render the previous one-button-only smart assessment page as the primary experience
- **AND** it MUST NOT expose Atom, RAG, Agent, learning assistant, retrieval, provider, model, chunk, embedding, rerank, or monitoring wording

#### Scenario: Student sees one combined assessment control surface
- **WHEN** the assessment setup page loads successfully
- **THEN** it MUST show mode controls, experiment-range controls, question-count controls, and one primary start action on the same page
- **AND** it MUST NOT require the student to choose between separate `智能组卷` and `自主测评` launcher cards before seeing the experiment list
- **AND** the page MUST keep a square, old teaching-platform layout using form rows, checkbox rows, or table-like list rows rather than modern rounded mobile cards

#### Scenario: Assessment options are loaded
- **WHEN** the old assessment setup page needs experiment-range data
- **THEN** it MUST load available experiment options from the current student custom-assessment options API or an old-scoped adapter with equivalent shared identities
- **AND** each selectable row MUST show the experiment title and available question count
- **AND** rows with no available questions MUST be disabled or visibly unavailable rather than selectable as normal rows
- **AND** the option identities MUST remain current backend experiment ids, not old-only ids

#### Scenario: Assessment options fail to load
- **WHEN** experiment-range options cannot be loaded
- **THEN** the old frontend MUST render a controlled old-style unavailable or retry state
- **AND** it MUST still allow `智能薄弱项测试` to be started if the smart-assessment start API is available independently
- **AND** it MUST NOT show raw backend diagnostics, provider names, SQL, retrieval, or model wording

### Requirement: Legacy assessment setup supports smart selected random and all-range modes
The old student assessment setup SHALL support `智能薄弱项测试`, `自选实验范围`, `随机练习`, and `全部范围` modes with clear request semantics.

#### Scenario: Student starts smart weak-point testing
- **WHEN** the student selects `智能薄弱项测试` and clicks the primary start action
- **THEN** the old frontend MUST call the current smart assessment start API
- **AND** the request MUST let the backend/BKT algorithm choose weak, unmeasured, or otherwise prioritized assessment coverage
- **AND** the request MUST include the student-selected question count when one is selected
- **AND** manual experiment checkbox selection MUST NOT be required for this mode
- **AND** the resulting session MUST open in the old exam-taking page

#### Scenario: Student starts selected-range practice
- **WHEN** the student selects `自选实验范围`, selects one or more experiments, chooses a question count, and clicks the primary start action
- **THEN** the old frontend MUST call the current custom assessment start API with the selected experiment ids and question count
- **AND** the resulting session MUST open in the old exam-taking page
- **AND** if no experiment is selected, the page MUST show a legacy-facing validation message instead of starting a request

#### Scenario: Student starts random practice
- **WHEN** the student selects `随机练习` and clicks the primary start action
- **THEN** the old frontend MUST choose eligible experiment ids from the currently available option set or current filtered option set
- **AND** it MUST call the custom assessment start API with the generated random experiment id set and selected question count
- **AND** it MUST show enough selected/random context before or after start for the student to understand that this was range-randomized practice
- **AND** it MUST NOT describe random practice as the BKT weak-point algorithm

#### Scenario: Student starts all-range practice
- **WHEN** the student selects `全部范围` and clicks the primary start action
- **THEN** the old frontend MUST select all eligible experiments with available questions
- **AND** it MUST call the custom assessment start API with those experiment ids and selected question count
- **AND** it MUST not include disabled or zero-question rows in the request

#### Scenario: Student changes search filter and batch selection
- **WHEN** the student types in the assessment search field
- **THEN** the visible experiment list MUST filter by experiment title, parent title, chapter/category text, or code when available
- **AND** batch actions such as `全选当前列表`, `清空`, `随机选择`, or `仅显示有题实验` MUST operate predictably on the current eligible option set
- **AND** the selected count and target question count MUST update without navigating away from the setup page

#### Scenario: Student chooses question count
- **WHEN** custom assessment option settings provide question-count choices
- **THEN** the old setup page MUST render those choices as square old-style buttons or segmented controls
- **AND** the selected question count MUST be used for `智能薄弱项测试`, `自选实验范围`, `随机练习`, and `全部范围`
- **AND** once the student manually selects a question count, later asynchronous option loading MUST NOT silently reset it to the default count
- **AND** the page MUST fall back to safe choices such as `5`, `10`, `15`, and `20` only when the API returns no configured choices

### Requirement: Legacy generated assessments open in an old exam-taking page
The old student frontend SHALL route smart, custom, random, all-range, and point-scoped generated assessment sessions into an old-style exam-taking page.

#### Scenario: Smart assessment session is generated
- **WHEN** the old setup page receives a smart assessment session response
- **THEN** it MUST store the session payload in old frontend session storage or equivalent old-scoped transient storage
- **AND** it MUST navigate to an old route such as `/assessment/session/:sessionId`
- **AND** the old bottom navigation MUST keep `评测` active while the session page is open

#### Scenario: Custom assessment session is generated
- **WHEN** the old setup page receives a custom assessment session response from selected, random, or all-range mode
- **THEN** it MUST store the session payload in old frontend session storage or equivalent old-scoped transient storage
- **AND** it MUST navigate to the same old exam-taking route used by smart sessions
- **AND** the page copy MUST distinguish custom/self-selected practice from BKT smart weak-point testing

#### Scenario: Point post-learning assessment is generated
- **WHEN** the student clicks `进行学后测评` on an old point detail page and the backend returns a point-scoped assessment session
- **THEN** the old frontend MUST navigate to the old exam-taking page rather than only rendering a composition summary
- **AND** the exam page MUST label the session as point-scoped or post-learning assessment using old-facing copy
- **AND** the route MUST preserve the old product boundary and bottom navigation behavior

#### Scenario: Session route is opened without stored payload
- **WHEN** a student opens an old assessment session route and the generated session payload is unavailable
- **THEN** the old frontend MUST render a controlled old-style state telling the student to return and start a new assessment
- **AND** it MUST NOT attempt to recreate an arbitrary session with unrelated questions
- **AND** it MUST NOT show raw storage, JSON parsing, or backend diagnostic errors

### Requirement: Legacy exam page renders a square paper-like answering experience
The old student exam-taking page SHALL render current assessment questions in a traditional square examination layout while preserving current answer semantics.

#### Scenario: Student opens an old exam session
- **WHEN** a stored smart, custom, or point assessment session is opened
- **THEN** the page MUST show an old-style exam heading with session mode, covered experiments or points, total question count, and composition hints when available
- **AND** it MUST render question cards with square borders and old teaching-platform spacing
- **AND** it MUST NOT import or visually expose the modern green H5 assessment panel style

#### Scenario: Single choice question is rendered
- **WHEN** a question has `question_type` equal to `single_choice`
- **THEN** the page MUST render each option as a selectable square row
- **AND** selecting one option MUST store that option as the answer for the question
- **AND** the selected state MUST be visible without relying only on color

#### Scenario: True false question is rendered
- **WHEN** a question has `question_type` equal to `true_false`
- **THEN** the page MUST render exactly two answer choices for `正确` and `错误`
- **AND** selecting one choice MUST store a backend-compatible true/false answer value

#### Scenario: Fill blank question is rendered
- **WHEN** a question has `question_type` equal to `fill_blank`
- **THEN** the page MUST render a square old-style text input
- **AND** the typed value MUST be stored as the answer for that question

#### Scenario: Student submits before all questions are answered
- **WHEN** at least one rendered question has no answer
- **THEN** the submit action MUST be disabled or MUST show a clear old-style validation message
- **AND** the frontend MUST NOT submit a partial answer payload as if it were complete

#### Scenario: Student submits completed answers
- **WHEN** every question has an answer and the student submits
- **THEN** the old frontend MUST call the current smart-assessment submit API with the session id and answer list
- **AND** while the submission/report-generation request is in progress, the old frontend MUST show a centered old-style `AI 正在分析` loading overlay rather than relying only on button text
- **AND** the backend MUST remain responsible for scoring, BKT mastery updates, report creation, and next recommendations
- **AND** the old frontend MUST render or navigate to an old-compatible result/report state after successful submission

#### Scenario: Backend returns an underfilled assessment
- **WHEN** a generated assessment contains fewer questions than requested because the available question bank is insufficient
- **THEN** the old exam page or setup transition MUST show a controlled old-style notice with the actual and requested question counts
- **AND** it MUST still allow the student to answer the generated questions

### Requirement: Legacy student report center separates overview and history
The old student `报告` module SHALL present a report-centered learning feedback surface, not a personal-center page.

#### Scenario: Student opens report center
- **WHEN** an authenticated student opens old `报告`
- **THEN** the page MUST keep the student identity card as context
- **AND** it MUST show a square old-style switch between `概况` and `历史报告`
- **AND** `概况` MUST be the default selected view
- **AND** the view MUST NOT show raw TKE/TKT values, raw BKT probability vectors, Agent/RAG/Atom wording, provider names, retrieval diagnostics, or model names

#### Scenario: Student views report overview
- **WHEN** `概况` is selected
- **THEN** the page MUST show aggregate report data such as report count, average score, and pending wrong-question review count
- **AND** it MUST show the latest assessment/report summary when one exists
- **AND** the latest assessment/report summary MUST provide a `查看报告` action that opens that report detail directly
- **AND** the overview MUST NOT duplicate the full historical report list

#### Scenario: Student views historical reports
- **WHEN** `历史报告` is selected
- **THEN** the page MUST show the student's durable legacy report list
- **AND** the list MUST show at most 10 reports per page
- **AND** pagination controls MUST show the current page and total page count
- **AND** `上一页` and `下一页` controls MUST be disabled or unavailable when the student is already at the first or last page
- **AND** selecting a report MUST open the old report detail route for that report

### Requirement: Legacy report detail uses AI summary and per-question review
The old report detail SHALL show a concise AI learning summary and per-question wrong-answer review without exposing modern report internals.

#### Scenario: Student opens old report detail
- **WHEN** a student opens an old report detail
- **THEN** the top bar MUST show `学习报告`
- **AND** the back action MUST be labeled `返回报告主页`
- **AND** report score/count metadata MAY be shown as old-style summary metrics
- **AND** the page MUST preserve the legacy forbidden-term gate for Atom, RAG, Agent, chunk, embedding, provider, model, retrieval diagnostics, TKE, and TKT

#### Scenario: AI learning summary is shown
- **WHEN** the report has persisted AI summary text
- **THEN** the `AI 学情总结` section MUST render only the AI summary text
- **AND** it MUST NOT append duplicate local next-step text, fallback narration, or raw mastery diagnostic content in the same section

#### Scenario: Wrong questions are reviewed
- **WHEN** the report contains wrong questions
- **THEN** the `错题解析` section MUST render one old-style card per wrong question
- **AND** each card MUST show the question stem, option list when available, the student's wrong answer as `做错项`, the correct answer as `正确选项`, and a compact `AI 解析` block
- **AND** the `AI 解析` block MAY use the stored question-bank/database explanation when no structured per-question AI explanation exists
- **AND** the old frontend MUST NOT render a single full-width global `AI 错题解析` paragraph that displaces the per-question review content
- **AND** the answer comparison MUST use compact rows rather than large answer boxes that crowd out the explanation

#### Scenario: Report has no wrong questions
- **WHEN** the report contains no wrong questions
- **THEN** the detail page MUST render a controlled old-style `本次没有错题。` state
- **AND** it MUST still show the AI learning summary when available

### Requirement: Legacy assessment implementation preserves current product and data boundaries
The old assessment implementation SHALL reuse current assessment APIs and data identities unless old-scoped adapters are explicitly necessary.

#### Scenario: Maintainer inspects old assessment API usage
- **WHEN** the implementation is inspected
- **THEN** old assessment setup, session, point post-learning assessment, and submission flows MUST use current student assessment endpoints when possible
- **AND** any backend code introduced solely for old assessment MUST be clearly old-scoped or legacy-scoped
- **AND** the implementation MUST NOT change current `web-student` assessment routes, modern assessment UI, or mainline API semantics merely to support old styling

#### Scenario: Assessment data is inspected after implementation
- **WHEN** generated assessment sessions, submitted answers, mastery updates, reports, or experiment/question ids are inspected
- **THEN** they MUST use current backend identities and current BKT/reporting mechanisms
- **AND** they MUST NOT require old-only question records, old-only experiment records, old-only mastery rows, or a separate legacy database

#### Scenario: Legacy assessment UI is scanned
- **WHEN** old assessment setup, exam, loading, empty, validation, and error states are scanned
- **THEN** they MUST preserve the legacy forbidden-term gate for Atom, RAG, Agent, chunk, embedding, rerank, Qwen, BGE, OpenAI, learning assistant, intelligent monitoring, provider, and retrieval diagnostics
- **AND** they MAY show legacy-facing AI/BKT terms such as `AI出题`, `BKT`, `掌握度`, `智能组卷`, `薄弱项`, `题库`, and `学情`
