# Media Helper Extraction

Date: 2026-06-17

## Scope

The second fourth-pass implementation slice extracted upload and media display helpers from `apps/admin-web/src/features/media/VideoResourcesPage.tsx` into `apps/admin-web/src/features/media/mediaHelpers.tsx`.

Moved helper ownership includes:

- upload stage types and initial state
- media status/file-state labels and tags
- processing phase text and progress formatting
- duration and resolution formatting
- rendition savings helpers
- duplicate candidate and score display helpers
- upload queue item text
- video title derivation
- SHA-256 file hashing helper
- tus upload id extraction

## Behavior Boundary

This was a mechanical extraction. It intentionally did not change:

- `/videos` route loading
- media asset query keys
- tus upload endpoint selection
- upload queue state transitions
- duplicate precheck or duplicate decision API calls
- media preview behavior
- media lifecycle database semantics

The `@uppy/core` and `@uppy/tus` runtime imports remain owned by the video resources feature. No upload dependency was moved into the app shell.

## Size Impact

Before extraction:

- `VideoResourcesPage.tsx`: 1176 lines, 59.4 KB

After extraction:

- `VideoResourcesPage.tsx`: 976 lines, 52.2 KB
- `mediaHelpers.tsx`: 226 lines, 8.1 KB

The page remains sizeable because upload state and preview UI are still co-located, but formatting and upload helper logic now have feature-local ownership.
