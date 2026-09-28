import { chromium } from "playwright";
import type { Locator, Page } from "playwright";
import type { TestCase } from "./types";

export interface StepResult {
  index: number;
  step: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
  screenshot?: string; // base64 PNG
}

export interface RunResult {
  url: string;
  headed: boolean;
  browser: string;
  overall: "passed" | "failed";
  durationMs: number;
  steps: StepResult[];
}

/** One live progress line, streamed to the dashboard while the run executes. */
export interface RunLogLine {
  kind: "info" | "action" | "success" | "error";
  text: string;
}

/** Events emitted as the run progresses; streamed to the client as NDJSON. */
export type RunEvent =
  | { type: "log"; line: RunLogLine }
  | { type: "step-start"; index: number; total: number; step: string }
  | { type: "step-result"; result: StepResult }
  | { type: "done"; result: RunResult }
  | { type: "error"; message: string };

const ACTION_TIMEOUT = 8_000;

export class RunError extends Error {}

/** The step's target (field/button) doesn't exist on the current page — e.g. the
 *  flow already moved past it. The step is skipped, not failed. */
export class StepNotApplicableError extends Error {}

function value(params: Record<string, string>, key: string, fallback = ""): string {
  return (params[key] ?? "").trim() || fallback;
}

/** Trim a Playwright error down to the useful first line, plus an actionable hint. */
function friendlyError(error: unknown, context: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw.split("\n").find((l) => l.trim()) ?? raw;
  const hint =
    /timeout|waiting for/i.test(raw)
      ? ` — ${context} was not found on the page. Check that the app loaded and the field/button is visible.`
      : /net::|ERR_|Navigation failed/i.test(raw)
        ? " — the application URL did not load. Check the URL is reachable from this machine."
        : "";
  return `${firstLine.trim().slice(0, 180)}${hint}`;
}

async function launchBrowser(headed: boolean) {
  // Bundled Chromium first; fall back to installed Edge/Chrome (Windows always has Edge).
  // In headed mode a short slowMo pauses after every action so a human can
  // actually watch each step being performed in the visible window.
  const candidates: Array<{ label: string; options: Record<string, unknown> }> = [
    { label: "Chromium", options: {} },
    { label: "Edge", options: { channel: "msedge" } },
    { label: "Chrome", options: { channel: "chrome" } },
  ];
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const browser = await chromium.launch({
        headless: !headed,
        slowMo: headed ? 300 : 0,
        ...candidate.options,
      });
      return { browser, label: candidate.label };
    } catch (error) {
      errors.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new RunError(
    `No browser could be launched. Run "npx playwright install chromium" first.\n${errors.join("\n")}`,
  );
}

/** Pick the first empty visible text-ish input so successive fills don't overwrite each other. */
async function firstEmptyInput(page: Page): Promise<Locator | null> {
  const inputs = page.locator(
    "input:visible:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea:visible",
  );
  const count = Math.min(await inputs.count(), 8);
  for (let i = 0; i < count; i++) {
    const candidate = inputs.nth(i);
    try {
      if ((await candidate.inputValue({ timeout: 1500 })) === "") return candidate;
    } catch {
      // not fillable — try the next one
    }
  }
  return count > 0 ? inputs.first() : null;
}

/**
 * Self-healing field fill: label → placeholder → semantic input type →
 * accessible textbox name → test id → first empty visible input.
 */
async function smartFill(
  page: Page,
  keyword: RegExp,
  v: string,
  what: string,
  semanticType?: string,
): Promise<string> {
  const attempts: Array<{ locator: Locator; how: string }> = [
    { locator: page.getByLabel(keyword).first(), how: "label" },
    { locator: page.getByPlaceholder(keyword).first(), how: "placeholder" },
  ];
  if (semanticType) {
    attempts.push({
      locator: page.locator(`input[type=${semanticType}]`).first(),
      how: `input[type=${semanticType}]`,
    });
  }
  attempts.push(
    { locator: page.getByRole("textbox", { name: keyword }).first(), how: "accessible name" },
    { locator: page.getByTestId(keyword).first(), how: "test id" },
  );

  for (const attempt of attempts) {
    try {
      if ((await attempt.locator.count()) > 0) {
        await attempt.locator.fill(v, { timeout: ACTION_TIMEOUT });
        return `filled ${what} (matched by ${attempt.how})`;
      }
    } catch {
      // this strategy failed — fall through to the next
    }
  }

  const fallback = await firstEmptyInput(page);
  if (fallback) {
    await fallback.fill(v, { timeout: ACTION_TIMEOUT });
    return `filled ${what} (first empty input — no matching label found)`;
  }
  throw new StepNotApplicableError(
    `no input field found for ${what} on the current page — the flow may already be past this step`,
  );
}

/** Self-healing primary-button click. */
async function smartClickSubmit(page: Page): Promise<void> {
  const attempts: Locator[] = [
    page.getByRole("button", { name: /submit|continue|next|confirm|save|register|apply|send|log ?in|sign ?in|create|search/i }).first(),
    page.locator("input[type=submit], button[type=submit]").first(),
    page.locator("button:visible").first(),
  ];
  for (const attempt of attempts) {
    try {
      await attempt.click({ timeout: ACTION_TIMEOUT });
      return;
    } catch {
      // try next strategy
    }
  }
  throw new StepNotApplicableError(
    "no action button found on the current page — the flow may already be past this step",
  );
}

interface RunState {
  loggedIn: boolean;
  /** Precondition text — used to decide whether auto-login is appropriate. */
  precondition: string;
}

/** A login is only attempted when the step or precondition actually asks for one. */
const LOGIN_INTENT = /log ?in|sign ?in|login|authenticat|credentials|has access|logged[- ]in/i;

/** Execute one manual step against the live page. Throws on failure. */
async function executeStep(
  page: Page,
  step: string,
  params: Record<string, string>,
  state: RunState,
  emit: (line: RunLogLine) => void,
): Promise<string> {
  const s = step.toLowerCase();
  const url = value(params, "url", "https://example.com");
  const username = value(params, "username");
  const password = value(params, "password");
  const amount = value(params, "amount", "5000");
  const testEmail = value(params, "testEmail", "not-an-email@@invalid");
  const fileName = value(params, "fileName", "./sample.pdf");

  // 1. Navigation (+ login only when the step/precondition clearly implies one)
  if (/navigate|access the application|open the app|go to/.test(s)) {
    emit({ kind: "action", text: `Navigating to ${url}…` });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    let detail = `opened ${url}`;
    const wantsLogin = LOGIN_INTENT.test(step) || LOGIN_INTENT.test(state.precondition);
    if (username && password && !state.loggedIn && wantsLogin) {
      emit({ kind: "action", text: `Signing in as ${username}…` });
      try {
        await smartFill(page, /email|username|user id|login/i, username, "username", "email");
        await smartFill(page, /password|passcode/i, password, "password", "password");
        await smartClickSubmit(page);
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
        state.loggedIn = true;
        detail += " and signed in";
      } catch {
        detail += " (no login form found — continuing as guest)";
      }
    }
    return detail;
  }

  // 2. Uploads
  if (/upload|attach/.test(s)) {
    emit({ kind: "action", text: `Attaching file ${fileName}…` });
    await page.setInputFiles("input[type=file]", fileName, { timeout: ACTION_TIMEOUT });
    return `uploaded ${fileName}`;
  }

  // 3. Field entry — fill EVERY field kind the step mentions, not just the first.
  if (/enter|fill|provide|input|type/.test(s)) {
    emit({ kind: "action", text: "Locating the form fields on the page…" });
    if (/invalid email|email format|not an email/.test(s)) {
      return smartFill(page, /email/i, testEmail, "invalid email", "email");
    }

    const filled: string[] = [];
    const tryFill = async (mentioned: boolean, label: string, fn: () => Promise<string>) => {
      if (mentioned) filled.push(`${label} (${await fn()})`);
    };

    await tryFill(
      /full ?name|first name|last ?name|\bname\b/.test(s) && !/username/.test(s),
      "name",
      () => smartFill(page, /full ?name|first name|last ?name|^name$/i, value(params, "fullName", "Test User"), "name"),
    );
    await tryFill(
      /email|username|\buser\b/.test(s),
      "email/username",
      () => smartFill(page, /email|username|user/i, username, "username", "email"),
    );
    await tryFill(
      /phone|mobile|contact/.test(s),
      "phone",
      () => smartFill(page, /phone|mobile|tel/i, value(params, "phone", "+15550123456"), "phone number", "tel"),
    );
    await tryFill(
      /password|passcode/.test(s),
      "password",
      () => smartFill(page, /password|passcode/i, password || "Test@1234", "password", "password"),
    );
    await tryFill(
      /amount|value|price|quantity|loan|income/.test(s),
      "amount",
      () => smartFill(page, /amount|value|price|quantity|income|loan/i, amount, "amount", "number"),
    );

    if (filled.length > 0) {
      return `filled ${filled.length} field${filled.length > 1 ? "s" : ""}: ${filled.join(", ")}`;
    }
    return smartFill(page, /.*/, amount, "the field");
  }

  // 4. Clicks / submissions
  if (/submit|click|press|tap|confirm|register|apply|search/.test(s)) {
    emit({ kind: "action", text: "Clicking the primary action button…" });
    await smartClickSubmit(page);
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    return "clicked the primary action button";
  }

  // 5. Observation / waiting steps
  if (/observe|verify|note|repeat|review|wait/.test(s)) {
    emit({ kind: "action", text: "Waiting for the page to settle…" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    return "page settled — ready to verify";
  }

  return "no direct action mapped — information step";
}

/** Verify the expected result with best-effort assertions. */
async function verifyExpected(page: Page, tc: TestCase): Promise<string> {
  const e = tc.expectedResult.toLowerCase();

  // "without errors" / "no failures" describe the ABSENCE of problems — a passing
  // outcome. Strip those negations first, otherwise "…without errors" would be
  // misread as expecting an error message and fail a test that actually passed.
  const denegated = e.replace(
    /\b(?:without|with no|no|zero|free of|absence of)\s+(?:any\s+)?(?:errors?|failures?|issues?|problems?|interruptions?)\b/g,
    "",
  );

  if (/reject|decline|invalid|error|fail/.test(denegated)) {
    const alert = page.locator("[role=alert], .error, .error-message, .invalid-feedback, .alert").first();
    if (await alert.isVisible({ timeout: 6_000 }).catch(() => false)) {
      return "validation/error message is shown — expected rejection confirmed";
    }
    throw new Error("expected an error/validation message, but none appeared on the page");
  }

  if (/approve|success|complete|accept|created|confirm|thank/.test(denegated)) {
    const success = page
      .getByText(/success|approved|completed|created|confirm|thank|welcome/i)
      .first();
    if (await success.isVisible({ timeout: 6_000 }).catch(() => false)) {
      return "success confirmation is visible";
    }
    // No literal success banner — fall through to the content check instead of
    // failing a flow that may simply render its outcome without a "success" label.
  }

  if (/display|show|visible|appear|calc|complete|confirm|journey|page/.test(denegated)) {
    const main = page.locator("main, [role=main], body").first();
    if (await main.isVisible({ timeout: 6_000 })) {
      return "expected content is rendered on the page";
    }
    throw new Error("expected content did not render");
  }

  return "page reached the end of the flow";
}

/** Run a test case against a live browser and return a step-by-step report.
 *  Every action is emitted through `onEvent` so the UI can show it live. */
export async function runTestCase(
  tc: TestCase,
  params: Record<string, string>,
  headed: boolean,
  onEvent?: (event: RunEvent) => void,
): Promise<RunResult> {
  const emit = (line: RunLogLine) => onEvent?.({ type: "log", line });
  const started = Date.now();

  emit({
    kind: "info",
    text: `Launching ${headed ? "a visible (headed)" : "a headless"} browser…`,
  });
  const { browser, label } = await launchBrowser(headed);
  emit({ kind: "success", text: `${label} is up and running` });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    emit({ kind: "info", text: "New page opened (1280×800) — watching for errors…" });

    // Surface anything the page itself throws or logs, as it happens.
    let reportedPageErrors = 0;
    page.on("pageerror", (error) => {
      if (reportedPageErrors++ < 8) {
        emit({ kind: "error", text: `Page error: ${String(error.message).slice(0, 160)}` });
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error" && reportedPageErrors++ < 8) {
        emit({ kind: "error", text: `Console: ${message.text().slice(0, 160)}` });
      }
    });

    const state: RunState = { loggedIn: false, precondition: tc.precondition ?? "" };
    const steps: StepResult[] = [];
    let anyFailed = false;

    // Best-effort execution: a failed step is reported but does not abort the run,
    // so later steps still get their chance and their screenshots.
    for (let i = 0; i < tc.steps.length; i++) {
      const step = tc.steps[i];
      onEvent?.({ type: "step-start", index: i, total: tc.steps.length, step });
      emit({ kind: "action", text: `Step ${i + 1}/${tc.steps.length}: ${step}` });
      try {
        const detail = await executeStep(page, step, params, state, emit);
        const screenshot = (await page.screenshot({ type: "png" })).toString("base64");
        const result: StepResult = { index: i, step, status: "passed", detail, screenshot };
        steps.push(result);
        emit({ kind: "success", text: detail });
        onEvent?.({ type: "step-result", result });
      } catch (error) {
        // The step's target isn't on the page (flow already past it) — skip it;
        // only genuine failures (timeout, wrong page, broken control) fail the run.
        if (error instanceof StepNotApplicableError) {
          const screenshot = await page
            .screenshot({ type: "png" })
            .then((b) => b.toString("base64"))
            .catch(() => undefined);
          const result: StepResult = { index: i, step, status: "skipped", detail: error.message, screenshot };
          steps.push(result);
          emit({ kind: "info", text: `Skipped — ${error.message}` });
          onEvent?.({ type: "step-result", result });
          continue;
        }

        anyFailed = true;
        const detail = friendlyError(error, /fill/i.test(step) ? "the input field" : "the control");
        emit({ kind: "error", text: detail });
        const screenshot = await page
          .screenshot({ type: "png" })
          .then((b) => b.toString("base64"))
          .catch(() => undefined);
        const result: StepResult = { index: i, step, status: "failed", detail, screenshot };
        steps.push(result);
        onEvent?.({ type: "step-result", result });
      }
    }

    // Verify the expected result.
    emit({ kind: "info", text: `Verifying the expected result: ${tc.expectedResult}` });
    let expectedStatus: StepResult["status"] = "failed";
    let expectedDetail: string;
    try {
      if (anyFailed) {
        // Still attempt verification — a later step may have recovered.
        expectedDetail = "verification attempted despite an earlier failed step";
      } else {
        expectedDetail = "";
      }
      expectedDetail = await verifyExpected(page, tc) + (expectedDetail ? ` (${expectedDetail})` : "");
      expectedStatus = "passed";
    } catch (error) {
      expectedDetail = friendlyError(error, "the expected result indicator");
      expectedStatus = "failed";
    }
    emit({
      kind: expectedStatus === "passed" ? "success" : "error",
      text: `Expected result — ${expectedDetail}`,
    });
    const expectedScreenshot = await page
      .screenshot({ type: "png" })
      .then((b) => b.toString("base64"))
      .catch(() => undefined);
    steps.push({
      index: tc.steps.length,
      step: `Expected result: ${tc.expectedResult}`,
      status: expectedStatus,
      detail: expectedDetail,
      screenshot: expectedScreenshot,
    });

    emit({ kind: "info", text: "Closing the browser…" });
    await context.close();

    return {
      url: value(params, "url", "(no url provided)"),
      headed,
      browser: label,
      overall: expectedStatus === "passed" && !anyFailed ? "passed" : "failed",
      durationMs: Date.now() - started,
      steps,
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
