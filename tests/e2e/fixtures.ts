import type { Page } from "@playwright/test";

/**
 * Deterministic API fixtures + route mocks for the TestForge pipeline.
 * Keeping the analysis small makes the streaming explanation finish fast.
 */

export const ANALYSIS_FIXTURE = {
  documentName: "sample-fsd.txt",
  engine: "claude",
  engineLabel: "GLM AI",
  documentType: "Functional Specification Document",
  summary: "A compact login-module specification used by the e2e suite.",
  modules: ["Authentication", "Password Reset"],
  requirements: [
    {
      id: "FR-001",
      text: "The system shall validate the username and password on the login page.",
      module: "Authentication",
      type: "functional",
      priority: "High",
    },
    {
      id: "FR-002",
      text: "The system shall display an error message when authentication fails.",
      module: "Authentication",
      type: "validation",
      priority: "High",
    },
    {
      id: "BR-003",
      text: "The system shall lock the account after 5 consecutive failed attempts.",
      module: "Authentication",
      type: "business-rule",
      priority: "Medium",
    },
    {
      id: "FR-004",
      text: "The system shall support password reset via registered email.",
      module: "Password Reset",
      type: "functional",
      priority: "Medium",
    },
  ],
  userJourneys: [
    { name: "Login", steps: ["Open login page", "Enter credentials", "Submit form"] },
  ],
  stats: {
    pages: 1,
    words: 120,
    requirementCount: 4,
    moduleCount: 2,
    journeyCount: 1,
  },
};

export const TEST_CASES_FIXTURE = [
  {
    id: "LOGIN_TS_01",
    title: "Verify by logging in with valid registered credentials from the login page.",
    summary: "Smoke — valid login end-to-end",
    module: "Authentication",
    type: "Positive",
    priority: "High",
    precondition: "A registered user exists and the login page is reachable.",
    steps: ["Open the login page", "Enter valid credentials", "Submit the form"],
    expectedResult: "System should authenticate the user and land them on the dashboard.",
    requirementId: "FR-001",
  },
  {
    id: "LOGIN_TS_02",
    title: "Verify by submitting the login form with an invalid password.",
    summary: "Invalid password rejected",
    module: "Authentication",
    type: "Negative",
    priority: "High",
    precondition: "A registered user exists",
    steps: ["Open the login page", "Enter invalid credentials", "Submit the form"],
    expectedResult: "System should display an error message and not authenticate the user.",
    requirementId: "FR-002",
  },
  {
    id: "LOGIN_TS_03",
    title: "Verify by failing authentication five consecutive times and attempting a sixth login.",
    summary: "Account lockout after five failures",
    module: "Authentication",
    type: "Edge Case",
    priority: "Medium",
    precondition: "A registered user exists",
    steps: ["Open the login page", "Fail authentication five times", "Attempt a sixth login"],
    expectedResult: "System should lock the account as per the five-attempt business rule.",
    requirementId: "BR-003",
    clarificationNote: "FSD does not state the lockout duration — confirm with business.",
  },
];

export const SCRIPT_FIXTURE = [
  'import { test, expect } from "@playwright/test";',
  "",
  'test("TC-001 - login journey", async ({ page }) => {',
  '  const url = process.env.APP_URL ?? "https://example.com/login";',
  '  await page.goto(url);',
  '  await page.fill("#username", "demo");',
  '  await page.fill("#password", "demo123");',
  '  await page.click("button[type=submit]");',
  "});",
].join("\n");

/** Install route mocks for every AI endpoint the pipeline calls. */
export async function mockPipelineApis(page: Page) {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({ json: ANALYSIS_FIXTURE });
  });
  await page.route("**/api/generate-tests", async (route) => {
    await route.fulfill({
      json: { testCases: TEST_CASES_FIXTURE, engine: "claude", engineLabel: "GLM AI" },
    });
  });
  await page.route("**/api/automate", async (route) => {
    await route.fulfill({ json: { script: SCRIPT_FIXTURE, engine: "claude", engineLabel: "GLM AI" } });
  });
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      json: {
        answer:
          "This FSD covers **login** and **password reset**. The high-priority rules are credential validation and the five-attempt lockout *(FR-001)*.",
        engineLabel: "GLM AI",
      },
    });
  });
}

/** A 1×1 JPEG used as a stand-in failure screenshot. */
export const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/2gAIAQEAAD8A0s8g/9k=";

/** Mock /api/run with a failing execution: step 2 fails with a screenshot,
 *  step 3 fails too, and the overall verdict is FAILED. */
export async function mockFailingRun(page: Page) {
  await page.route("**/api/run", async (route) => {
    const lines = [
      { type: "log", line: { kind: "info", text: "Launching a headless browser…" } },
      { type: "step-start", index: 0, total: 3, step: "Navigate to the application" },
      {
        type: "step-result",
        result: {
          index: 0,
          step: "Navigate to the application",
          status: "passed",
          detail: "opened https://example.com",
          screenshot: TINY_JPEG,
        },
      },
      {
        type: "step-result",
        result: {
          index: 1,
          step: "Enter valid email and password",
          status: "failed",
          detail:
            "Error: locator.fill: Timeout 8000ms — the input field was not found on the page. Check that the app loaded and the field/button is visible.",
          screenshot: TINY_JPEG,
        },
      },
      {
        type: "step-result",
        result: {
          index: 2,
          step: "Expected result: System should display the dashboard.",
          status: "failed",
          detail: "expected content did not render",
          screenshot: TINY_JPEG,
        },
      },
      {
        type: "done",
        result: {
          url: "https://example.com",
          headed: false,
          browser: "Chromium",
          overall: "failed",
          durationMs: 12500,
          steps: [
            { index: 0, step: "Navigate to the application", status: "passed", detail: "opened https://example.com", screenshot: TINY_JPEG },
            { index: 1, step: "Enter valid email and password", status: "failed", detail: "Error: locator.fill: Timeout 8000ms — the input field was not found on the page.", screenshot: TINY_JPEG },
            { index: 2, step: "Expected result: System should display the dashboard.", status: "failed", detail: "expected content did not render", screenshot: TINY_JPEG },
          ],
        },
      },
    ];
    const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    await route.fulfill({
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      body,
    });
  });
}
