import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR = "C:/Users/Asus/.gemini/antigravity-ide/brain/e9eb816f-6374-4a99-8017-9b31f82c26d7";

const VIEWPORTS = [
  { name: "mobile-small", width: 320, height: 568 },
  { name: "mobile-standard", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function run() {
  console.log("Starting responsive verification suite...");
  const browser = await chromium.launch({ headless: true });

  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // let framer-motion animations settle

    // Check for horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      const hasOverflow = scrollWidth > clientWidth;

      // Find any element wider than viewport
      const overflowingElements = [];
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || "").toString().slice(0, 50),
            right: rect.right,
            width: rect.width,
          });
        }
      }

      return {
        clientWidth,
        scrollWidth,
        hasOverflow,
        overflowCount: overflowingElements.length,
        firstFewOverflows: overflowingElements.slice(0, 3),
      };
    });

    console.log(`- clientWidth: ${overflowInfo.clientWidth}px, scrollWidth: ${overflowInfo.scrollWidth}px`);
    console.log(`- Horizontal overflow: ${overflowInfo.hasOverflow ? "FAIL" : "PASS"}`);
    if (overflowInfo.hasOverflow) {
      console.warn("Overflowing elements:", overflowInfo.firstFewOverflows);
    }

    // Capture screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, `responsive_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`- Screenshot saved: ${screenshotPath}`);

    // If mobile/tablet, test mobile menu drawer opening and closing
    if (vp.width < 1024) {
      const menuBtn = page.locator("button[aria-label='Toggle Navigation Menu']");
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(400);

        const closeBtn = page.locator("button[aria-label='Close Navigation']");
        const isCloseVisible = await closeBtn.isVisible();
        console.log(`- Mobile drawer opened, close button visible: ${isCloseVisible}`);

        const drawerScreenshot = path.join(ARTIFACTS_DIR, `responsive_${vp.name}_drawer.png`);
        await page.screenshot({ path: drawerScreenshot });

        if (isCloseVisible) {
          await closeBtn.click();
          await page.waitForTimeout(400);
          console.log(`- Mobile drawer closed successfully`);
        }
      }
    }

    results.push({
      viewport: vp.name,
      width: vp.width,
      overflow: overflowInfo.hasOverflow,
      overflowCount: overflowInfo.overflowCount,
    });

    await context.close();
  }

  await browser.close();

  console.log("\n=========================================");
  console.log("RESPONSIVE VERIFICATION SUMMARY");
  console.log("=========================================");
  let allPassed = true;
  for (const r of results) {
    const status = !r.overflow ? "PASSED" : "FAILED";
    if (r.overflow) allPassed = false;
    console.log(`- ${r.viewport} (${r.width}px): ${status} (Overflow count: ${r.overflowCount})`);
  }
  console.log(`Overall: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
  console.log("=========================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
