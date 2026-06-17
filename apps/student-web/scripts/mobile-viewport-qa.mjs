import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const appDir = path.resolve(import.meta.dirname, "..");
const adminWebDir = path.resolve(appDir, "../admin-web");

const viewports = [
  { name: "small-phone", width: 360, height: 780 },
  { name: "regular-phone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
];

const baseUrl = process.env.STUDENT_H5_URL || "http://127.0.0.1:5173";
const studentId = process.env.STUDENT_H5_QA_STUDENT_ID || "";
const password = process.env.STUDENT_H5_QA_PASSWORD || "";
const allowAuthSkip = process.env.STUDENT_H5_QA_ALLOW_AUTH_SKIP === "1";

async function loadPlaywright() {
  try {
    const playwrightPath = require.resolve("playwright", { paths: [appDir, adminWebDir, process.cwd()] });
    return import(pathToFileURL(playwrightPath).href);
  } catch (error) {
    throw new Error(
      "Playwright is required for mobile QA. Install it in apps/student-web or keep apps/admin-web/node_modules available.",
      { cause: error },
    );
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const maxScrollWidth = Math.max(metrics.documentScrollWidth, metrics.bodyScrollWidth);
  if (maxScrollWidth > metrics.documentClientWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${maxScrollWidth}px > ${metrics.documentClientWidth}px`);
  }
}

async function visibleRects(page, selectors) {
  return page.evaluate((selectorList) => {
    const entries = [];
    for (const selector of selectorList) {
      for (const element of document.querySelectorAll(selector)) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) continue;
        entries.push({
          selector,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    return entries;
  }, selectors);
}

function overlaps(first, second) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}

async function assertNoOverlap(page, label, selectors) {
  const rects = await visibleRects(page, selectors);
  for (let index = 0; index < rects.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < rects.length; nextIndex += 1) {
      const first = rects[index];
      const second = rects[nextIndex];
      if (first.selector === second.selector) continue;
      if (overlaps(first, second)) {
        throw new Error(`${label}: ${first.selector} overlaps ${second.selector}`);
      }
    }
  }
}

async function assertElementChipRowBalanced(page, label) {
  const metrics = await page.evaluate(() => {
    const row = document.querySelector(".element-chip-row");
    if (!row) return null;

    const chips = Array.from(row.querySelectorAll(".element-chip")).filter((chip) => {
      const rect = chip.getBoundingClientRect();
      const style = window.getComputedStyle(chip);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    if (chips.length < 2) return null;

    const rowRect = row.getBoundingClientRect();
    const firstRect = chips[0].getBoundingClientRect();
    const lastRect = chips[chips.length - 1].getBoundingClientRect();
    const chipRects = chips.map((chip) => chip.getBoundingClientRect());

    return {
      chipCount: chips.length,
      rowWidth: rowRect.width,
      leftInset: firstRect.left - rowRect.left,
      rightInset: rowRect.right - lastRect.right,
      minChipHeight: Math.min(...chipRects.map((rect) => rect.height)),
      minChipWidth: Math.min(...chipRects.map((rect) => rect.width)),
    };
  });

  if (!metrics) return;
  if (metrics.minChipHeight < 44 || metrics.minChipWidth < 44) {
    throw new Error(
      `${label}: element chip touch size too small ${metrics.minChipWidth.toFixed(1)}x${metrics.minChipHeight.toFixed(1)}`,
    );
  }

  const imbalance = Math.abs(metrics.leftInset - metrics.rightInset);
  const tolerance = Math.max(12, metrics.rowWidth * 0.06);
  if (imbalance > tolerance) {
    throw new Error(
      `${label}: element row is not balanced for ${metrics.chipCount} chips, left ${metrics.leftInset.toFixed(1)}px vs right ${metrics.rightInset.toFixed(1)}px`,
    );
  }
}

async function waitForAny(page, selectors, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) return selector;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for any selector: ${selectors.join(", ")}`);
}

async function forceClickIfAttached(page, selector) {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) return false;
  await target.click({ force: true });
  return true;
}

async function loginIfConfigured(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(page, "login");
  await page.locator(".auth-panel").first().waitFor({ state: "visible", timeout: 10000 });

  if (!studentId || !password) {
    if (allowAuthSkip) return false;
    throw new Error("Set STUDENT_H5_QA_STUDENT_ID and STUDENT_H5_QA_PASSWORD, or set STUDENT_H5_QA_ALLOW_AUTH_SKIP=1.");
  }

  await page.locator(".auth-form input").nth(0).fill(studentId);
  await page.locator(".auth-form input").nth(1).fill(password);
  await page.locator(".auth-form button[type='submit']").click();

  const loginResult = await waitForAny(page, [".learning-panel", ".success-panel", ".assessment-panel", ".form-error"], 15000);
  if (loginResult === ".form-error") {
    const errorText = await page.locator(".form-error").first().innerText();
    throw new Error(`Login failed: ${errorText}`);
  }
  if (await page.locator(".success-panel").first().isVisible().catch(() => false)) {
    await page.locator(".success-panel button").first().click({ force: true });
  }
  if (await page.locator(".assessment-panel").first().isVisible().catch(() => false)) {
    throw new Error("Pretest rendered instead of the temporary skip barrier; provide an account that can enter learning directly.");
  }
  await page.locator(".learning-panel").first().waitFor({ state: "visible", timeout: 15000 });
  return true;
}

async function checkAuthenticatedFlows(page, viewportName) {
  await assertNoHorizontalOverflow(page, `${viewportName}: learning home`);
  await page.locator(".learning-topbar").first().waitFor({ state: "visible", timeout: 10000 });
  await waitForAny(
    page,
    [".chapter-entry-card", ".chapter-context-card", ".selected-element-panel", ".learning-point-card", ".empty-learning-card"],
    15000,
  );
  if (await page.locator(".chapter-entry-card").first().isVisible().catch(() => false)) {
    const firstChapterCard = page.locator(".chapter-entry-card").first();
    await firstChapterCard.scrollIntoViewIfNeeded();
    await firstChapterCard.click({ force: true });
    await waitForAny(page, [".chapter-context-card", ".selected-element-panel", ".learning-point-card", ".empty-learning-card"], 15000);
    if (!(await page.locator(".chapter-context-card").first().isVisible().catch(() => false))) {
      await page.waitForFunction(
        () => document.querySelector(".chapter-context-card") || !document.querySelector(".chapter-entry-card"),
        null,
        { timeout: 15000 },
      );
    }
  }
  await page.locator(".chapter-context-card").first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".chapter-view-switcher").first().waitFor({ state: "visible", timeout: 10000 });
  await waitForAny(page, [".selected-element-panel", ".element-chip"], 15000);
  await assertElementChipRowBalanced(page, `${viewportName}: element chips`);
  const secondElementChip = page.locator(".element-chip").nth(1);
  if (await secondElementChip.isVisible().catch(() => false)) {
    await secondElementChip.click();
    await page.locator(".selected-element-panel").first().waitFor({ state: "visible", timeout: 10000 });
  }
  await page.locator(".chapter-view-switcher button").nth(1).click();
  await waitForAny(page, [".learning-point-card", ".empty-learning-card"], 15000);
  await page.locator(".chapter-view-switcher button").nth(0).click();
  await page.locator(".selected-element-panel").first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".chapter-view-switcher button").nth(1).click();
  await waitForAny(page, [".learning-point-card", ".empty-learning-card"], 15000);
  await page.locator(".ai-chat-toggle").first().waitFor({ state: "attached", timeout: 15000 });
  await page.locator(".feedback-toggle").first().waitFor({ state: "attached", timeout: 15000 });
  await assertNoOverlap(page, `${viewportName}: closed floating entries`, [".ai-chat-fab", ".feedback-fab", ".chapter-view-switcher"]);

  if (!(await forceClickIfAttached(page, ".ai-chat-toggle"))) {
    throw new Error(`${viewportName}: AI chat toggle is not attached`);
  }
  await page.locator(".ai-chat-panel").first().waitFor({ state: "visible", timeout: 10000 });
  await assertNoHorizontalOverflow(page, `${viewportName}: ai panel`);
  await assertNoOverlap(page, `${viewportName}: ai panel`, [".ai-chat-fab", ".feedback-fab", ".finish-action"]);
  await forceClickIfAttached(page, ".ai-chat-toggle");

  if (!(await forceClickIfAttached(page, ".feedback-toggle"))) {
    throw new Error(`${viewportName}: feedback toggle is not attached`);
  }
  await page.locator(".feedback-panel").first().waitFor({ state: "visible", timeout: 10000 });
  await assertNoHorizontalOverflow(page, `${viewportName}: feedback panel`);
  await assertNoOverlap(page, `${viewportName}: feedback panel`, [".ai-chat-fab", ".feedback-fab", ".finish-action"]);
  await forceClickIfAttached(page, ".feedback-toggle");

  const finishAction = page.locator(".finish-action").first();
  if (await finishAction.isVisible().catch(() => false)) {
    await finishAction.scrollIntoViewIfNeeded();
    await assertNoOverlap(page, `${viewportName}: finish action`, [".ai-chat-fab", ".feedback-fab", ".finish-action", ".chapter-view-switcher"]);
  }

  const pointCard = page.locator(".learning-point-card").first();
  if (await pointCard.isVisible().catch(() => false)) {
    await pointCard.click();
    await waitForAny(page, [".video-stage", ".experiment-detail-card", ".learning-state"], 15000);
    await assertNoHorizontalOverflow(page, `${viewportName}: point detail`);
    await assertNoOverlap(page, `${viewportName}: point detail`, [".ai-chat-fab", ".feedback-fab", ".finish-action"]);
  } else {
    throw new Error(`${viewportName}: no learning point card is renderable`);
  }
}

const playwright = await loadPlaywright();
const chromium = playwright.chromium || playwright.default?.chromium;
if (!chromium) {
  throw new Error("Playwright loaded, but chromium launcher was not available.");
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Executable doesn't exist")) throw error;
    for (const channel of ["msedge", "chrome"]) {
      try {
        return await chromium.launch({ channel, headless: true });
      } catch {
        // Try the next locally installed browser channel.
      }
    }
    throw error;
  }
}

const browser = await launchBrowser();
const results = [];

try {
  for (const viewport of viewports) {
    try {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      const authenticated = await loginIfConfigured(page);
      if (authenticated) {
        await checkAuthenticatedFlows(page, viewport.name);
      }
      await context.close();
      results.push({ ...viewport, authenticated });
    } catch (error) {
      throw new Error(`${viewport.name} ${viewport.width}x${viewport.height}: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl, results }, null, 2));
