## Context

Video upload currently has three stages: the teacher frontend selects files, computes a SHA-256 checksum for duplicate precheck, uploads through tus when `VITE_TUS_ENDPOINT` is configured, and then calls the backend `complete-upload` endpoint to create a media asset and enqueue video processing.

The backend already has an authoritative upload limit through `MAX_MEDIA_UPLOAD_MB`, but that limit is only enforced after the file reaches the backend or after a tus upload is finalized. With the current `1024 MB` limit, a roughly `1909.9 MB` video can upload successfully to tus and only then become a failed media asset with `error_reason=file_too_large`. The teacher UI then emphasizes local file missing state because the failed record points at a placeholder path instead of a valid media source.

This change keeps the video aspect-ratio discussion out of scope and focuses on upload policy, visible limits, and failure semantics.

## Goals / Non-Goals

**Goals:**

- Raise the local original-video upload limit to `8192 MB`.
- Make the effective upload limit visible in the teacher video resource page.
- Reject oversized files before hashing, duplicate precheck, tus upload, fallback upload, or processing handoff.
- Keep backend validation authoritative for direct API calls and bypassed clients.
- Ensure oversized upload failures are reported as size-limit failures, not local media file-missing failures.
- Preserve the existing tus resumable upload path for files within policy.

**Non-Goals:**

- Do not change student video layout, home feed aspect ratio, video-library thumbnails, or point-detail player ratio.
- Do not change worker rendition ratio, thumbnail ratio, CRF, fps, codec, or transcode threshold.
- Do not introduce a new external upload service or storage backend.
- Do not recover already rejected oversized tus uploads as part of this change.

## Decisions

### Decision 1: Backend exposes an authenticated upload policy endpoint

Add a teacher-admin media policy endpoint, for example `/api/admin/media/upload-policy`, returning the effective settings needed by the upload UI:

- `max_media_upload_mb`
- `max_media_upload_bytes`
- allowed video suffixes or displayable allowed formats, if already available from media validation code

Rationale: `MAX_MEDIA_UPLOAD_MB` is a backend/runtime policy. Reading it from a Vite environment variable would duplicate configuration and drift when operators change `.env` or container overrides.

Alternative considered: hard-code `8192` in the frontend. Rejected because the UI would become wrong as soon as deployment configuration changes.

### Decision 2: File-size validation runs before upload queue work

When files are selected or dropped, the teacher frontend compares each video file's `File.size` with `max_media_upload_bytes` before placing it into the upload queue. Oversized files are rejected immediately with a clear message that includes the file size and the configured limit. Accepted files continue through the existing queue behavior.

Rationale: this prevents the expensive path: no checksum hashing, no duplicate precheck, no tus chunks, no fallback upload, and no backend processing artifact for a file known to be outside policy.

Alternative considered: reject only when the teacher clicks "开始上传". Rejected because the queue would still look actionable and the teacher would not learn the problem at the moment of file selection.

### Decision 3: Backend rejects oversized uploads with machine-readable policy failure

Direct upload and tus finalization keep enforcing the same policy. If an oversized upload reaches the backend, the response should expose `file_too_large` and the configured limit in a machine-readable way. The backend must not enqueue a processing job for oversized media.

The preferred behavior is to reject the request instead of creating a normal failed media asset card. If an audit record is still needed, it must remain diagnostically distinct and must not appear as "本地媒体文件缺失" in the teacher media grid.

Rationale: frontend validation improves the common path, but backend validation is the security and consistency boundary.

Alternative considered: keep creating failed assets for every oversized upload. Rejected because it produces noisy media rows and caused the current misleading missing-file state.

### Decision 4: Metrics distinguish saved playback space from original upload limit

The video resource metrics area should keep total original space and total student playback-source space visible. The student playback-source card should show both the rendition size and saved percentage. The final card should show the current original video upload size limit using the backend upload policy.

Rationale: the previous "已节省空间" card duplicates information that is better paired with "学生播放源空间", while the upload limit is operationally important before teachers choose files.

Alternative considered: add a ninth card. Rejected because the page already has a dense metric strip and the saved-space absolute number is less actionable than the upload limit during upload work.

### Decision 5: Existing aspect ratio behavior remains unchanged

This change does not alter the current student-side split: point detail playback uses a 16:10 container with `object-fit: contain`, while home/video-library cover surfaces currently use 16:9 cover-style presentation. The worker continues preserving source aspect ratio for learning renditions.

Rationale: upload failures are blocking video ingestion now. Aspect ratio changes require separate product and visual QA because they affect student mobile surfaces, thumbnails, and transcode output.

## Risks / Trade-offs

- [Risk] The frontend policy request fails and teachers cannot select videos. -> Mitigation: show a clear policy-load error and keep backend rejection authoritative; do not silently assume an unlimited upload size.
- [Risk] A file is selected before the policy response arrives. -> Mitigation: disable upload selection/start controls until policy is loaded, or apply validation immediately after policy arrives before any upload work begins.
- [Risk] The backend `.env` and compose environment disagree. -> Mitigation: expose and display the effective runtime value from the backend, and update local defaults consistently.
- [Risk] Rejected tus uploads may leave temporary files. -> Mitigation: delete known oversized temporary files during rejection where safe, or expose them through maintenance diagnostics for cleanup.
- [Risk] Tests only cover the happy path. -> Mitigation: add focused tests for oversized selection, mixed-size queues, backend oversize rejection, and file-missing diagnostic separation.

## Migration Plan

1. Update local configuration defaults to `MAX_MEDIA_UPLOAD_MB=8192`.
2. Add the backend upload policy endpoint and preserve existing backend validation.
3. Update the teacher frontend to fetch the policy, revise metrics, and reject oversized selected files before queue insertion.
4. Update failure display so `file_too_large` is shown as a size-limit problem rather than file missing.
5. Restart backend services in local/compose deployments so the new runtime limit is loaded.

Rollback is straightforward: restore the previous `MAX_MEDIA_UPLOAD_MB` value and redeploy. The frontend reads the effective backend policy, so it should follow the rolled-back limit without a separate code revert.

## Open Questions

- Should backend oversized tus finalization delete the completed tus temp file immediately, or leave it for an explicit maintenance cleanup command?
- Should the policy endpoint also expose the tus endpoint state and chunk-size guidance, or remain limited to validation policy for now?
