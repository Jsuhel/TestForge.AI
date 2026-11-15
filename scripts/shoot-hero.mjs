// Throwaway visual check for the animated hero (output outside test-results/,
// which Playwright wipes on every run).
import { chromium } from "@playwright/test";

const SHOTS = [
  { name: "hero-desktop", width: 1440, height: 900 },
  { name: "hero-laptop", width: 1280, height: 800 },
  { name: "hero-tablet", width: 768, height: 1024 },
  { name: "hero-mobile", width: 390, height: 844 },
  { name: "hero-tiny", width: 320, height: 568 },
  { name: "hero-wide", width: 1920, height: 1080 },
];

const browser = await chromium.launch();
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await page.goto("http://localhost:3000");
  await page.waitForSelector("#fsd-upload-section h1", { timeout: 60_000 });
  await page.waitForSelector('input[type="file"]', { timeout: 30_000, state: "attached" });
  await page.waitForTimeout(1400); // entrance staggers done, ambient motion live
  await page.screenshot({ path: `screenshots/hero/${shot.name}.png` });
  await page.close();
}

// Mobile sidebar open — shows the History list and its Clear button.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://localhost:3000");
  await page.waitForSelector("#fsd-upload-section h1", { timeout: 60_000 });
  await page.getByRole("button", { name: "Toggle Navigation Menu" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/hero/sidebar-mobile.png" });
  await page.close();
}
await browser.close();
console.log("written to screenshots/hero/");
