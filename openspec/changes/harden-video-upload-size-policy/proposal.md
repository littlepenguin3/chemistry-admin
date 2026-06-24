## Why

Teachers can currently upload a large video all the way through tus before the backend rejects it for exceeding `MAX_MEDIA_UPLOAD_MB`. The result is slow, confusing, and leaves the UI showing a misleading file-missing failure even though the real cause is a size policy violation.

This change makes the original-video upload limit visible, raises the local limit to support current teaching assets, and rejects oversized files before any hashing or resumable upload work begins.

## What Changes

- Raise the configured original media upload limit from `1024 MB` to `8192 MB` for the local deployment defaults.
- Expose the effective media upload policy to the teacher frontend through an authenticated admin API.
- Add a teacher video upload "step 0" size policy check that rejects files larger than the effective `MAX_MEDIA_UPLOAD_MB` before checksum hashing, duplicate precheck, tus upload, or fallback upload starts.
- Update the video resource metrics cards so "学生播放源空间" shows both rendition size and saved percentage, and the former "已节省空间" card becomes "原始视频大小限制" using the effective upload policy.
- Keep backend validation authoritative: direct upload and tus finalization must still reject oversized files even if frontend validation is bypassed.
- Improve failed upload semantics so `file_too_large` is surfaced as a size-limit failure instead of a local media file missing problem.
- Leave student video display aspect ratio and worker output aspect ratio unchanged in this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-video-resource-library`: add visible original video upload policy, pre-upload size rejection, and revised storage metrics behavior.
- `media-asset-lifecycle`: clarify backend size-limit enforcement and failure diagnostics for oversized media uploads.

## Impact

- Frontend: `apps/web-teacher/src/features/media/VideoResourcesPage.tsx`, media helper/status display code, media API types, and focused teacher media tests.
- Backend: admin media API, media upload/finalization domain logic, settings-derived upload policy response, and failure reason/file-state mapping.
- Configuration: `.env`, `.env.example`, and any compose/runtime values that explicitly override media upload limits.
- Operations: backend must be restarted after changing `MAX_MEDIA_UPLOAD_MB`; stale tus files from rejected uploads may need cleanup or recovery handling.
- Out of scope: changing student-side 16:9/16:10 layout, thumbnail generation aspect ratio, and video worker rendition aspect ratio.
