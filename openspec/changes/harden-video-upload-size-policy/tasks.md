## 1. Backend Policy And Configuration

- [x] 1.1 Update local upload-limit defaults from `1024` to `8192` in `.env` and `.env.example`.
- [x] 1.2 Audit `docker-compose.yml` and runtime environment overrides to ensure backend uses the effective `MAX_MEDIA_UPLOAD_MB` from configuration instead of a stale hard-coded value.
- [x] 1.3 Add an authenticated teacher-admin media upload policy response model exposing `max_media_upload_mb` and `max_media_upload_bytes`.
- [x] 1.4 Add the media upload policy endpoint under the existing admin media API ownership.
- [x] 1.5 Reuse existing media validation constants where possible so allowed upload formats stay consistent with the displayed upload guidance.

## 2. Backend Oversize Enforcement And Diagnostics

- [x] 2.1 Update direct media upload handling so files above the effective size policy return a machine-readable `file_too_large` rejection and do not enqueue processing.
- [x] 2.2 Update tus `complete-upload` handling so oversized finalized uploads return a machine-readable `file_too_large` rejection and do not create a normal pending, processing, ready, or reusable media asset.
- [x] 2.3 Ensure oversized upload failures are not summarized as `本地媒体文件缺失` or equivalent missing-file state in teacher-facing asset data.
- [x] 2.4 Decide and implement the temporary tus file behavior for oversized finalized uploads: safe immediate deletion or maintenance-visible cleanup diagnostics.
- [x] 2.5 Add backend tests for policy endpoint output, direct oversized upload rejection, tus oversized finalization rejection, and no processing job creation.

## 3. Teacher Frontend Upload Policy

- [x] 3.1 Add teacher frontend API types and query code for the media upload policy endpoint.
- [x] 3.2 Gate upload selection/start behavior on successful policy loading, with a clear loading or error state when the policy is unavailable.
- [x] 3.3 Validate selected video file sizes against `max_media_upload_bytes` before queue insertion.
- [x] 3.4 Reject oversized selected files with a message showing both actual file size and configured original-video size limit.
- [x] 3.5 Preserve mixed-file behavior by adding within-policy files to the serial upload queue while summarizing rejected oversized files.
- [x] 3.6 Verify rejected oversized files do not trigger SHA-256 hashing, duplicate precheck, tus upload, fallback upload, or complete-upload calls.

## 4. Teacher Frontend Metrics And Failure Display

- [x] 4.1 Update the metrics strip so `学生播放源空间` shows total rendition size plus saved percentage when both values are available.
- [x] 4.2 Replace the final standalone `已节省空间` card with `原始视频大小限制` sourced from the backend policy.
- [x] 4.3 Keep empty or pending display states professional when no student playback-source bytes or upload policy data are available.
- [x] 4.4 Map `file_too_large` errors to size-limit wording in upload queue errors and stored-asset failure diagnostics.
- [x] 4.5 Add or update focused frontend tests for metrics rendering, oversized file rejection, mixed valid/oversized selection, and policy-load failure behavior.

## 5. Verification And Operations

- [x] 5.1 Run focused backend media tests covering upload policy and oversize rejection.
- [x] 5.2 Run focused teacher frontend tests for the video resource page.
- [x] 5.3 Run teacher frontend typecheck/build for changed media API and page types.
- [x] 5.4 Manually verify with a low temporary `MAX_MEDIA_UPLOAD_MB` limit that oversized files are rejected before upload starts.
- [x] 5.5 Manually verify with the intended `8192 MB` limit that a roughly `1909.9 MB` source is allowed into the upload queue.
- [x] 5.6 Document the need to restart backend services after changing `MAX_MEDIA_UPLOAD_MB`.
