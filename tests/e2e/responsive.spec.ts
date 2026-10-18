import { test, expect } from "@playwright/test";
import path from "path";
import { mockPipelineApis, mockFailingRun } from "./fixtures";

const FSD_FILE = path.join(__dirname, "fixtures", "sample-fsd.txt");

const VIEWPORTS = [
  { name: "tiny", width: 320, height: 568 },
  { name: "small", width: 360, height: 780 },
  { name: "mobile", width: 390, height: 844 },
  { name: "large-phone", width: 414, height: 896 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`hero has no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("mobile shows the hamburger, not the rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

  await expect(page.getByRole("button", { name: "Toggle Navigation Menu" })).toBeVisible();
  // The sidebar sits off-canvas until opened.
  const asideBox = await page.locator("aside").boundingBox();
  expect(asideBox?.x ?? 0).toBeLessThan(0);

  // Opening it reveals the nav, closing slides it back off-canvas.
  await page.getByRole("button", { name: "Toggle Navigation Menu" }).click();
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Close Navigation" }).click();
  await expect
    .poll(async () => (await page.locator("aside").boundingBox())?.x ?? 0)
    .toBeLessThan(0);
});

test("the test-case table scrolls inside its container on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPipelineApis(page);
  await page.goto("/");
  await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

  await page.locator('input[type="file"]').setInputFiles(FSD_FILE);
  await page.locator('button[title="Analyze requirements"]').click();
  await expect(page.getByText("Analysis complete")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Generate Test Cases/i }).click();
  await expect(page.locator("#testcases-section")).toBeVisible({ timeout: 30_000 });

  // Page itself must not scroll sideways — the table container absorbs it.
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(1);

  const tableOverflow = await page.evaluate(() => {
    const el = document.querySelector("#testcases-section .overflow-auto");
    return el ? el.scrollWidth - el.clientWidth : -1;
  });
  expect(tableOverflow).toBeGreaterThan(0);
});

test("the deep pipeline states stay inside the viewport on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockPipelineApis(page);
  await mockFailingRun(page);
  await page.goto("/");
  await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

  await page.locator('input[type="file"]').setInputFiles(FSD_FILE);
  await page.locator('button[title="Analyze requirements"]').click();
  await expect(page.getByText("Analysis complete")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Generate Test Cases/i }).click();
  await expect(page.locator("#testcases-section")).toBeVisible({ timeout: 30_000 });

  // Both header actions wrap onto the narrow screen instead of overflowing.
  await expect(page.locator('button[title="Manually add a test case to the suite"]')).toBeVisible();

  await page.getByRole("button", { name: "Automate" }).first().click();
  await expect(page.locator("#automation-section")).toBeVisible();
  await page.locator("#automation-section input").first().fill("https://example.com");
  await page.getByRole("button", { name: /Generate Playwright Script/i }).click();
  await expect(
    page.locator("#automation-section").getByText(".spec.ts — Playwright / TypeScript"),
  ).toBeVisible({ timeout: 30_000 });

  // The script toolbar (Edit / Copy / .spec.ts) wraps instead of overflowing.
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByRole("button", { name: ".spec.ts" })).toBeVisible();

  await page.getByRole("button", { name: "Run Automation" }).click();
  await expect(page.getByTestId("execution-report")).toBeVisible({ timeout: 30_000 });

  // The page must never scroll sideways — at any point of the flow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
