## ADDED Requirements

### Requirement: Complete seed includes a usable class roster
The class roster system SHALL support deterministic seed import of one active class and its student roster for blank-server demos.

#### Scenario: Seed roster imports
- **WHEN** complete production seed bootstrap imports class roster seed data
- **THEN** it MUST create or update one active class, teacher-class ownership, class login settings, roster entries, and student profiles or linked student users according to the seed manifest
- **AND** the imported class MUST appear in ordinary teacher class workflows unless explicitly marked as hidden preview infrastructure.

#### Scenario: Seed student logs in
- **WHEN** a seeded student uses the documented seed credentials after bootstrap
- **THEN** the student H5 authentication flow MUST allow login according to the seeded class login policy
- **AND** the student MUST resolve to the seeded class roster and student profile.

#### Scenario: Roster import is rerun
- **WHEN** the same roster seed is imported again
- **THEN** existing seeded roster rows and student users MUST be updated idempotently
- **AND** duplicate active students for the same class/student identifier MUST NOT be created.
