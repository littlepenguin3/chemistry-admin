# Production Seed Resources

This directory contains the protected current-system resources for the chemistry admin platform. It is intentionally separate from historical `artifacts/` output so cleanup and refactor work has a stable source of truth.

Protected resource groups:

- `formal_experiments.json`: 77 current formal experiments.
- `knowledge_framework/`: 11 chapters, 133 knowledge units, 385 knowledge points, plus the reviewed curriculum source used to publish them.
- `experiment_catalog/`: the current catalog-outline seed from `docs/实验目录_整理版.md`, with 569 nodes, 176 directories, 393 points, and 30 mapped point-content smoke examples.
- `canonical_rag/`: mirrored canonical chunks and embeddings from `E:/chemistry-rag/data/rag_ready`, including 3637 chunks/embeddings.
- `student_learning/`: explicit student-facing family and element learning profiles used by the H5 learning page; these display facts are curated seed data, not dynamically inferred from chunks.
- `import_reports/`: current import/validation reports retained for auditability.
- `manifests/core_resources.json`: count, size, and SHA256 manifest used as the cleanup guard.

Retired legacy groups:

- `experiment_points/`, `question_bank/`, and `point_evidence/` are no longer protected production seeds for the catalog-outline baseline.
- Old question banks, old point identities, old video references, and old point-to-chunk bindings are invalid after reset.
- Canonical chunks and embeddings remain valid corpus data; only the retired point-to-chunk binding layer must be regenerated against catalog node ids or deterministic catalog seed keys.

Student learning element focus cards:

- `card_focus` is the compact selected-element card's one-line property hook. Keep it short and element-specific.
- `card_relevance` explains why the element matters to the current chapter's experiments or observation tasks. Keep family trends and long details in `note`, `redox_tendency`, property cards, or element detail surfaces.
- `card_tags` should contain two to three compact facts that help scan the card, such as family, state, common valence, color change, or safety role.

Run this before cleanup or refactor work that touches resources:

```bash
python scripts/validate_production_resources.py
```

Validate the catalog outline seed and mapping report before import:

```bash
python scripts/validate_experiment_catalog_seed.py --write-report
```

Regenerate the manifest only after intentionally replacing the protected seed resources:

```bash
python scripts/validate_production_resources.py --write-manifest
```
