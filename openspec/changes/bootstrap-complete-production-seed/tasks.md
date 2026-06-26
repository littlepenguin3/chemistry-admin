## 1. Seed Inventory And Manifests

- [x] 1.1 Audit the current `data/seed` baseline and record the authoritative counts for catalog nodes, full point content, textbook chunks, precomputed RAG documents, evidence bindings, and question banks.
- [x] 1.2 Extract or list the provided experiment video archive and generate an initial video inventory with filename, size, checksum, duration when available, and inferred title.
- [x] 1.3 Create a reviewed media mapping manifest that binds each seed video to stable catalog point node ids and canonical point ids, with explicit placeholder-video bindings for unfilmed points.
- [x] 1.4 Add seed manifests for the default teacher/admin account, one active class, class login settings, and seeded student roster/accounts.

## 2. Account, Class, And Student Seed Import

- [x] 2.1 Implement an idempotent account/class/student seed importer that creates or updates teacher account, class, teacher-class ownership, class login settings, roster entries, and student profiles/users.
- [x] 2.2 Support CLI/environment overrides for seeded teacher username/password and class/student credential policy without committing secrets.
- [x] 2.3 Add validation that seeded teacher login, class roster, and student login references are present and do not create duplicate active identities.

## 3. Media Seed Import

- [x] 3.1 Add a media seed package layout under the protected seed boundary or a versioned external artifact referenced by checksum manifest.
- [x] 3.2 Implement media file restore into `MEDIA_ROOT` with path traversal protection, checksum verification, stable relative paths, and idempotent replacement for the same seed version.
- [x] 3.3 Implement media asset import that creates active ready `media_assets` rows for playable seed videos without requiring tus/browser upload.
- [x] 3.4 Implement point-video binding import for `experiment_catalog_point_media_bindings`, rejecting ambiguous or non-point targets.
- [x] 3.5 Add validation/reporting for seeded video coverage, including real-video versus placeholder-video point counts and any unbound video files.

## 4. Bootstrap Pipeline

- [x] 4.1 Extend the complete production bootstrap command to run migrations, existing catalog/RAG/question imports, account/class/student import, media restore/import, evidence import, and optional search-index rebuilds in the correct order.
- [x] 4.2 Ensure bootstrap does not call Qwen embedding, Qwen rerank, DeepSeek, or any final LLM during seed restore.
- [x] 4.3 Make bootstrap idempotent and scoped by seed version so reruns update seed-owned rows/files without deleting operator-created runtime data.
- [x] 4.4 Add dry-run output that shows planned database tables, media files, ES indexes, and validation checks without writing.

## 5. Production Validation And Tests

- [x] 5.1 Extend `validate_production_resources.py` to whitelist and hash account/class/media seed artifacts, video mapping manifests, and media package metadata.
- [x] 5.2 Extend database validation to check teacher account, class, roster, student account/login state, media assets, point-video bindings, media file paths/checksums, precomputed RAG documents, evidence bindings, and real published question counts.
- [x] 5.3 Add a blank-database bootstrap test that imports all DB seed resources and asserts the restored counts and references.
- [x] 5.4 Add a media seed import test using a small fixture video package to verify checksum, path safety, media asset readiness, and point binding behavior.
- [x] 5.5 Add an end-to-end smoke test or scripted verification for teacher login, student login, experiment catalog visibility, seeded video playback URL availability, question-bank browsing, and RAG readiness diagnostics.

## 6. Documentation And Operator Handoff

- [x] 6.1 Update `data/seed/README.md` with the complete restore order, seed artifact list, validation commands, and forbidden non-current artifacts.
- [x] 6.2 Document which values operators must configure manually after seed import, including API keys, provider base URLs, model names, ES URLs, and deployment public URLs.
- [x] 6.3 Document how to add later video seed versions without rerunning RAG embeddings or replacing the question bank.
- [x] 6.4 Run OpenSpec validation and final seed validation, then summarize the exact bootstrap command for a blank server.
