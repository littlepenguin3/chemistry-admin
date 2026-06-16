## ADDED Requirements

### Requirement: Protected Core Resource Manifest

The platform SHALL define a versioned manifest for every current core resource required to rebuild or validate the production baseline.

#### Scenario: Current resources are registered
- **GIVEN** the production-readiness manifest is generated or checked
- **WHEN** it lists protected core resources
- **THEN** it includes formal experiments, the knowledge framework, the current point inventory, the current point-aware question bank, the question-bank schema, canonical chunks, canonical embeddings, manually reviewed point evidence, and current import reports
- **AND** each entry records semantic role, path or source location, required status, item count where applicable, byte size, and SHA256 where applicable

#### Scenario: Evidence file is under a historical path
- **GIVEN** a protected resource lives under an artifact path with `video` or review wording in the directory name
- **WHEN** cleanup classification runs
- **THEN** the final manually reviewed point evidence file remains classified as protected core data
- **AND** it is not deleted or overwritten by legacy artifact cleanup

### Requirement: Destructive Cleanup Guard

Cleanup tooling SHALL refuse to delete or move historical artifacts when protected current resources cannot be validated.

#### Scenario: Protected resource is missing
- **GIVEN** a cleanup command is requested
- **WHEN** any required protected resource is missing, has an unexpected count, or has a mismatched checksum
- **THEN** the cleanup command fails before deleting files
- **AND** the failure output identifies the invalid resource

#### Scenario: Legacy artifacts are removable
- **GIVEN** protected resources pass validation
- **WHEN** cleanup runs in apply mode
- **THEN** it may remove or archive historical audit packets, obsolete generated packages, temporary video/rerank outputs, screenshots, caches, frontend builds, dependency directories, and logs
- **AND** it preserves every manifest-listed protected resource

#### Scenario: Media files are removed
- **GIVEN** `data/media` cleanup is requested
- **WHEN** the database still contains media asset records that point to those files
- **THEN** cleanup requires an explicit database/UI consistency plan
- **AND** it does not leave the admin UI with records for missing local files

### Requirement: Stable Resource Defaults

Import and validation scripts SHALL use stable production resource paths by default instead of relying on deep historical artifact paths.

#### Scenario: Import script runs without overrides
- **GIVEN** a maintainer runs a current import or validation script with default options
- **WHEN** the script resolves core resource inputs
- **THEN** it reads from the stable production seed/resource locations or the manifest-declared external resource locations
- **AND** it does not require knowledge of historical review packet paths

#### Scenario: Maintenance override is needed
- **GIVEN** a maintainer needs to inspect or compare an old artifact
- **WHEN** the script is run with an explicit override path
- **THEN** the override is accepted for that run
- **AND** the protected production defaults remain unchanged

### Requirement: Behavior-Preserving Refactor Stages

Frontend and backend modularization SHALL preserve current behavior unless a separate feature spec changes it.

#### Scenario: Frontend admin modules are split
- **GIVEN** `App.tsx` and shared styles are split into routes, features, components, API clients, and scoped styles
- **WHEN** the admin web app is built and tested
- **THEN** existing routes, visible workflows, permissions, data loading behavior, and user-facing states remain equivalent
- **AND** heavy optional modules are lazy-loaded where page boundaries allow

#### Scenario: Backend admin routers are split
- **GIVEN** `experiment_admin.py` is split into routers and services
- **WHEN** existing admin endpoints are exercised
- **THEN** endpoint paths, request schemas, response schemas, permissions, and database effects remain equivalent
- **AND** any intentional contract change is deferred to a separate OpenSpec change

### Requirement: Production Validation Chain

The repository SHALL provide a documented validation chain that proves the production baseline can be built, tested, and data-validated.

#### Scenario: Maintainer validates the baseline
- **GIVEN** a maintainer runs the production-readiness validation command or documented command set
- **WHEN** validation completes
- **THEN** it checks OpenSpec strict validation, protected resource manifests, backend tests, frontend typecheck, frontend tests, frontend build, and core data counts
- **AND** it reports failures with enough detail to identify the broken stage

#### Scenario: Fresh rebuild is verified
- **GIVEN** an empty database and the declared production resources are available
- **WHEN** the documented restore/import path is executed
- **THEN** the platform can recreate the current formal experiments, knowledge framework, question bank, chunks, embeddings, and point evidence bindings
- **AND** the resulting counts match the protected baseline manifest

### Requirement: Production Operations Baseline

Production hardening SHALL document and validate the operational basics needed for maintainable deployment.

#### Scenario: Migration numbering continues
- **GIVEN** a new database migration is added after this productionization work begins
- **WHEN** the migration is named
- **THEN** it follows the next unambiguous migration number
- **AND** duplicate migration numbers are not introduced

#### Scenario: Deployment configuration is reviewed
- **GIVEN** a maintainer prepares a deployment or local production-like run
- **WHEN** they inspect repository documentation and examples
- **THEN** they can find environment variable examples, Docker service expectations, health checks, backup/restore notes, and validation commands
