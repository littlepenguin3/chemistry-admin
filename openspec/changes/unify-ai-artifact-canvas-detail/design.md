## Context

The student Atom assistant now supports modern completed-answer Markdown with GFM tables, math, mhchem, and Mermaid flowcharts. Earlier changes added route-backed second-level artifact detail pages and then improved table detail with a TanStack-backed model, `react-zoom-pan-pinch`, and a row reading mode.

The current weakness is no longer rendering capability. It is the spatial model. The Mermaid and table detail pages still feel like a page containing a framed artifact panel. The user wants the opposite: a Figma-like workspace where the grid is the detail page itself, the artifact is placed directly on that grid, and the student pans/zooms the workspace to inspect the artifact.

Existing constraints that must remain true:

- Completed artifacts still derive from the assistant message's plain Markdown stored in local history.
- Inline chat previews remain readable and continue opening the existing artifact detail route.
- `conversation_history` continues to send only plain `{ role, content }` turns.
- Copying an assistant answer copies the original Markdown answer, not rendered controls or viewer state.
- No backend stream, prompt, guardrail, database, or local-history migration is part of this change.
- Mermaid detail already uses `react-zoom-pan-pinch`; table detail now also uses the same library and `@tanstack/react-table`.

## Goals / Non-Goals

**Goals:**

- Turn AI artifact detail into one shared second-level canvas page language for Mermaid and table artifacts.
- Make the grid background the workspace itself, not decorative page wallpaper behind a card.
- Render Mermaid artifacts directly on the grid with transparent surroundings and no inner card, panel, border, or repeated background surface.
- Adapt table artifacts to the same canvas page shell while preserving the table model, readable cells, chemistry Markdown rendering, and row reading mode.
- Keep pan/zoom controls explicit, floating, safe-area-aware, accessible, and usable in mobile preview and real phone browsers.
- Preserve all existing student-safe boundaries around local history, copying, role isolation, and backend request payloads.

**Non-Goals:**

- Do not build a Figma editor, whiteboard, node editor, multi-select system, saved object positions, or collaboration model.
- Do not make AI artifacts editable.
- Do not introduce a new heavy canvas/rendering dependency unless implementation proves the current pan/zoom stack cannot support the required behavior.
- Do not replace Streamdown, `react-markdown`, KaTeX, mhchem, Mermaid rendering, or TanStack table modeling.
- Do not change the root `/ai` chat background behavior, first-turn glow animation, flat reply surfaces, or contextual `/ai/chat` route behavior except where they open artifact detail.

## Decisions

### Decision 1: Introduce a Shared AI Artifact Canvas Shell

`AiArtifactDetailPage` should stop rendering separate table and Mermaid page layouts with their own framed content regions. Instead, it should resolve the artifact once and then render a shared canvas shell that receives:

- artifact kind (`table` or `mermaid`),
- title/subtitle copy,
- source Markdown or Mermaid source,
- artifact-specific renderer,
- artifact-specific floating controls where needed.

Recommended structure:

```text
AiArtifactDetailPage
  -> resolve artifact from local assistant history
  -> AiArtifactCanvasPage
       -> floating header/back layer
       -> floating tool layer
       -> infinite-grid workspace
            -> TransformWrapper camera
                 -> artifact renderer
```

This keeps the route and artifact identity flow intact while making visual behavior consistent across artifact kinds.

Alternative considered: only remove the Mermaid card. That would fix the screenshot but leave table detail with a separate visual language and make future artifact types inconsistent.

### Decision 2: Treat the Grid as the Workspace Layer

The grid should be owned by the canvas page or workspace, not by a child card. The page should create an infinite-feeling grid through CSS repeating backgrounds or equivalent lightweight DOM, sized to the visible viewport and aligned with pan/zoom transforms.

The implementation does not need true infinite DOM. It needs the illusion of an infinite workspace:

- viewport-sized canvas container,
- repeating minor grid and optional major grid lines,
- transform-aware background positioning or a world layer under the artifact,
- page-level overflow hidden so there is no document horizontal scroll.

The grid must remain visible behind the top header area unless a local veil is intentionally used for title readability. The veil should fade over the same grid rather than painting a separate opaque strip.

Alternative considered: keep the existing page background and remove only the inner card background. This still makes the artifact feel placed on a normal page instead of on a canvas.

### Decision 3: Use Camera Controls for the Canvas, Not Card Controls

The current zoom controls can be reused, but their mental model should change. They control the camera over the artifact workspace, not a zoomable card. Controls should float above the canvas and remain outside the transformed artifact layer.

Required controls:

- back action,
- title identifying table or flowchart detail,
- zoom out,
- zoom in,
- fit-to-view or fullscreen-fit,
- reset origin/scale.

Optional control refinements:

- current zoom percentage if it can be shown compactly,
- row-reader shortcut for table artifacts,
- reduced-motion-compatible transform transitions.

Alternative considered: rely only on gestures. That would be weaker for accessibility, desktop teacher preview, and discoverability.

### Decision 4: Render Mermaid as a Transparent Canvas Object

Mermaid SVG is already vector content and is the best fit for a Figma-like canvas. The Mermaid detail renderer should:

- render the SVG directly as the transformed object,
- remove the inner rounded container, border, card background, and padded panel,
- keep SVG background transparent unless Mermaid itself requires a local white/cream fill for text contrast,
- use a useful initial fit scale so the flowchart appears centered on first open,
- keep safe fallback behavior when Mermaid rendering fails.

For tall flowcharts, the artifact may extend beyond the initial viewport. Students should pan down the workspace, not scroll a framed panel. The page can still allow vertical page movement only if implementation discovers it is necessary for browser compatibility; the preferred model is one camera-controlled workspace.

Alternative considered: use a dedicated SVG pan/zoom library. `react-zoom-pan-pinch` is already installed, already working, and supports both SVG and table DOM content through one interaction contract.

### Decision 5: Make Tables Canvas-Native Without Sacrificing Readability

Tables are different from Mermaid diagrams: they need cell contrast and row/column structure. The table detail should still live in the same canvas page shell, but the table object may use a restrained table surface:

- no giant outer card or stretched blank panel,
- no background container that hides the page grid around large empty areas,
- table dimensions should hug the table content instead of filling arbitrary vertical space,
- cell fills, hairline borders, and header tint remain allowed for readability,
- row reading mode remains available for text-heavy chemistry cells.

In other words, Mermaid can be fully frameless; tables can be an object placed on the grid. The object should read like a spreadsheet/table layer on a canvas, not like a page card containing a table.

Alternative considered: make table cells completely transparent on the grid. That would look visually unified but would reduce readability for dense Chinese text, KaTeX, and mhchem formulas.

### Decision 6: Preserve the Existing Artifact Source and Safety Boundaries

All canvas state stays local and disposable:

- zoom scale,
- pan position,
- fit/reset state,
- selected table row,
- row-reader open state,
- rendered Mermaid SVG,
- rendered table DOM.

None of that state should be written into assistant messages, copied answer text, local history content, or backend `conversation_history`. The detail route continues to reconstruct artifacts from completed Markdown when opened.

Alternative considered: persist last viewed position for convenience. That adds schema and privacy surface for little demo value and can be reconsidered later.

## Risks / Trade-offs

- [Risk] A transformed full-page workspace can conflict with normal browser scrolling. -> Mitigation: constrain pan/zoom gestures to the canvas viewport, keep controls outside the transform layer, and verify back navigation plus page exit on mobile QA.
- [Risk] The header/title can again appear to cover the grid or artifact. -> Mitigation: use a translucent/fading veil over the real grid, not an opaque header background or duplicated background image.
- [Risk] Table content may become too small when fit-to-view is applied. -> Mitigation: choose table-specific min scale, keep explicit zoom controls, and preserve row reading mode as an untransformed exact-reading path.
- [Risk] Hidden card removal may reduce contrast. -> Mitigation: Mermaid remains transparent but table cells keep local cell fills and hairlines; header veils protect text only where needed.
- [Risk] The change may accidentally affect inline chat Markdown styles. -> Mitigation: scope canvas styles to the route-backed artifact detail page and keep `.ai-markdown` inline styles separate.
- [Risk] QA may not reliably validate visual grid movement through DOM assertions. -> Mitigation: add source/CSS assertions plus mobile screenshot checks for absence of inner cards, no horizontal page overflow, visible grid, visible controls, and usable artifact content.

## Migration Plan

1. Refactor `AiArtifactDetailPage` around a shared artifact canvas shell while preserving current route params and artifact resolution.
2. Move current Mermaid detail content into a canvas-object renderer and remove inner panel/card styling.
3. Move current table detail content into the same shell, keeping TanStack table model, zoom controls, and row reading mode.
4. Add canvas-grid CSS and floating header/tool layers scoped to AI artifact detail only.
5. Update tests and mobile QA for Mermaid and table artifact detail at 360px, 390px, and 430px widths.
6. Run focused tests, typecheck, build, and mobile QA.
7. When updating the running demo, build locally and copy the static output into the existing container instead of rebuilding the container image.

Rollback strategy:

- Keep inline chat rendering as the fallback.
- If the shared canvas shell causes a blocker, hide or bypass the detail affordance while keeping completed Markdown rendering intact.
- If table adaptation is risky, land Mermaid canvas-native first behind the same shell and keep table detail on the current enhanced table viewer until the table object styling is corrected.

## Open Questions

- Should fit-to-view for tall Mermaid diagrams center the top of the diagram or the full diagram bounding box on first open?
- Should table detail default to canvas view for all tables, or should compact two-column tables open with row reading as the primary view while still offering canvas mode?
- Should the floating toolbar display a zoom percentage, or would that add noise for the student demo?
