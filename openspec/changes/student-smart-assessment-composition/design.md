## Context

Current assessment behavior:

```text
Student opens /assessment
        │
        ▼
Start existing posttest
        │
        ├─ Finds experiments opened after the latest completed posttest
        ├─ Samples published questions from those experiments
        └─ Fails when there is no eligible learning activity
```

Existing data that should be reused:

- `student_experiment_mastery`: per-student, per-experiment mastery with `mastery_score`, `mastery_prob`, and `evidence_count`.
- `experiment_questions`: published question bank tied to formal experiments.
- `experiment_question_attempts`: graded attempt history that can store `attempt_kind = "smart_assessment"`.
- `platform_settings`: existing global learning behavior settings.
- class ownership and registration settings patterns in class management.

New product shape:

```text
Student opens /assessment
        │
        ├─ Smart assessment
        │  └─ System decides what to assess
        │
        └─ Custom assessment
           └─ Student chooses experiments and question count
```

## Decisions

### 1. Smart Assessment Is Separate From Posttest

Create a dedicated assessment session concept initially backed by the smart-assessment session table:

```text
student_smart_assessment_sessions
├─ id
├─ student_id / class_id
├─ status
├─ assessment_mode = "smart" | "custom"
├─ strategy_snapshot
├─ selected_experiment_ids
├─ question_ids
├─ mastery_before
├─ report
├─ created_at
└─ completed_at
```

Rationale: existing posttest is scoped to recently learned experiments. Smart assessment has a different entry point, strategy, report explanation, and admin configuration. Keeping it separate prevents "posttest" from becoming a catch-all.

Custom assessment should use separate student API routes but reuse this session lifecycle and completion/report mechanics. The table name can remain `student_smart_assessment_sessions` for the first implementation to avoid broad migration churn; `assessment_mode` distinguishes system-composed and student-selected papers.

### 2. Compose By Experiment First, Then Question

Composition order:

```text
1. Resolve effective strategy for the student class
2. Split target question count into untested and measured quotas
3. Select untested experiments from the untested pool
4. Select measured experiments using mastery-based tickets
5. Select questions inside selected experiments
6. Backfill from eligible candidates when an experiment or pool lacks enough questions
```

The unit of weighting is the experiment because mastery is experiment-level. Question selection happens after experiments are selected so experiments with larger question banks do not dominate the paper.

### 3. Untested Means No Answer Evidence

Untested experiments are not mapped to a default mastery score.

```text
Untested experiment
├─ no student_experiment_mastery row
└─ or evidence_count = 0

Measured experiment
└─ student_experiment_mastery row with evidence_count > 0
```

The first version intentionally ignores whether the student opened, watched, or viewed the experiment. "Untested" means no scored evidence.

### 4. Teacher-Facing Strategy Parameters

Effective strategy fields:

```text
SmartAssessmentStrategy
├─ enabled
├─ question_count
├─ untested_ratio_percent
├─ weak_tendency_percent
├─ max_questions_per_experiment
└─ curve parameters hidden behind defaults
```

Recommended defaults:

```text
question_count = 10
untested_ratio_percent = 20
weak_tendency_percent = 70
max_questions_per_experiment = 2
```

Admins can set global defaults. Teachers can override strategy for classes they own or are allowed to manage. Students only use the resolved effective strategy.

### 5. Weak Tendency Uses Draw Tickets

The UI should explain the model as tickets, not as opaque probability math.

Every measured experiment receives a base ticket count. Lower mastery scores add extra tickets when weak tendency is enabled:

```text
weakness = ((100 - mastery_score) / 100) ^ curve
tickets = 1 + weak_bias * max_bonus * weakness

weak_bias = weak_tendency_percent / 100
```

Teacher intuition:

```text
weak_tendency = 0%
  → measured experiments are approximately balanced

weak_tendency = 100%
  → low mastery experiments receive many more tickets
```

Example with `curve = 2`, `max_bonus = 9`, and `weak_tendency = 100%`:

```text
mastery 20: 1 + 9 * 0.8^2  = 6.76 tickets
mastery 50: 1 + 9 * 0.5^2  = 3.25 tickets
mastery 80: 1 + 9 * 0.2^2  = 1.36 tickets
mastery 95: 1 + 9 * 0.05^2 = 1.02 tickets
```

The exact defaults can be tuned during implementation, but the product contract is:

- low mastery receives more draw opportunity,
- high mastery remains possible,
- no hard threshold such as 59 vs 60 is required.

### 6. Untested Ratio Is A Separate Quota

Untested experiments do not enter the mastery curve. Their ratio controls a reserved paper quota:

```text
10-question paper
untested_ratio_percent = 20

2 questions from untested experiments
8 questions from measured experiments using mastery tickets
```

If the untested pool cannot fill the quota, the measured pool backfills. If the measured pool cannot fill, available published experiment questions backfill while preserving no-answer exposure.

### 7. Admin Preview Is Part Of The Feature

The feature must make the strategy understandable before it is saved.

Admin global settings and class settings should show:

```text
Strategy curve
mastery score → relative draw tickets

Class preview
current class mastery data → estimated experiment/source distribution
```

Recommended presentation:

```text
┌─────────────────────────────────────────┐
│ Smart Assessment Strategy               │
├─────────────────────────────────────────┤
│ Untested ratio: 20%                     │
│ Weak tendency: 70%                      │
│ Max questions per experiment: 2         │
│                                         │
│ mastery 100 ─╮                          │
│ mastery  80 ───╮                        │
│ mastery  60 ─────╮                      │
│ mastery  40 ─────────╮                  │
│ mastery  20 ─────────────╮              │
│ mastery   0 ─────────────────╮          │
└─────────────────────────────────────────┘
```

Use "relative draw tickets" for the strategy curve, not final probability. Final probability depends on the class's actual experiment set, mastery distribution, question availability, and untested ratio.

### 8. Student Report Explains The Paper

Before or during a smart assessment, students should see a concise explanation:

```text
本次智能组卷优先覆盖 mastery 较低的实验，并包含 2 道未测实验题。
```

After submission, the report should include:

- score and correct rate,
- selected experiment summaries,
- group composition summary,
- mastery before/after changes for involved experiments,
- wrong answers and explanations where existing report patterns allow them.

### 9. Open Session Reuse

If a student has an in-progress smart assessment session, starting smart assessment returns that same session. This avoids repeated clicks or refreshes changing the paper.

The same first-version rule applies across assessment modes: a student may have only one in-progress assessment session at a time. Starting smart or custom assessment while any assessment session is open returns the existing session instead of creating a second paper. The first version does not add "abandon and start over".

### 10. Backfill Rules

The paper should prioritize reaching the configured total question count:

```text
Pool quota underfilled
        │
        ▼
Backfill from eligible remaining experiments/questions
        │
        ▼
Preserve no-answer exposure and record warnings in strategy_snapshot
```

Backfill warnings should be visible in admin preview and stored in session metadata for diagnosis.

### 11. Custom Assessment V1 Scope

Custom assessment is a separate student-selected mode, not a filter on smart assessment.

Student flow:

```text
/assessment
  ├─ 智能测评: 系统自动组卷
  └─ 自主测评: 学生选择实验

/assessment/custom
  ├─ search published experiments with questions
  ├─ select one or more experiments
  ├─ choose question count from 5 / 10 / 15 / 20
  └─ start custom assessment
```

Custom assessment v1 intentionally does not include:

- weak-experiment shortcut entry,
- untested/measured/weak filters,
- wrong-answer related experiment selection,
- knowledge-point selection,
- student-facing strategy controls.

Rationale: custom assessment's first promise is simple student control: "I choose which experiments to test." The intelligent weighting model remains in smart assessment.

### 12. Custom Assessment Options

Add an options endpoint for the custom selection page:

```text
GET /api/student/custom-assessment/options
```

It returns:

```text
settings
├─ enabled
├─ question_count_options = [5, 10, 15, 20] filtered by max
├─ default_question_count
├─ max_question_count
└─ max_questions_per_experiment

experiments[]
├─ id / code / title / parent metadata
└─ question_count
```

Only published, student-visible experiments with at least one published question should be returned. Experiments with no eligible questions are excluded from v1 to avoid a selectable item that cannot generate a paper.

### 13. Custom Assessment Composition

Custom assessment start endpoint:

```text
POST /api/student/custom-assessment/start
{
  "experiment_ids": ["..."],
  "question_count": 10
}
```

Validation:

- at least one experiment id,
- all experiment ids must be present in the options result for that student,
- question count must be one of `5 / 10 / 15 / 20` and not exceed the effective max question count.

Sampling:

```text
1. Group candidates by selected experiment.
2. Stable-shuffle questions inside each experiment.
3. Round-robin across selected experiments until the target count is reached.
4. Skip an experiment when its eligible questions are exhausted.
5. Respect max_questions_per_experiment where enough selected experiments/questions exist.
```

If selected experiments cannot fill the requested question count, return the underfilled paper instead of failing:

```text
requested_question_count = 10
actual_question_count = 3
warnings.underfilled = true
```

Only an actual zero-question result should fail.

### 14. Custom Assessment Settings

Global and class settings should include custom assessment controls:

```text
CustomAssessmentSettings
├─ enabled = true
├─ default_question_count = 10
├─ max_question_count = 20
└─ max_questions_per_experiment = 3
```

Allowed student question count options are fixed to `5 / 10 / 15 / 20`; the UI hides options above `max_question_count`. The default question count must be one of the visible options.

## Risks / Trade-offs

- Ticket curves can feel arbitrary if not visualized; the preview is required to maintain teacher trust.
- Class overrides add complexity to settings ownership; reuse existing class-management access checks.
- Untested ratio can create papers that include content students have not learned; this is intentional when configured, but the UI must label it as exploration.
- Reusing `experiment_question_attempts` keeps mastery updates consistent, but reports must distinguish `smart_assessment` attempts from pretest and posttest.
- If a class has sparse mastery evidence, the measured pool may be small; backfill and preview warnings are important.
