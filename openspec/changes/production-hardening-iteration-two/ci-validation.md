## CI And Validation Chain Result: 2026-06-17

Changed files:

- `scripts/validate_production_readiness.py`
- `.github/workflows/production-readiness.yml`
- `docs/production-operations.md`

Implementation notes:

- Changed the local production-readiness script default OpenSpec target to `production-hardening-iteration-two`.
- Kept `--change <name>` override for validating historical or alternate OpenSpec changes.
- Added `frontend build chunk report` after `frontend build`.
- Added a GitHub Actions workflow that checks out Git LFS resources, installs Python/Node/OpenSpec dependencies, installs frontend dependencies with `npm ci`, and runs the same local validation script.
- Documented CI/local validation usage and skip flags in production operations docs.

Validation:

```powershell
python scripts/validate_production_readiness.py
```

Results:

- PASS: protected resource manifest
- PASS: OpenSpec strict validation for `production-hardening-iteration-two`
- PASS: admin app import smoke
- PASS: backend tests, `44 passed`
- PASS: frontend typecheck
- PASS: frontend tests, `7 passed`
- PASS: frontend build
- PASS: frontend build chunk report

Failure behavior:

- The validation script preserves its existing fail-fast behavior: each stage runs in order and exits non-zero immediately after the first required failed stage.
- Stage skipping remains explicit through command flags and is documented as local/scoped only, not a production release gate.
