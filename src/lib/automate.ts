import type Anthropic from "@anthropic-ai/sdk";
import type { TestCase } from "./types";
import { claudeCredentialsPresent } from "./analyze";
import { getAIClient, AI_MODEL, aiEngineLabel } from "./model";

// ---------------------------------------------------------------------------
// Prerequisite detection — figures out what a test case needs before automation
// ---------------------------------------------------------------------------

export interface PrerequisiteField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  reason: string;
  defaultValue: string;
}

const FIELD_LABELS: Record<string, Omit<PrerequisiteField, "key">> = {
  url: {
    label: "Application URL",
    placeholder: "https://your-app.example.com",
    type: "url",
    reason: "Every automated run starts by opening your application — enter the real URL.",
    // Empty by design: the Run button stays disabled until a real URL is entered,
    // so no run can ever target a dead placeholder domain.
    defaultValue: "",
  },
  username: {
    label: "Login email / username",
    placeholder: "demo.user@testforge.ai",
    type: "text",
    reason: "This test case involves a logged-in user.",
    defaultValue: "demo.user@testforge.ai",
  },
  password: {
    label: "Login password",
    placeholder: "••••••••",
    type: "password",
    reason: "Credentials for the login step of this test case.",
    defaultValue: "",
  },
  amount: {
    label: "Sample amount / value",
    placeholder: "5000",
    type: "text",
    reason: "The flow submits a value the script needs to enter.",
    defaultValue: "5000",
  },
  testEmail: {
    label: "Invalid email (for negative testing)",
    placeholder: "not-an-email",
    type: "text",
    reason: "The script enters a deliberately invalid email to verify rejection.",
    defaultValue: "not-an-email@@invalid",
  },
  fileName: {
    label: "Path to a sample file",
    placeholder: "C:/samples/document.pdf",
    type: "text",
    reason: "The flow uploads a document from your machine.",
    defaultValue: "./sample.pdf",
  },
};

/** Auto-detect what inputs a test case needs to run automated. */
export function detectPrerequisites(tc: TestCase): PrerequisiteField[] {
  const haystack = [tc.title, tc.precondition, tc.expectedResult, ...tc.steps]
    .join(" ")
    .toLowerCase();

  const keys: string[] = ["url"];

  if (/login|log in|sign in|user account|credentials|register/.test(haystack)) {
    if (!keys.includes("username")) keys.push("username", "password");
  }
  if (/email|username/.test(haystack) && !keys.includes("username")) {
    keys.push("username");
  }
  if (/invalid email|invalid .*format|not an email/.test(haystack) && tc.type === "Negative") {
    keys.push("testEmail");
  }
  if (/amount|value|price|quantity|loan|deposit|payment/.test(haystack)) {
    keys.push("amount");
  }
  if (/upload|attach|document\b/.test(haystack)) {
    keys.push("fileName");
  }

  return keys.map((key) => ({ key, ...FIELD_LABELS[key] }));
}

// ---------------------------------------------------------------------------
// Built-in Playwright script synthesizer (no API key required)
// ---------------------------------------------------------------------------

function safe(value: string | undefined, fallback: string): string {
  return JSON.stringify((value && value.trim()) || fallback);
}

function sanitizeComment(text: string): string {
  return text.replace(/\*\//g, "*\u200B/").replace(/\n+/g, " ").trim();
}

/** Map one manual step to Playwright code. Best-effort heuristics. */
function stepToCode(step: string, index: number, hasLogin: boolean, params: Record<string, string>): string[] {
  const s = step.toLowerCase();
  const lines: string[] = [];
  const comment = `// Step ${index + 1} — ${sanitizeComment(step)}`;

  if (/navigate|access the application|open the app|go to/.test(s)) {
    lines.push(comment, "await page.goto(url);");
    if (hasLogin) {
      lines.push(
        "",
        "// Sign in",
        "await page.getByLabel(/email|username/i).first().fill(username);",
        "await page.getByLabel(/password/i).first().fill(password);",
        "await page.getByRole(\"button\", { name: /log ?in|sign ?in|submit/i }).first().click();",
        "await page.waitForLoadState(\"networkidle\");",
      );
    }
    return lines;
  }

  if (/upload|attach/.test(s)) {
    lines.push(comment, "await page.setInputFiles(\"input[type=file]\", fileName);");
    return lines;
  }

  if (/enter|fill|provide|input|type/.test(s)) {
    lines.push(comment);
    if (/invalid email|email format|not an email/.test(s)) {
      lines.push("await page.getByLabel(/email/i).first().fill(testEmail);");
    } else if (/password/.test(s)) {
      lines.push("await page.getByLabel(/password/i).first().fill(password);");
    } else if (/email|username/.test(s)) {
      lines.push("await page.getByLabel(/email|username/i).first().fill(username);");
    } else if (/amount|value|price|quantity|loan/.test(s)) {
      lines.push("await page.getByLabel(/amount|value|price|quantity/i).first().fill(amount);");
    } else {
      lines.push(
        "// TODO: point this selector at the field used in your app",
        "await page.locator(\"input:visible, textarea:visible\").first().fill(amount);",
      );
    }
    return lines;
  }

  if (/submit|click|press|tap|confirm/.test(s)) {
    lines.push(
      comment,
      "await page.getByRole(\"button\", { name: /submit|continue|next|confirm|save/i }).first().click();",
    );
    return lines;
  }

  if (/observe|verify|note|repeat/.test(s)) {
    lines.push(comment, "await page.waitForLoadState(\"networkidle\");");
    return lines;
  }

  // Unrecognized step — keep it visible in the script as a clear action comment.
  lines.push(comment, "// (map this action to your application's selectors)");
  return lines;
}

/** Map the expected result to a Playwright assertion. Best-effort. */
function expectedToAssertion(tc: TestCase): string[] {
  const e = tc.expectedResult.toLowerCase();
  if (/reject|invalid|error|fail|decline/.test(e)) {
    return [
      `// Expected — ${sanitizeComment(tc.expectedResult)}`,
      "await expect(page.locator(\"[role=alert], .error, .error-message\").first()).toBeVisible();",
    ];
  }
  if (/display|show|visible|appear/.test(e)) {
    return [
      `// Expected — ${sanitizeComment(tc.expectedResult)}`,
      "await expect(page.locator(\"main, [data-testid=content]\").first()).toBeVisible();",
      "// TODO: tighten this assertion to the exact message your app shows",
    ];
  }
  if (/approve|success|complete|accept/.test(e)) {
    return [
      `// Expected — ${sanitizeComment(tc.expectedResult)}`,
      "await expect(page.getByText(/success|approved|completed/i).first()).toBeVisible({ timeout: 15000 });",
    ];
  }
  return [
    `// Expected — ${sanitizeComment(tc.expectedResult)}`,
    "// TODO: assert the exact outcome your application produces",
    "await expect(page.locator(\"body\")).toBeVisible();",
  ];
}

function paramsBlock(keys: string[], params: Record<string, string>): string[] {
  const envNames: Record<string, string> = {
    url: "APP_URL",
    username: "APP_USERNAME",
    password: "APP_PASSWORD",
    amount: "APP_AMOUNT",
    testEmail: "APP_INVALID_EMAIL",
    fileName: "APP_SAMPLE_FILE",
  };
  // The form's url field is empty by default (so runs can't target a placeholder
  // domain) — generated scripts still get a concrete placeholder constant.
  const scriptFallbacks: Record<string, string> = { url: "https://app.example.com" };
  return keys.map((key) => {
    const fallback = safe(params[key], scriptFallbacks[key] ?? FIELD_LABELS[key].defaultValue);
    return `const ${key} = process.env.${envNames[key]} ?? ${fallback};`;
  });
}

export function builtinPlaywrightScript(
  tc: TestCase,
  params: Record<string, string>,
): string {
  const fields = detectPrerequisites(tc);
  const keys = fields.map((f) => f.key);
  const hasLogin = keys.includes("username") && keys.includes("password");

  const stepCode = tc.steps.flatMap((step, i) =>
    stepToCode(step, i, hasLogin, params),
  );

  const lines: string[] = [
    "import { test, expect } from \"@playwright/test\";",
    "",
    "/**",
    " * ─────────────────────────────────────────────────────────────",
    " *  TestForge AI — Automated Playwright Script",
    " *",
    ` *  Test Case  : ${sanitizeComment(tc.id)} — ${sanitizeComment(tc.title)}`,
    ` *  Module     : ${sanitizeComment(tc.module)}`,
    ` *  Priority   : ${tc.priority} • Type: ${tc.type}`,
    ` *  Covers     : ${sanitizeComment(tc.requirementId)}`,
    " *",
    " *  Run it:    npx playwright test --grep " + tc.id,
    " * ─────────────────────────────────────────────────────────────",
    " */",
    "",
    `test("${tc.id}: ${sanitizeComment(tc.title).replace(/"/g, "'")}", async ({ page }) => {`,
    "  test.setTimeout(60_000);",
    "",
    "  // ── Prerequisites (override via environment variables) ──",
    ...paramsBlock(keys, params).map((l) => `  ${l}`),
    "",
    ...stepCode.map((l) => (l ? `  ${l}` : "")),
    "",
    ...expectedToAssertion(tc).map((l) => `  ${l}`),
    "});",
    "",
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Claude AI path (used automatically when ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

export async function claudePlaywrightScript(
  tc: TestCase,
  params: Record<string, string>,
): Promise<string | null> {
  const client = await getAIClient();

  const system = [
    "You are a senior test automation engineer.",
    "Write a complete, runnable Playwright (TypeScript, @playwright/test) spec for the supplied manual test case.",
    "Respond with ONLY the TypeScript code — no markdown fences, no commentary.",
    "Requirements for the code:",
    "- One `test(...)` case, async ({ page }) =>, with a header comment block naming the test case id, title, module, priority and covered requirement.",
    "- Define every prerequisite as a `const` at the top with a process.env fallback (APP_URL, APP_USERNAME, ...) using the values the user supplied.",
    "- Include the login flow if credentials are among the prerequisites.",
    "- Translate each manual step into real Playwright commands with resilient selectors (getByLabel / getByRole / getByTestId over CSS).",
    "- End with an `await expect(...)` assertion that verifies the expected result.",
    "Accuracy rules — the script must run against a real app without edits:",
    "- Start with `await page.goto(url)` using the APP_URL constant; never hard-code a different origin.",
    "- Map EVERY manual step, in order, to a numbered comment `// Step N: <short step summary>` followed by its commands — no step skipped, none invented.",
    "- Prefer role-based and label-based locators (getByRole, getByLabel, getByPlaceholder, getByTestId); use resilient CSS only as a last resort. Never use brittle selectors like nth-child chains or generated class hashes.",
    "- Never use page.waitForTimeout(). Wait for concrete things: await expect(locator).toBeVisible(), toHaveURL, toHaveText, or page.waitForLoadState.",
    "- Assert only what the stated expected result claims — nothing stronger, nothing weaker.",
    "- The script must compile with strict TypeScript and pass `npx playwright test` as-is.",
  ].join(" ");

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // Deep reasoning for code generation — correctness matters more than latency here.
    output_config: { effort: "xhigh" },
    system,
    messages: [
      {
        role: "user",
        content: `Automate this test case.\n\n<test-case>\n${JSON.stringify(tc, null, 1)}\n</test-case>\n\n<prerequisites-provided-by-user>\n${JSON.stringify(params, null, 1)}\n</prerequisites>`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip markdown fences if the model added them anyway.
  const code = raw.replace(/^```(?:typescript|ts)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return code.includes("test(") ? code : null;
}

export interface AutomationResult {
  engine: "claude" | "builtin";
  /** Display name for UI badges — reflects the configured model (e.g. "GLM AI"). */
  engineLabel: string;
  script: string;
}

export async function generatePlaywrightScript(
  tc: TestCase,
  params: Record<string, string>,
): Promise<AutomationResult> {
  if (claudeCredentialsPresent()) {
    try {
      const script = await claudePlaywrightScript(tc, params);
      if (script) return { engine: "claude", engineLabel: aiEngineLabel(), script };
    } catch (error) {
      console.error("[automate] AI script generation failed, using built-in engine:", error);
    }
  }
  return { engine: "builtin", engineLabel: "Built-in Rule Engine", script: builtinPlaywrightScript(tc, params) };
}
