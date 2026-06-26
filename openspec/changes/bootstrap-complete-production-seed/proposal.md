## Why

The project needs a reproducible blank-server bootstrap so a new deployment can start with the same teacher account, class roster, experiment catalog, point content, videos, textbook RAG data, RAG evidence bindings, and real published question bank without re-running paid embedding/rerank/question-generation work.

The current seed baseline already covers catalog content, textbook chunks, precomputed Qwen vectors, evidence bindings, and published real questions, but filmed experiment videos, teacher/student demo identities, media files, media processing/readiness metadata, and point-video bindings still need to be formalized as protected seed resources.

## What Changes

- Add a complete production seed bootstrap contract that restores:
  - one default teacher/admin account;
  - one active class with seeded student roster/login credentials;
  - catalog experiments, leaf point structure, and full point descriptions;
  - filmed experiment videos where available, including media assets, managed media files, and point media bindings;
  - canonical textbook chunks and precomputed Qwen `text-embedding-v4` Elasticsearch documents;
  - precomputed point-to-textbook evidence bindings for RAG question generation;
  - current real published question banks only, excluding mock/fake question data.
- Extend seed validation so the repository can prove a blank database plus seed package is directly usable after operators configure API keys, provider base URLs, model names, and ES/media runtime settings.
- Add video seed import tooling that can unpack the provided video archive, match video filenames to catalog point nodes through a reviewed mapping, and bind points without real footage to a shared generated placeholder video rather than failing the whole bootstrap.
- Keep API keys and deployment secrets outside committed seeds; bootstrap scripts may create deterministic demo credentials only when explicitly requested.
- Update existing seed/RAG/question-bank/media/account specs instead of introducing a parallel legacy seed path.

## Capabilities

### New Capabilities
- `complete-production-seed-bootstrap`: Defines the end-to-end blank-server seed contract, restore order, required protected artifacts, validation, and operator configuration boundary.

### Modified Capabilities
- `current-runtime-seed-boundary`: Expand protected seed resources from catalog/RAG/questions to the complete runnable baseline, including accounts, class roster, media assets/files, point-video bindings, and current 78-bank/2,311-question baseline.
- `media-asset-lifecycle`: Require seeded media assets to restore as playable/previewable active assets with managed file paths, processing/readiness metadata, and shared placeholder handling for points without real footage.
- `teacher-video-resource-library`: Require imported seed videos to appear in teacher video resource management without being treated as pending uploads.
- `class-roster-management`: Require seeded class and students to behave like normal active roster data and student-login data.
- `platform-teacher-account-management`: Require seeded teacher/admin credentials to be deterministic for local/demo bootstrap while remaining overrideable and non-secret for production.
- `qwen-es-textbook-rag-retrieval`: Require precomputed Qwen ES documents to be importable without calling Qwen during bootstrap.
- `experiment-question-bank-management`: Require the published seed question bank to include only real, published objective questions and reject mock/fake rows.

## Impact

- Seed data under `data/seed/**`, including new account/class/media/video mapping manifests and media bundle metadata.
- Bootstrap and validation scripts under `scripts/**`, especially one-command blank-server bootstrap, precomputed ES import, video media seed import, account/class seed import, and production-resource validation.
- Media storage under `data/media/**` or a packaged media seed archive restored into `MEDIA_ROOT`.
- Database tables for `app_users`, `classes`, `teacher_classes`, `roster_entries`, `student_profiles`, class registration settings, `media_assets`, media renditions/processing metadata, and `experiment_catalog_point_media_bindings`.
- Existing Elasticsearch indexes for textbook RAG, teacher catalog search, and student video-library search.
- Deployment documentation for the required post-seed manual configuration of AI provider API keys/model names and runtime URLs.
