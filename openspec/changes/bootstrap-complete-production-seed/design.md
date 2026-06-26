## Context

The application now has several seed tracks: formal experiments, knowledge framework, catalog tree, full point descriptions, canonical textbook chunks, precomputed Qwen Elasticsearch RAG documents, point textbook evidence bindings, and a real published question-bank baseline. A blank server can recover much of the AI/question stack, but it still lacks a complete operational bootstrap: deterministic teacher login, a usable class and student roster, filmed videos and media bindings, and validation that proves those resources line up.

The provided `实验视频（新）.rar` currently lists four MP4 files:

- `亚硝酸根的检验方法.mp4`
- `亚硝酸的氧化性.mp4`
- `亚硝酸的生成与分解.mp4`
- `亚硝酸的还原性.mp4`

The filenames are human point-title style, not stable catalog node ids. Therefore video seed must not rely on filenames alone as the authoritative binding identity.

Existing constraints:

- API keys, model names, provider URLs, and deployment secrets must remain outside committed seed data.
- Student/teacher demo credentials may be deterministic only as explicit bootstrap/demo data.
- Some catalog points legitimately have no real footage; those points should use a generated placeholder video so the student/teacher playback surface remains complete.
- Video media files are large binary artifacts and must restore into `MEDIA_ROOT` safely.
- Qwen embedding/rerank results and LLM-generated questions should be reused from seed, not recomputed on a blank server.

## Goals / Non-Goals

**Goals:**

- One command can bootstrap a blank database and local media root into a directly usable teacher/student demo baseline.
- The seed baseline includes teacher/admin account data, one class, student accounts/roster, experiment catalog, point descriptions, videos when available, textbook chunks, precomputed textbook RAG vectors, evidence bindings, and real published question banks.
- Video seed restore is deterministic: every video asset has a stable id, checksum, managed file path, and reviewed point binding.
- Points without real footage remain visible and usable by binding to a generated placeholder video with explicit placeholder provenance.
- Validation proves that seed files, database rows, media files, ES indexes, and question/evidence references agree.

**Non-Goals:**

- Do not hardcode external API keys or provider secrets.
- Do not require Qwen, rerank, or final question LLM calls during seed import.
- Do not force every point to have a video before the app can start.
- Do not treat seeded videos as new teacher uploads that must pass through browser upload, tus upload, or duplicate precheck.
- Do not include mock/fake question banks in the runnable baseline.

## Decisions

### 1. Seed bootstrap is a manifest-driven pipeline

Create or extend a single bootstrap command that runs migrations, imports database seeds, restores media seed files, imports precomputed ES data, rebuilds derived search indexes when configured, and validates the final state.

Alternative considered: keep many separate manual commands. This is too easy to run in the wrong order and fails the blank-server usability goal.

### 2. Videos use stable media seed manifests, not filename-only binding

Add a media seed manifest that records stable `media_asset_id`, original filename, title, checksum, file size, relative media path, optional playback/thumbnail paths, readiness status, and one or more catalog point binding targets. A separate reviewed mapping should bind filenames or media ids to `experiment_catalog_nodes.id` and `canonical_point_id`.

Alternative considered: infer node binding only from filename. This is unsafe because point titles can duplicate, be abbreviated, or differ by punctuation/formula formatting.

### 3. Seeded videos restore as active ready assets

For a seed video that has an MP4 suitable for student playback, import it as an active `media_assets` row with ready playback metadata and a managed relative path under `MEDIA_ROOT`. If the original source and playback source are the same file for this seed, metadata must explicitly record that choice. The video worker should not be required to process the seed before students can play it.

Alternative considered: seed only original uploads and enqueue processing on first boot. This makes blank-server readiness dependent on FFmpeg/GPU worker availability and can delay the demo.

### 4. Missing real footage uses a shared placeholder video

Create one shared placeholder media asset for points without real footage. Validation should report which point bindings use the placeholder, and real video seed versions can later replace those bindings.

Alternative considered: leave points without videos and report `no_video_available`. The user prefers a playable placeholder so every point has a video surface, and this avoids broken-looking student playback.

### 5. Demo identities are seed data, secrets are configuration

The bootstrap may create deterministic demo/local accounts such as a teacher/admin account and a seeded class roster. Those credentials should be configurable through CLI flags or environment variables and documented as demo defaults. API keys and model configuration stay in platform settings or environment variables and are never committed in seed JSON.

Alternative considered: commit full platform AI configuration. This would risk leaking keys and tying the seed to one operator's provider credentials.

### 6. Precomputed RAG is restored, not regenerated

The textbook RAG ES index should be restored from the precomputed documents bundle containing Qwen embeddings. Evidence bindings and question semantic fingerprints should import from seed. Refresh jobs can exist for future updates, but bootstrap must not call Qwen/rerank/DeepSeek.

Alternative considered: run embedding/rerank on first boot. This creates cost, depends on external availability, and makes blank-server restore non-deterministic.

### 7. Current questions are real published baseline only

The question-bank seed should import 78 generated/published banks and 2,311 published objective questions, plus required supporting rows and semantic fingerprints. Validation must reject mock/fake rows and malformed objective payloads.

Alternative considered: keep legacy mock/demo banks for page shape. This directly conflicts with the production seed goal.

## Risks / Trade-offs

- Large media files increase repository or release artifact size -> store media as a packaged protected seed artifact with checksum validation; if Git size becomes unacceptable, publish it as a versioned release artifact referenced by manifest.
- Filename-to-point mapping may be ambiguous -> require a reviewed mapping manifest and fail validation on ambiguous automatic matches.
- Seeded ready media may bypass some processing-derived metadata -> record what is seeded, validate playable paths, and allow optional worker reprocessing later.
- Existing validation scripts may still assume old counts -> update production validation to the new complete baseline and keep count expectations in one manifest.
- Empty-server bootstrap may depend on ES availability -> make ES import explicit, fail with actionable diagnostics, and allow database-only dry-run validation.

## Migration Plan

1. Add seed manifests for demo teacher, class roster, student login behavior, media assets, video files, point-video bindings, and video coverage.
2. Add import scripts for identities/classes and media/video bindings.
3. Extend the existing production bootstrap script to run account/class import, media restore, current catalog/RAG/question imports, ES restore, and final validation.
4. Extend validation to check seed file checksums, DB rows, media paths, point-video coverage states, source chunks, ES RAG docs, evidence bindings, and question-bank integrity.
5. Run bootstrap against a blank local database and empty media root; verify teacher login, student login, experiment page, playable seeded videos, RAG-backed question generation readiness, and published question browsing.
6. Document operator-only configuration for AI keys/model names and deployment URLs.

Rollback strategy: keep media/database import idempotent and scoped by seed metadata/version so a failed seed import can delete or replace only rows/files created by the current seed version without touching operator-created runtime data.

## Open Questions

1. Should the first authoritative video seed include only the four videos currently present in `实验视频（新）.rar`, or should implementation wait until all expected videos are delivered?

Recommended answer: seed the four current videos now as the first versioned media seed, bind all other points to the generated placeholder video, and allow later media seed versions to replace placeholder bindings with real videos without changing catalog/RAG/question seeds.
