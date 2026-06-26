## ADDED Requirements

### Requirement: Complete seed includes a deterministic teacher account
The platform SHALL support deterministic teacher/admin account seeding for local or demo bootstrap while keeping production secrets configurable.

#### Scenario: Seed teacher account imports
- **WHEN** complete production seed bootstrap is run with teacher-account seeding enabled
- **THEN** it MUST create or update a teacher-console account with configured username, display name, role, active status, and hashed password
- **AND** it MUST NOT commit the password hash as an external API secret or provider credential.

#### Scenario: Seed teacher credentials are overridden
- **WHEN** an operator supplies teacher seed username or password overrides through CLI arguments or environment variables
- **THEN** bootstrap MUST use the provided credentials for the seeded account
- **AND** validation MUST report the username and role without exposing the plaintext password or password hash.

#### Scenario: Teacher seed is disabled
- **WHEN** the operator disables account seeding
- **THEN** bootstrap MUST leave existing teacher accounts unchanged
- **AND** validation MUST report that teacher credentials are operator-managed rather than missing seed data.
