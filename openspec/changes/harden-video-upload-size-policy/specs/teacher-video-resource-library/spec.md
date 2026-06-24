## ADDED Requirements

### Requirement: Upload policy is visible before teacher upload
The teacher video resource library SHALL display the effective original-video upload size policy before teachers start a video upload.

#### Scenario: Teacher opens video resource page
- **WHEN** the teacher video resource library loads
- **THEN** the frontend MUST request the effective media upload policy from the backend
- **AND** the metrics area MUST include a card titled `原始视频大小限制`
- **AND** the card value MUST reflect the backend runtime `MAX_MEDIA_UPLOAD_MB` policy rather than a hard-coded frontend constant.

#### Scenario: Upload policy is still loading
- **WHEN** the upload policy has not been loaded or has failed to load
- **THEN** the upload flow MUST NOT start hashing, duplicate precheck, tus upload, fallback upload, or finalization
- **AND** the UI MUST show a clear loading or error state instead of assuming there is no size limit.

#### Scenario: Upload policy changes after deployment
- **WHEN** operators change the backend upload limit and restart the backend
- **THEN** the teacher frontend MUST display and enforce the new effective limit from the policy endpoint without requiring a code change.

### Requirement: Oversized videos are rejected before upload work
The teacher video resource library SHALL reject local video files that exceed the effective upload policy before adding them to upload work.

#### Scenario: Teacher selects an oversized video
- **WHEN** a selected video file size is greater than `max_media_upload_bytes`
- **THEN** the file MUST be rejected before it enters the upload queue
- **AND** the frontend MUST NOT compute SHA-256, call duplicate precheck, start tus upload, start fallback upload, or call complete-upload for that file
- **AND** the teacher MUST see a message that includes the file size and the configured original-video size limit.

#### Scenario: Teacher selects mixed valid and oversized videos
- **WHEN** a file selection contains both videos within policy and videos above policy
- **THEN** only the within-policy videos MUST be added to the upload queue
- **AND** the oversized videos MUST be listed or summarized as rejected
- **AND** the accepted videos MUST preserve the existing serial upload behavior.

#### Scenario: Teacher retries after rejection
- **WHEN** a teacher removes or replaces an oversized file with a within-policy file
- **THEN** the upload queue MUST allow the new file to proceed through the existing duplicate precheck, resumable upload, and backend processing handoff.

### Requirement: Storage metrics distinguish playback savings from upload limit
The teacher video resource library SHALL present storage savings and upload limit as separate concepts in the metrics strip.

#### Scenario: Student playback sources exist
- **WHEN** the resource library has original source bytes and student playback-source rendition bytes
- **THEN** the `学生播放源空间` metric MUST show total student playback-source size
- **AND** it MUST also show the saved percentage derived from original bytes and rendition bytes.

#### Scenario: No student playback sources exist yet
- **WHEN** no student playback-source rendition bytes are available
- **THEN** the `学生播放源空间` metric MUST show an empty or pending value without inventing a savings percentage
- **AND** the upload limit metric MUST remain visible.

#### Scenario: Metrics strip renders final operational card
- **WHEN** the metrics strip renders the final storage-related card
- **THEN** that card MUST represent `原始视频大小限制`
- **AND** it MUST NOT continue to present the old standalone `已节省空间` metric as the final card.
