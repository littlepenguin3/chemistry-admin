# Migration And Operations Polish

This note records the migration and operations decisions for the second production hardening pass.

## Migration Audit

- No existing migration file was renamed, removed, reordered, or rewritten during this pass.
- The historical duplicate `010_*.sql` files remain append-only migration identity.
- The current next migration number remains `014_...` for any future schema change.
- Media lifecycle hardening did not require a schema change, so no `014_...` migration was added.

The only migration delta visible against `main` is the earlier `013_video_point_evidence.sql` migration captured before this second hardening pass.

## Operations Updates

`docs/production-operations.md` now restates:

- protected resource validation and restore expectations
- migration numbering and append-only rules
- media lifecycle dry-run and guarded cleanup behavior
- CI and one-command production-readiness gates
- local backend/BGE health checks
- authenticated API and browser smoke-test paths
- local-only handling for temporary smoke admin accounts

Temporary smoke admin records are treated as disposable local database state. They are not seed data and should be recreated locally when needed rather than promoted into production.
