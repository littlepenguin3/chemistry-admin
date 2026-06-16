## Context

The learning assistant currently renders assistant answers and evidence previews with a small hand-written Markdown/LaTeX parser in `apps/admin-web/src/App.tsx`. It only recognizes simple `$...$` spans and then strips selected commands with regex. That approach is too brittle for chemistry content, especially formulas and reactions containing `\mathrm`, `\ce`, `\ch`, `\rightarrow`, superscripts, subscripts, and units.

The model can also emit malformed or partially wrapped LaTeX. RAG and source chunks may contain valid LaTeX independent of model output. Therefore rendering quality cannot rely on model behavior alone or frontend parsing alone.

## Goals / Non-Goals

**Goals:**
- Establish a learning-assistant output contract for chemistry/math notation.
- Normalize final assistant answers on the backend before response payloads are returned.
- Render Markdown and chemistry/math formulas with a real renderer that supports KaTeX and mhchem.
- Preserve existing authenticated RAG image rendering.
- Add regression tests so common raw LaTeX leaks fail automatically.

**Non-Goals:**
- Do not rewrite all admin Markdown rendering outside the learning assistant.
- Do not require perfect recovery of arbitrary invalid LaTeX.
- Do not change the chemistry content, point evidence selection, or RAG retrieval behavior.

## Decisions

### Use a layered contract

The durable path is:

```text
model prompt contract
  -> backend normalize/validate final text
  -> frontend Markdown + KaTeX/mhchem render
  -> fallback text sanitizer
  -> tests that reject raw command leakage
```

The model contract is intentionally prescriptive, not advisory: formulas and ions must use braced mhchem syntax (`\ce{KMnO4}`, not `\ceKMnO4`), and full reaction equations must be one mhchem expression (`$\ce{Cl2 + 2Br- -> 2Cl- + Br2}$`, not split fragments or `-->` arrows).

Alternative considered: frontend-only regex replacement. This fails whenever the model streams malformed math, RAG snippets contain unsupported commands, or a new LaTeX macro appears.

### Backend normalization is deterministic first

The backend will scan final answer text for common chemistry/math command leaks. Safe repairs include wrapping bare `\ce{...}`, `\ch{...}`, `\mathrm{...}`, repairing loose mhchem species such as `\ceKMnO4`, repairing loose reaction equations such as `\ceCl2 + 2Br^- --> 2Cl^- + Br2`, converting `\(...\)` and `\[...\]` delimiters to `$...$` and `$$...$$`, and balancing simple unclosed inline math when safe.

If the text cannot be safely repaired, it should still be returned with enough formatting cleanup to avoid exposing raw control words in ordinary prose. A future model rewrite pass may be added, but the first implementation should stay deterministic to avoid latency and content drift.

### Frontend uses KaTeX + mhchem

Learning assistant Markdown will be rendered with `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and KaTeX's mhchem extension. The existing image component remains the renderer for Markdown images so RAG asset URLs still go through the authenticated image fetch path.

Fallback rendering must not display raw `\mathrm`, `\ce`, `\ch`, `\rightarrow`, or similar commands if KaTeX cannot parse a segment.

### Streaming final replacement remains acceptable

During streaming, formula fragments may be incomplete. The current streaming flow already accepts a final response replacement. The backend normalized final answer is the source of truth. The frontend should avoid making partial formula text worse during streaming, but the hard requirement is that completed turns do not show raw command leaks.

## Risks / Trade-offs

- [Risk] KaTeX/mhchem increases bundle size -> Keep it scoped to admin web and accept the cost for correctness.
- [Risk] Some invalid model LaTeX may render as cleaned text rather than perfect formula -> Prefer readable chemistry text over raw commands.
- [Risk] Markdown parser behavior may differ from the current hand-written parser -> Preserve existing custom image handling and test core answer formatting.
- [Risk] Backend normalization could accidentally wrap non-formula backslash text -> Only target known chemistry/math commands and avoid code blocks.

## Migration Plan

1. Add frontend rendering dependencies and replace learning assistant Markdown rendering.
2. Add backend answer normalization and prompt contract.
3. Add tests for backend normalization and frontend no-leak rendering.
4. Run backend tests, frontend typecheck, frontend tests, frontend build, and OpenSpec validation.
5. Rebuild/recreate the Docker backend after implementation so the running app uses the new backend code.
