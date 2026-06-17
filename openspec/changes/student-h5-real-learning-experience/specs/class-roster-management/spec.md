## ADDED Requirements

### Requirement: Activation-aware roster password reset
The admin class roster SHALL make student activation and password-reset behavior explicit and consistent with the student H5 login flow.

#### Scenario: Teacher views pending roster student
- **WHEN** a roster student has not completed first login and forced password change
- **THEN** the admin console MUST show the student as not activated
- **AND** it MUST explain that the student will use the class initial-password rule for first login

#### Scenario: Teacher resets activated student password
- **WHEN** a teacher or admin resets an activated student's password from the selected class roster
- **THEN** the backend MUST update that student's account password
- **AND** it MUST mark the student to change password by default
- **AND** it MUST revoke active sessions for that student

#### Scenario: Teacher attempts pending-student password reset
- **WHEN** a teacher or admin attempts to reset a pending student without an activated account
- **THEN** the system MUST avoid creating a hidden per-student password policy
- **AND** it MUST guide the teacher to use the class-level initial-password setting for pending students
