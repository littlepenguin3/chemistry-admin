## ADDED Requirements

### Requirement: Seeded media assets restore as managed active media
The media lifecycle SHALL support importing reviewed seed videos as managed active media assets without requiring browser upload or first-boot video processing before playback.

#### Scenario: Seed video is imported
- **WHEN** a reviewed media seed manifest imports a video file
- **THEN** the system MUST create or update a `media_assets` row with stable seed identity, checksum, file size, original filename, managed relative path under `MEDIA_ROOT`, active lifecycle status, and ready playback state when a playable file is provided
- **AND** it MUST verify that every restored file path stays inside `MEDIA_ROOT`.

#### Scenario: Seed video file is missing or corrupted
- **WHEN** the media seed manifest references a file whose checksum or size does not match the expected manifest
- **THEN** the import MUST fail for that media asset
- **AND** validation MUST report the missing or corrupted media file without creating a playable point binding.

#### Scenario: Seed video bypasses upload queue
- **WHEN** a seed video is restored
- **THEN** it MUST NOT appear as a pending tus upload, pending browser upload, or ordinary upload queue item
- **AND** any optional reprocessing or duplicate detection MUST be recorded as a maintenance action separate from seed restore readiness.

### Requirement: Seeded point-video bindings are explicit
The media lifecycle SHALL bind seed videos to catalog point nodes only through reviewed binding metadata.

#### Scenario: Point-video binding imports
- **WHEN** a media seed binding references a catalog node
- **THEN** the target MUST resolve to an active catalog point node and its canonical point id
- **AND** the system MUST create or update an active `experiment_catalog_point_media_bindings` row with seed metadata and display order.

#### Scenario: Binding target is ambiguous
- **WHEN** a seed video filename could match multiple catalog points or no catalog point
- **THEN** automatic import MUST refuse to bind that video without an explicit reviewed mapping entry
- **AND** validation MUST list the ambiguous filename and candidate point titles.
