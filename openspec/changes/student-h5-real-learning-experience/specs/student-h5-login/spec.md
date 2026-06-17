## ADDED Requirements

### Requirement: Student activation state consistency
The student H5 login flow SHALL present first-login activation, forced password change, normal login, and post-reset login as one consistent account lifecycle.

#### Scenario: Pending roster student first login
- **WHEN** a roster student who has not activated an account logs in with an accepted initial password
- **THEN** the backend MUST create or bind the student account
- **AND** the H5 app MUST route the student to the forced password-change screen before protected learning screens

#### Scenario: Reset student logs in
- **WHEN** an activated student whose password was reset by an admin logs in with the reset password
- **THEN** the H5 app MUST route the student to the forced password-change screen if the backend marks `must_change_password`
- **AND** the student MUST receive a fresh token after changing the password

#### Scenario: Disabled roster student cannot continue
- **WHEN** a disabled roster student attempts first login or uses an old token for protected student APIs
- **THEN** the backend MUST reject protected access according to student authentication and role rules
- **AND** the H5 app MUST return to the login flow with a clear student-facing error
