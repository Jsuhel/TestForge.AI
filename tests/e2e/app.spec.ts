import { test, expect } from "@playwright/test";
import path from "path";
import ExcelJS from "exceljs";
import { mockPipelineApis, mockFailingRun, TEST_CASES_FIXTURE } from "./fixtures";

const FSD_FILE = path.join(__dirname, "fixtures", "sample-fsd.txt");

/** Drive the app from upload through generated test cases (APIs mocked). */
async function generateTestCases(page: import("@playwright/test").Page) {
  await mockPipelineApis(page);
  await page.goto("/");
  await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

  await page.locator('input[type="file"]').setInputFiles(FSD_FILE);
  await page.locator('button[title="Analyze requirements"]').click();

  // Analysis card streams its explanation, then offers generation.
  await expect(page.getByText("Analysis complete")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Generate Test Cases/i }).click();

  await expect(page.locator("#testcases-section")).toBeVisible({ timeout: 30_000 });
}

test.describe("Theme", () => {
  test("renders on the dark canvas with the gradient brand accent", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe("rgb(9, 13, 22)"); // #090d16

    const heading = page.locator("#fsd-upload-section h1").first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("TestForge AI");
  });
});

test.describe("Pipeline (mocked APIs)", () => {
  test("analyzes an FSD and generates the test case table", async ({ page }) => {
    await generateTestCases(page);

    // Every fixture case rendered, with hairline ledger styling.
    for (const tc of TEST_CASES_FIXTURE) {
      await expect(page.locator("#testcases-section").getByText(tc.id).first()).toBeVisible();
    }
    await expect(page.getByText(`${TEST_CASES_FIXTURE.length} test scenarios generated`)).toBeVisible();
  });

  test("adds a test case manually", async ({ page }) => {
    await generateTestCases(page);

    const before = await page.locator("#testcases-section tbody tr:has(td)").count();
    await page.locator('button[title="Manually add a test case to the suite"]').click();
    await expect(page.getByText("New test case")).toBeVisible();

    await page
      .locator("#testcases-section input[type='text']")
      .first()
      .fill("Verify login page loads over HTTPS");
    await page.getByRole("button", { name: "Save Test Case" }).click();

    const after = await page.locator("#testcases-section tbody tr:has(td)").count();
    expect(after).toBe(before + 1);
    await expect(page.getByText("Verify login page loads over HTTPS")).toBeVisible();
  });

  test("deletes a test case with a two-click confirm", async ({ page }) => {
    await generateTestCases(page);

    const before = await page.locator("#testcases-section tbody tr:has(td)").count();

    // First click arms, second click confirms.
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByRole("button", { name: "Confirm" })).toHaveCount(1, { timeout: 15_000 });
    await page.getByRole("button", { name: "Confirm" }).first().click();

    await expect
      .poll(
        async () => page.locator("#testcases-section tbody tr:has(td)").count(),
        { timeout: 15_000 },
      )
      .toBe(before - 1);
  });

  test("generates, edits and saves the Playwright script", async ({ page }) => {
    await generateTestCases(page);

    await page.getByRole("button", { name: "Automate" }).first().click();
    await expect(page.locator("#automation-section")).toBeVisible();

    await page
      .locator('#automation-section input[type="text"]')
      .first()
      .fill("https://example.com/login");
    await page.getByRole("button", { name: /Generate Playwright Script/i }).click();

    const terminal = page.locator("#automation-section").getByText(".spec.ts — Playwright / TypeScript");
    await expect(terminal).toBeVisible({ timeout: 30_000 });

    // Read-only viewer shows the fixture script.
    const viewer = page.locator("#automation-section pre");
    await expect(viewer).toContainText("TC-001");

    // Edit, save, and confirm the change persists in the viewer.
    const auto = page.locator("#automation-section");
    await auto.getByRole("button", { name: "Edit" }).click();
    const textarea = auto.locator("textarea");
    await expect(textarea).toBeVisible();
    const current = await textarea.inputValue();
    await textarea.fill(current + "\n// e2e edit\n");
    await auto.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator("#automation-section pre")).toContainText("e2e edit");

    // Cancel discards further edits.
    await auto.getByRole("button", { name: "Edit" }).click();
    await auto.locator("textarea").fill("// discarded");
    await auto.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("#automation-section pre")).not.toContainText("discarded");
  });

  test("downloads the 11-column formatted Test Scenario workbook", async ({ page }) => {
    await generateTestCases(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download Excel \(\.xlsx\)/i }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("sample_fsd_Test_Scenarios.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await download.path());
    const sheet = workbook.getWorksheet("Test Scenario");
    expect(sheet).toBeTruthy();
    expect(sheet!.rowCount).toBe(TEST_CASES_FIXTURE.length + 1);

    // The 11 mandated columns, in the mandated order.
    const header = (sheet!.getRow(1).values as unknown[]).slice(1) as string[];
    expect(header).toEqual([
      "Requirement ID",
      "Test Scenario ID",
      "Test Summary",
      "Pre-condition",
      "Test Steps",
      "Test Scenario",
      "Expected Test Result",
      "Actual Results",
      "Reviewed By",
      "Reviewer Remarks",
      "Tester Remarks",
    ]);

    // Blue bold header + writing-style conventions + ambiguity flag in remarks.
    const headerCell = sheet!.getRow(1).getCell(1);
    expect(headerCell.font?.bold).toBe(true);
    expect((headerCell.fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe("FF1F4E79");
    expect(String(sheet!.getRow(2).getCell(6).value)).toMatch(/^Verify by/);
    expect(String(sheet!.getRow(2).getCell(7).value)).toMatch(/^System should/);
    expect(String(sheet!.getRow(4).getCell(10).value)).toContain("confirm with business");
  });

  test("execution report shows failures with screenshots and downloads as HTML", async ({ page }) => {
    await mockPipelineApis(page);
    await mockFailingRun(page);
    await page.goto("/");
    await page.waitForSelector("text=Welcome to", { timeout: 60_000 });

    await page.locator('input[type="file"]').setInputFiles(FSD_FILE);
    await page.locator('button[title="Analyze requirements"]').click();
    await expect(page.getByText("Analysis complete")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Generate Test Cases/i }).click();
    await expect(page.locator("#testcases-section")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Automate" }).first().click();
    await expect(page.locator("#automation-section")).toBeVisible();
    // The URL prerequisite is the first input in the form (type=url).
    await page.locator("#automation-section input").first().fill("https://example.com");
    await page.getByRole("button", { name: /Generate Playwright Script/i }).click();
    await expect(
      page.locator("#automation-section").getByText(".spec.ts — Playwright / TypeScript"),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Run Automation" }).click();

    // The report appears with the failure breakdown.
    const report = page.getByTestId("execution-report");
    await expect(report).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#automation-section").getByText("Test Failed")).toBeVisible();
    await expect(report.getByText(/Where the logic failed \(2\)/)).toBeVisible();
    await expect(report.getByText(/Timeout 8000ms/).first()).toBeVisible();
    // Each failure block carries the screenshot of where the logic broke.
    await expect(report.locator("img").first()).toBeVisible();
    await expect(report.locator("img")).toHaveCount(2);

    // The downloadable HTML report embeds the failures and the screenshot.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      report.getByRole("button", { name: "Download Report" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("LOGIN_TS_01_Execution_Report.html");
    const { readFile } = await import("fs/promises");
    const content = await readFile(String(await download.path()), "utf8");
    expect(content).toContain("Test Execution Report");
    expect(content).toContain("Where the logic failed");
    expect(content).toContain("data:image/jpeg;base64,");
  });

  test("chat answers a suggested question about the FSD", async ({ page }) => {
    await generateTestCases(page);

    await page
      .locator("#chat-section button", { hasText: "Explain this FSD in simple words" })
      .click();
    await expect(page.locator("#chat-section").getByText("high-priority rules")).toBeVisible({
      timeout: 30_000,
    });
  });
});
