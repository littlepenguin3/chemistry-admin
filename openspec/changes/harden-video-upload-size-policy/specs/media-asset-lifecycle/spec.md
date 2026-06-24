## ADDED Requirements

### Requirement: Media upload size policy is authoritative
The backend SHALL enforce the effective media upload size policy for every media upload path.

#### Scenario: Local deployment default is raised
- **WHEN** the local development or compose configuration is prepared for this change
- **THEN** the configured `MAX_MEDIA_UPLOAD_MB` default MUST be `8192`
- **AND** backend runtime policy responses MUST report that effective value unless operators override it.

#### Scenario: Direct upload exceeds media size policy
- **WHEN** a direct media upload request contains a file larger than `MAX_MEDIA_UPLOAD_MB`
- **THEN** the backend MUST reject the upload with a machine-readable `file_too_large` reason
- **AND** the response MUST include enough policy information for the client to explain the configured limit
- **AND** the backend MUST NOT enqueue a media processing job for that file.

#### Scenario: Resumable upload finalization exceeds media size policy
- **WHEN** a tus upload is finalized for a file larger than `MAX_MEDIA_UPLOAD_MB`
- **THEN** the backend MUST reject finalization with a machine-readable `file_too_large` reason
- **AND** the backend MUST NOT mark the media asset as pending, processing, ready, or reusable
- **AND** the backend MUST NOT enqueue a media processing job for that file.

#### Scenario: Client bypasses frontend precheck
- **WHEN** a client bypasses the teacher frontend and calls media upload APIs directly
- **THEN** the backend MUST apply the same effective size policy as the frontend policy endpoint
- **AND** it MUST reject oversized media consistently across direct upload and resumable upload finalization.

### Requirement: Oversized upload diagnostics are distinct from missing files
The media asset lifecycle SHALL distinguish size-policy failures from local media file availability failures.

#### Scenario: Oversized upload is rejected
- **WHEN** a media upload fails because the file exceeds `MAX_MEDIA_UPLOAD_MB`
- **THEN** teacher-facing diagnostics MUST describe the problem as an original video size-limit failure
- **AND** the system MUST NOT present the primary failure as `本地媒体文件缺失` or equivalent missing-file wording.

#### Scenario: Failed asset audit record is kept
- **WHEN** the system keeps an audit record for an oversized rejected upload
- **THEN** that record MUST preserve `error_reason=file_too_large`
- **AND** file-state summarization MUST prioritize the size-limit reason over placeholder path existence
- **AND** the record MUST NOT be actionable as a normal retry-processing item.

#### Scenario: Temporary resumable file remains after rejection
- **WHEN** an oversized tus upload has already reached temporary storage before backend finalization rejects it
- **THEN** the system MUST either remove the temporary file during rejection or expose enough maintenance diagnostics to identify it for cleanup
- **AND** the temporary file MUST NOT be treated as an active student playback source or processing input.
