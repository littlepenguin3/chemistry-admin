import { describe, expect, it } from "vitest";

import apiSource from "./api.ts?raw";
import appSource from "./App.tsx?raw";
import authUtilsSource from "./features/auth/authUtils.ts?raw";
import assistantPanelSource from "./features/assistant/StudentAiChatPanel.tsx?raw";
import authenticatedAppLayoutSource from "./app/shell/AuthenticatedAppLayout.tsx?raw";
import previewInputRuntimeSource from "./app/preview/input/PreviewInputRuntime.tsx?raw";
import periodicTableSource from "./features/periodic-table/PeriodicTable.tsx?raw";
import pointVideoPlayerSource from "./features/catalog/PointVideoPlayer.tsx?raw";
import unifiedSearchSource from "./routes/search/UnifiedSearchPage.tsx?raw";
import backArrowIconSource from "./shared/mobile/BackArrowIcon.tsx?raw";
import pagebarSource from "./shared/mobile/PageBar.tsx?raw";
import studentPackageSource from "../package.json?raw";
import { periodicElements } from "./periodic";
import {
  areaSwatches,
  periodicAreaIdForElement,
  periodicAreaOrder,
  profileAreaIds,
} from "./features/periodic-table/periodicHelpers";

const routeAndFeatureSources = import.meta.glob("./{routes,features}/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("student console role boundaries", () => {
  it("keeps student routes on student APIs and rejects teacher/operator sessions", () => {
    expect(apiSource).toContain('api<AuthUser>("/api/auth/me")');
    expect(apiSource).toContain('"/api/preview/student-session/exchange"');
    expect(apiSource).not.toContain("/api/admin");
    expect(apiSource).not.toContain("/api/web-admin");
    expect(appSource).toContain('currentUser.role !== "student"');
    expect(authUtilsSource).toContain('response.user.role === "student"');
  });

  it("does not expose teacher notes or raw RAG/chunk traces in student AI metadata rendering", () => {
    expect(apiSource).not.toContain("teacher_note");
    expect(apiSource).not.toContain("chunk_id?:");
    expect(assistantPanelSource).not.toContain("chunk_id");
    expect(assistantPanelSource).not.toContain("score");
    expect(assistantPanelSource).toContain("引用资料");
    expect(assistantPanelSource).not.toMatch(/source\.(title|section)/);
  });

  it("keeps raw teacher-preview checks inside preview runtime boundaries", () => {
    const allowedPreviewAwareFiles = new Set([
      "routes/learn/PreviewCatalogNodePage.tsx",
      "routes/learn/PreviewCatalogPointPage.tsx",
      "features/catalog/CatalogPointDetailPanel.tsx",
    ]);
    const forbiddenPatterns = [
      { label: "previewMode", pattern: /\bpreviewMode\b/ },
      { label: "user.preview_mode", pattern: /\buser\.preview_mode\b/ },
      { label: "preview purpose", pattern: /preview_purpose|teacher_student_device_preview/ },
      { label: "preview identity", pattern: /00000000|施测平|数智一班/ },
      { label: "previewPolicy", pattern: /\bpreviewPolicy\b/ },
    ];
    const offenders = Object.entries(routeAndFeatureSources).flatMap(([file, source]) => {
      const sourcePath = file.replace(/^\.\//, "");
      if (/\.test\.(ts|tsx)$/.test(sourcePath)) return [];
      if (allowedPreviewAwareFiles.has(sourcePath)) return [];
      const matches = forbiddenPatterns.filter(({ pattern }) => pattern.test(source)).map(({ label }) => label);
      return matches.length ? [`${sourcePath}: ${matches.join(", ")}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps the mobile H5 root free of desktop iframe scrollbars", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const baseCssSource = readFileSync(`${cwd}/src/styles/base.css`, "utf8");

    expect(baseCssSource).toContain("overflow-x: hidden");
    expect(baseCssSource).toContain("scrollbar-width: none");
    expect(baseCssSource).toContain("html::-webkit-scrollbar");
    expect(baseCssSource).toContain("body::-webkit-scrollbar");
  });

  it("scopes the simulated touch runtime to teacher preview infrastructure", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const appShellCssSource = readFileSync(`${cwd}/src/styles/app-shell.css`, "utf8");

    expect(authenticatedAppLayoutSource).toContain("baseContext.user.preview_mode || appConfig.preview_mode");
    expect(authenticatedAppLayoutSource).toContain("<PreviewInputRuntime />");
    expect(previewInputRuntimeSource).toContain("window.addEventListener(\"message\"");
    expect(previewInputRuntimeSource).toContain("elementFromPreviewPoint");
    expect(previewInputRuntimeSource).toContain("findScrollablePreviewTarget");
    expect(previewInputRuntimeSource).not.toContain("@use-gesture/react");
    expect(studentPackageSource).not.toContain("@use-gesture/react");
    expect(appShellCssSource).not.toContain(".student-preview-runtime-touch-cursor");
    expect(appShellCssSource).not.toContain(".student-preview-touch-runtime");
  });

  it("keeps the mobile bottom nav fully offscreen while compressed", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const appShellCssSource = readFileSync(`${cwd}/src/styles/app-shell.css`, "utf8");

    expect(authenticatedAppLayoutSource).not.toContain("setTimeout(() => setNavCompressed(false)");
    expect(appShellCssSource).toContain(".student-app-shell.nav-compressed .student-bottom-nav");
    expect(appShellCssSource).toContain("pointer-events: none;");
    expect(appShellCssSource).toContain("translateY(calc(100% + 2px))");
    expect(appShellCssSource).not.toContain("opacity: 0;");
    expect(appShellCssSource).not.toContain("opacity 180ms ease");
    expect(appShellCssSource).not.toContain("opacity: 0.14");
    expect(appShellCssSource).not.toContain("var(--mobile-bottom-nav-height) * 0.62");
  });

  it("keeps the visible mobile bottom nav opaque and free of default focus boxes", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const appShellCssSource = readFileSync(`${cwd}/src/styles/app-shell.css`, "utf8");
    const bottomNavBlock = appShellCssSource.match(/\.student-bottom-nav\s*\{[^}]*\}/)?.[0] || "";

    expect(bottomNavBlock).toContain("height: calc(var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom, 0px));");
    expect(bottomNavBlock).toContain("overflow: hidden;");
    expect(bottomNavBlock).toContain("background: #fffdf6;");
    expect(bottomNavBlock).not.toContain("background: rgba(255, 253, 246");
    expect(bottomNavBlock).not.toContain("backdrop-filter: blur(18px)");
    expect(appShellCssSource).toContain(".student-bottom-nav button:focus");
    expect(appShellCssSource).toContain("outline-style: none;");
    expect(appShellCssSource).toContain("outline-width: 0;");
    expect(appShellCssSource).toContain(".student-bottom-nav button:focus-visible");
  });

  it("locks the student periodic learning taxonomy without the removed combined area", () => {
    const bySymbol = new Map(periodicElements.map((element) => [element.symbol, element]));

    expect(periodicAreaOrder).toEqual(["hydrogen", "p", "s", "ds", "d", "f"]);
    expect(Object.keys(areaSwatches)).toEqual(["hydrogen", "p", "s", "ds", "d", "f"]);
    expect(areaSwatches).toMatchObject({
      hydrogen: "#6f9f2e",
      p: "#0f8f72",
      s: "#9a6a11",
      ds: "#c89a2d",
      d: "#9e2f3d",
      f: "#8d4f9f",
    });
    expect(periodicAreaIdForElement(bySymbol.get("H")!)).toBe("hydrogen");
    ["He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"].forEach((symbol) => {
      expect(periodicAreaIdForElement(bySymbol.get(symbol)!)).toBe("p");
    });
    ["La", "Lu", "Ac", "Lr"].forEach((symbol) => {
      expect(periodicAreaIdForElement(bySymbol.get(symbol)!)).toBe("f");
    });
    expect(profileAreaIds({ chapter_id: "CH21" } as Parameters<typeof profileAreaIds>[0])).toEqual(["f"]);
    expect(profileAreaIds({ chapter_id: "CH22" } as Parameters<typeof profileAreaIds>[0])).toEqual(["hydrogen", "p"]);
  });

  it("keeps recommendation chrome out of the periodic table selector", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const periodicCssSource = readFileSync(`${cwd}/src/styles/periodic-table.css`, "utf8");

    expect(periodicTableSource).not.toContain("recommendedArea");
    expect(periodicTableSource).not.toContain("recommendedSymbols");
    expect(periodicTableSource).not.toContain("selectedArea");
    expect(periodicTableSource).not.toContain("learnableSymbols");
    expect(periodicCssSource).not.toContain("area-legend button.selected");
    expect(periodicCssSource).not.toContain("selected-area");
    expect(periodicCssSource).not.toContain("learnable-element");
    expect(periodicCssSource).not.toContain("muted-area");
    expect(periodicCssSource).not.toContain("recommended-area");
    expect(periodicCssSource).not.toContain("recommended-element");
  });

  it("keeps point video player chrome aligned with mobile detail page controls", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const experimentsCssSource = readFileSync(`${cwd}/src/styles/experiments.css`, "utf8");
    const pointDetailBlock = experimentsCssSource.match(/\.catalog-point-detail\s*\{[^}]*\}/)?.[0] || "";
    const playerBlock = experimentsCssSource.match(/\.point-art-player\s*\{[^}]*\}/)?.[0] || "";
    const defaultChromeHideBlock =
      experimentsCssSource.match(
        /\.point-art-player \.art-bottom,[\s\S]*?\.point-art-player \.art-layer-auto-playback\s*\{[^}]*\}/,
      )?.[0] || "";
    const shellBlock = experimentsCssSource.match(/\.point-youtube-shell\s*\{[^}]*\}/)?.[0] || "";
    const controlsBlock = experimentsCssSource.match(/\.point-youtube-controls\s*\{[^}]*\}/)?.[0] || "";
    const activeControlsBlock =
      experimentsCssSource.match(/\.point-youtube-shell-active \.point-youtube-controls\s*\{[^}]*\}/)?.[0] || "";
    const backButtonBlock = experimentsCssSource.match(/\.point-youtube-back,\s*\.point-player-empty-back\s*\{[^}]*\}/)?.[0] || "";
    const playableBackBlock = experimentsCssSource.match(/\.point-youtube-back\s*\{[^}]*\}/)?.[0] || "";
    const emptyBackBlock = experimentsCssSource.match(/\.point-player-empty-back\s*\{[^}]*position: absolute;[^}]*\}/)?.[0] || "";
    const backIconBlock = experimentsCssSource.match(/\.point-player-back-icon\s*\{[^}]*\}/)?.[0] || "";
    const playerVarsBlock =
      experimentsCssSource.match(/\.point-art-player \.art-video-player\s*\{[^}]*--art-theme[^}]*\}/)?.[0] || "";
    const inactiveProgressBlock = experimentsCssSource.match(/\.point-youtube-inactive-progress\s*\{[^}]*\}/)?.[0] || "";
    const activeProgressBlock =
      experimentsCssSource.match(/\.point-youtube-active-progress\s*\{[^}]*height: 30px;[^}]*\}/)?.[0] || "";
    const progressHitBlock = experimentsCssSource.match(/\.point-youtube-progress-hit\s*\{[^}]*\}/)?.[0] || "";
    const progressThumbBlock = experimentsCssSource.match(/\.point-youtube-progress-thumb\s*\{[^}]*\}/)?.[0] || "";
    const timeCapsuleBlock = experimentsCssSource.match(/\.point-youtube-time-capsule\s*\{[^}]*\}/)?.[0] || "";
    const learningCopyBlock = experimentsCssSource.match(/\.point-learning-section > p\s*\{[^}]*\}/)?.[0] || "";
    const equationListBlock = experimentsCssSource.match(/\.point-equation-list\s*\{[^}]*\}/)?.[0] || "";
    const equationRowBlock = experimentsCssSource.match(/\.point-equation-row\s*\{[^}]*\}/)?.[0] || "";
    const equationNoteBlock = experimentsCssSource.match(/\.point-equation-note\s*\{[^}]*\}/)?.[0] || "";
    const safetyCopyBlock = experimentsCssSource.match(/\.safety-section > p\s*\{[^}]*\}/)?.[0] || "";
    const actionAreaBlock = experimentsCssSource.match(/\.point-detail-actions\s*\{[^}]*\}/)?.[0] || "";

    expect(pointVideoPlayerSource).toContain("point-player-back-icon");
    expect(pointVideoPlayerSource).toContain("BackArrowIcon");
    expect(pointVideoPlayerSource).toContain('<BackArrowIcon className="point-player-back-icon" />');
    expect(pointVideoPlayerSource).toContain("autoplay: true");
    expect(pointVideoPlayerSource).toContain("muted: true");
    expect(pointVideoPlayerSource).toContain("miniProgressBar: false");
    expect(pointVideoPlayerSource).toContain("setting: false");
    expect(pointVideoPlayerSource).toContain("lock: false");
    expect(pointVideoPlayerSource).toContain("playbackRate: false");
    expect(pointVideoPlayerSource).toContain("controls: false");
    expect(pointVideoPlayerSource).toContain("point-youtube-shell");
    expect(pointVideoPlayerSource).toContain("point-youtube-inactive-progress");
    expect(pointVideoPlayerSource).toContain("point-youtube-progress-thumb");
    expect(pointVideoPlayerSource).not.toContain('name: "point-time"');
    expect(pointVideoPlayerSource).not.toContain("point-player-back-layer");
    expect(pointVideoPlayerSource).not.toContain("xgplayer");
    expect(pointVideoPlayerSource).not.toContain("import { ArrowLeft");
    expect(pointVideoPlayerSource).not.toContain('const backIconSvg =\\n  \'<svg');
    expect(pointVideoPlayerSource).not.toContain("point-player-back-glyph");
    expect(pointDetailBlock).toContain("padding-top: min(62.5vw, 280px);");
    expect(playerBlock).toContain("position: fixed;");
    expect(playerBlock).toContain("top: 0;");
    expect(playerBlock).toContain("left: 50%;");
    expect(playerBlock).toContain("width: min(100vw, var(--mobile-content-max));");
    expect(playerBlock).toContain("aspect-ratio: 16 / 10;");
    expect(playerBlock).toContain("transform: translateX(-50%);");
    expect(playerBlock).toContain("--point-player-active-progress: linear-gradient");
    expect(defaultChromeHideBlock).toContain("display: none !important;");
    expect(defaultChromeHideBlock).toContain("pointer-events: none !important;");
    expect(defaultChromeHideBlock).toContain(".point-art-player .art-lock");
    expect(defaultChromeHideBlock).toContain(".point-art-player .art-layers");
    expect(shellBlock).toContain("position: absolute;");
    expect(shellBlock).toContain("inset: 0;");
    expect(controlsBlock).toContain("opacity: 0;");
    expect(controlsBlock).toContain("pointer-events: none;");
    expect(activeControlsBlock).toContain("opacity: 1;");
    expect(activeControlsBlock).toContain("pointer-events: auto;");
    expect(backButtonBlock).toContain("width: 44px;");
    expect(backButtonBlock).toContain("height: 44px;");
    expect(backButtonBlock).toContain("background: transparent;");
    expect(backButtonBlock).not.toContain("border-radius: 999px");
    expect(playableBackBlock).toContain("position: absolute;");
    expect(playableBackBlock).toContain("top: 6px;");
    expect(playableBackBlock).toContain("left: 4px;");
    expect(emptyBackBlock).toContain("top: 6px;");
    expect(emptyBackBlock).toContain("left: 4px;");
    expect(backIconBlock).not.toContain("translateX(");
    expect(playerVarsBlock).toContain("--art-theme: #006934;");
    expect(experimentsCssSource).not.toContain("margin: 8px 0 0 18px;");
    expect(experimentsCssSource).not.toContain("left: 18px;");
    expect(experimentsCssSource).not.toContain("transform: translateY(-4px);");
    expect(experimentsCssSource).not.toContain("art-mini-progress-bar");
    expect(experimentsCssSource).not.toContain("art-control-point-time");
    expect(inactiveProgressBlock).toContain("height: 2px;");
    expect(inactiveProgressBlock).toContain("background: var(--point-player-inactive-track);");
    expect(activeProgressBlock).toContain("height: 30px;");
    expect(progressHitBlock).toContain("height: 30px;");
    expect(progressHitBlock).toContain("touch-action: none;");
    expect(progressThumbBlock).toContain("width: 24px;");
    expect(progressThumbBlock).toContain("height: 24px;");
    expect(progressThumbBlock).toContain("background: #ffffff var(--point-player-logo)");
    expect(timeCapsuleBlock).toContain("border-radius: 999px;");
    expect(timeCapsuleBlock).toContain("white-space: nowrap;");
    expect(learningCopyBlock).toContain("font-weight: 640;");
    expect(equationListBlock).toContain("background: transparent;");
    expect(equationRowBlock).toContain("grid-template-columns: 22px minmax(0, 1fr);");
    expect(equationNoteBlock).toContain("font-weight: 650;");
    expect(equationNoteBlock).not.toContain("font-family: ui-monospace");
    expect(safetyCopyBlock).toContain("border-left: 3px solid");
    expect(actionAreaBlock).toContain("padding-bottom: calc(22px + env(safe-area-inset-bottom, 0px));");
  });

  it("keeps secondary-page back arrows shared, flatter, and left-aligned", async () => {
    // @ts-expect-error The frontend tsconfig intentionally omits Node types, but Vitest runs this contract in Node.
    const { readFileSync } = await import("node:fs");
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
    const appShellCssSource = readFileSync(`${cwd}/src/styles/app-shell.css`, "utf8");
    const learningCssSource = readFileSync(`${cwd}/src/styles/learning.css`, "utf8");
    const pagebarButtonBlock = appShellCssSource.match(/\.pagebar \.icon-action\s*\{[^}]*\}/)?.[0] || "";
    const pagebarBlock = appShellCssSource.match(/\.pagebar\s*\{[^}]*minmax\(0, 1fr\)[^}]*\}/)?.[0] || "";
    const searchBackBlock = learningCssSource.match(/\.unified-search-back\s*\{[^}]*\}/)?.[0] || "";

    expect(backArrowIconSource).toContain('studentBackArrowViewBox = "0 0 24 24"');
    expect(backArrowIconSource).toContain(
      'studentBackArrowPath =\n  "M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"',
    );
    expect(backArrowIconSource).toContain('fill="currentColor"');
    expect(backArrowIconSource).toContain("<path d={studentBackArrowPath} />");
    expect(backArrowIconSource).toContain("createBackArrowSvg");
    expect(backArrowIconSource).not.toContain("studentBackArrowStrokeWidth");
    expect(backArrowIconSource).not.toContain("studentBackArrowTipPatchPoints");
    expect(backArrowIconSource).not.toContain("<line");
    expect(backArrowIconSource).not.toContain("<polygon");
    expect(backArrowIconSource).not.toMatch(/base64|\\.png|\\.jpg|\\.jpeg|\\.webp/i);
    expect(pagebarSource).toContain("BackArrowIcon");
    expect(pagebarSource).not.toContain("ArrowLeft");
    expect(unifiedSearchSource).toContain("BackArrowIcon");
    expect(unifiedSearchSource).not.toContain("ArrowLeft");
    expect(pagebarBlock).toContain("grid-template-columns: 38px minmax(0, 1fr);");
    expect(pagebarBlock).toContain("gap: 4px;");
    expect(pagebarButtonBlock).toContain("width: 44px;");
    expect(pagebarButtonBlock).toContain("height: 44px;");
    expect(appShellCssSource).toContain("margin-left: 12px;");
    expect(pagebarButtonBlock).toContain("transform: translateX(-8px);");
    expect(searchBackBlock).toContain("width: 44px;");
    expect(searchBackBlock).toContain("height: 44px;");
    expect(searchBackBlock).toContain("transform: translateX(-8px);");

    [
      "routes/learn/LearningAreaPage.tsx",
      "routes/learn/ChapterStudyPage.tsx",
      "routes/learn/CatalogDirectoryPage.tsx",
      "routes/learn/ElementDetailPage.tsx",
      "routes/video-library/VideoLibraryPage.tsx",
      "routes/ai/AiChatPage.tsx",
      "routes/assessment/AssessmentSessionPage.tsx",
      "routes/assessment/AssessmentReportPage.tsx",
      "routes/profile/FeedbackPage.tsx",
    ].forEach((file) => {
      const source = routeAndFeatureSources[`./${file}`] || "";
      expect(source).toContain("DetailPageFrame");
      expect(source).not.toContain("ArrowLeft");
      expect(source).not.toContain("ChevronLeft");
    });

    expect(routeAndFeatureSources["./routes/search/UnifiedSearchPage.tsx"]).toContain("BackArrowIcon");
    expect(routeAndFeatureSources["./routes/search/UnifiedSearchPage.tsx"]).not.toContain("DetailPageFrame");
    expect(routeAndFeatureSources["./routes/learn/ExperimentPointPage.tsx"]).toContain("CatalogPointDetailPanel");
    expect(routeAndFeatureSources["./routes/learn/ExperimentPointPage.tsx"]).not.toContain("DetailPageFrame");
  });
});
