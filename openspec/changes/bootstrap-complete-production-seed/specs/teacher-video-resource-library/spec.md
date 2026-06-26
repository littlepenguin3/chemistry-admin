## ADDED Requirements

### Requirement: Seeded videos appear as normal stored resources
The teacher video resource library SHALL display seeded ready media assets as stored video resources without exposing them as upload-in-progress items.

#### Scenario: Teacher opens resource library after seed bootstrap
- **WHEN** a teacher opens the video resource library after complete seed bootstrap
- **THEN** seeded videos MUST appear in normal stored-resource lists with preview/playback available when their playback file exists
- **AND** the UI MUST show seed/import provenance only as metadata or diagnostics, not as an error state.

#### Scenario: Seeded video is bound to a point
- **WHEN** a seeded video has active catalog point bindings
- **THEN** the resource detail or binding diagnostics MUST show the bound point title, catalog path, and publication/readiness state
- **AND** deleting that media asset MUST follow the same impact-aware delete behavior as an uploaded stored resource.

#### Scenario: Point uses placeholder video
- **WHEN** a teacher inspects a catalog point that has no real seeded video
- **THEN** the system MUST keep the point content and question bank usable
- **AND** the video surface MUST use the generated placeholder video
- **AND** any video coverage indicator MUST distinguish placeholder footage from failed upload or missing local media file.
