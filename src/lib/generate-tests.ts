import { claudeCredentialsPresent } from "./analyze";
import { executeAICall, aiEngineLabel } from "./model";
import type { ExtractedRequirement, RequirementAnalysis, TestCase } from "./types";

// ---------------------------------------------------------------------------
// Built-in rule-based generator (works offline, no API key required)
// ---------------------------------------------------------------------------

const INPUT_HINTS =
  /\b(form|field|input|enter|submit|upload|register|login|log in|sign[- ]?up|password|email|amount|date|search|select|provide|attach)\b/i;
const NUMERIC_HINTS =
  /\b(\d+|minimum|maximum|limit|range|at least|at most|up to|more than|less than|between|length|count|days|amount|percentage|%)\b/i;

function stripModal(text: string): string {
  return text
    .replace(/^the (?:system|application|platform|user|solution)\s+(?:shall|must|should|will|can|is required to|needs to)\s+/i, "")
    .replace(/^(?:the )?(?:system|application|platform|solution)\s+/i, "")
    .trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function cleanStepText(step: string): string {
  // Strip redundant leading numbers like "1. ", "2) " if already present in string
  return step.replace(/^\d+[\s.)-]+\s*/, "").trim();
}

function makeTestCase(
  req: ExtractedRequirement,
  index: number,
  type: TestCase["type"],
  title: string,
  steps: string[],
  expectedResult: string,
  customPrecondition?: string,
  summary?: string,
): TestCase {
  const cleaned = steps.map(cleanStepText).filter(Boolean);

  return {
    id: `TC-${String(index + 1).padStart(3, "0")}`,
    title: truncate(title, 500),
    summary: truncate(summary ?? title, 100),
    module: req.module,
    type,
    priority: req.priority,
    precondition: customPrecondition || `The "${req.module}" module is accessible and configured in the test environment.`,
    steps: cleaned.length ? cleaned : ["Open the application.", "Execute the specified flow.", "Verify the result."],
    expectedResult,
    requirementId: req.id,
  };
}

function builtinGenerate(analysis: RequirementAnalysis): TestCase[] {
  const cases: TestCase[] = [];
  const requirements = analysis.requirements;
  const docName = analysis.documentName.replace(/\.[^/.]+$/, "");

  // -------------------------------------------------------------------------
  // MANDATORY TC-001: Complete End-to-End (E2E) Journey
  // -------------------------------------------------------------------------
  const primaryJourney = analysis.userJourneys[0];
  const e2eSteps: string[] = [
    "Open a supported web browser.",
    `Navigate to the ${docName} application URL.`,
    "Wait until the initial home/landing page finishes loading completely.",
  ];

  if (primaryJourney && primaryJourney.steps.length > 0) {
    primaryJourney.steps.forEach((step) => {
      e2eSteps.push(`Perform step: ${cleanStepText(step)}`);
      e2eSteps.push("Wait for the application to update and confirm the state.");
    });
  } else if (requirements.length > 0) {
    // Chain key requirement flows together into an end-to-end user path
    const sampleReqs = requirements.slice(0, 4);
    sampleReqs.forEach((r) => {
      e2eSteps.push(`Navigate to the ${r.module} module and initiate flow.`);
      e2eSteps.push(`Execute action: ${truncate(stripModal(r.text), 90)}`);
      e2eSteps.push("Wait for confirmation and proceed to the next stage.");
    });
  } else {
    e2eSteps.push("Locate the main action area.");
    e2eSteps.push("Enter the required input data.");
    e2eSteps.push("Submit the transaction/form.");
  }

  e2eSteps.push("Review the final confirmation/summary screen.");
  e2eSteps.push("Verify that the complete end-to-end journey completes successfully without application error.");

  const e2eReq = requirements[0] || {
    id: "E2E-001",
    module: "End-to-End",
    text: `Complete user journey for ${docName}`,
    type: "functional" as const,
    priority: "High" as const,
  };

  cases.push(
    makeTestCase(
      { ...e2eReq, module: "End-to-End", priority: "High" },
      0,
      "Positive",
      `Verify by executing the complete end-to-end business flow for ${primaryJourney?.name || docName} from the starting point to the final expected outcome.`,
      e2eSteps,
      `System should allow the user to complete the entire business flow from start to finish and view the final confirmation without errors.`,
      "Browser is open, user has appropriate permissions, and the system is in ready state.",
      `Smoke — end-to-end journey: ${primaryJourney?.name || docName}`,
    ),
  );

  // -------------------------------------------------------------------------
  // TC-002 Onward: Modular, Step-by-Step Automatable Test Cases
  // -------------------------------------------------------------------------
  const push = (
    req: ExtractedRequirement,
    type: TestCase["type"],
    title: string,
    steps: string[],
    expectedResult: string,
  ) => {
    if (cases.length < 90) {
      cases.push(makeTestCase(req, cases.length, type, title, steps, expectedResult));
    }
  };

  for (const req of requirements) {
    const clause = stripModal(req.text);

    // 1. Positive case — concrete automatable UI steps
    push(
      req,
      "Positive",
      `Verify by accessing ${req.module} and completing ${truncate(clause, 60)}`,
      [
        `Open the application in a supported web browser.`,
        `Navigate to the ${req.module} section.`,
        `Wait for the ${req.module} interface to load.`,
        `Locate the required interactive elements for this flow.`,
        `Execute the valid action: ${truncate(clause, 110)}`,
        `Submit or trigger the operation.`,
        `Wait for the target response or confirmation.`,
      ],
      `System should complete the operation as specified in ${req.id}: ${truncate(req.text, 160)}`,
    );

    // 2. Negative case — invalid input is rejected gracefully
    if (INPUT_HINTS.test(req.text)) {
      push(
        req,
        "Negative",
        `Verify by entering invalid data in ${req.module} and attempting to proceed`,
        [
          `Open the application and navigate to the ${req.module} section.`,
          `Locate the input fields for: ${truncate(clause, 70)}`,
          `Enter deliberately invalid or malformed data.`,
          `Attempt to submit or proceed past the input stage.`,
          `Observe the validation response and error notifications.`,
        ],
        "System should reject the invalid input with a clear error notification; invalid data is not accepted or processed.",
      );
    }

    // 3. Edge case — boundary limits
    if (NUMERIC_HINTS.test(req.text)) {
      push(
        req,
        "Edge Case",
        `Verify by submitting boundary values for the ${req.module} limits`,
        [
          `Open the application and navigate to ${req.module}.`,
          `Locate the threshold/limit field related to: ${truncate(clause, 70)}`,
          `Enter the exact minimum and maximum boundary values.`,
          `Submit each boundary value and record the response.`,
          `Enter a value just beyond the boundary threshold and attempt submission.`,
        ],
        "System should accept valid boundary values and reject values exceeding or below the allowed thresholds with informative error messages.",
      );
    }
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Claude AI generator (used automatically when ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

interface ClaudeTestCaseOutput {
  testCases: Array<{
    scenarioId: string;
    summary: string;
    module: string;
    type: string;
    priority: string;
    precondition: string;
    steps: string[];
    scenario: string;
    expectedResult: string;
    requirementId: string;
    clarificationNote?: string;
  }>;
}

export async function claudeGenerate(
  analysis: RequirementAnalysis,
): Promise<{ testCases: TestCase[]; engineLabel: string } | null> {
  const system = [
    "Act as a Senior QA Engineer and Business Analyst with strong experience in functional testing, banking/fintech applications, requirement analysis, and Excel-based test scenario preparation.",
    "",
    "You will receive a structured analysis of an uploaded FSD (Functional Specification Document) — the primary source for understanding the business requirements and application flow. Your task is to thoroughly analyse the ENTIRE FSD content and produce accurate, meaningful, non-duplicate test scenarios based on the actual business requirements.",
    "",
    "## 1. Analyse the complete FSD first",
    "- Consider the introduction, scope, objectives, preconditions, configuration parameters, screen details, field behaviour, validations, process flows, business rules, API integrations, decision logic, exception handling, and existing-versus-new application behaviour.",
    "- Understand the complete end-to-end business flow and the order in which the user and system perform each activity.",
    "- Identify actors, screens, inputs, outputs, dependencies, mandatory conditions, decision points, and expected business outcomes.",
    "- Identify existing functionality, new functionality, and functionality that must remain unchanged.",
    "- Do NOT start generating scenarios after considering only the introduction or a few sections.",
    "- Do NOT invent requirements or assume business rules that are not documented in the FSD.",
    "",
    "## 2. Start with full end-to-end smoke test scenarios",
    "- The FIRST scenarios MUST be smoke tests covering the complete FSD business flow, starting from the actual beginning of the process and following the same sequence as the FSD (initial application/configuration conditions, starting point of the main business process, primary end-to-end successful flow, next major/alternate flows, important business decision points, final expected business outcome).",
    "- Derive the actual smoke scenarios from the FSD — the ordering above is guidance, not fixed scenarios.",
    "- Smoke scenarios must validate meaningful business functionality. Do NOT fill the beginning with trivial field checks, isolated negative tests, or repeated variations of the same scenario.",
    "- After the smoke scenarios, add detailed functional scenarios in the same logical sequence as the FSD.",
    "",
    "## 3. Exact scenario-writing style",
    "- Every test scenario MUST begin with \"Verify by…\" and describe a specific user action, business condition, or process.",
    "- Every expected test result MUST begin with \"System should…\" and describe the exact expected behaviour.",
    "- Write complete, clear, professional sentences; mention the relevant screen, tab, field, parameter, status, or business condition wherever applicable.",
    "- Describe the action specifically enough that a tester can execute it; state the expected result as actual system behaviour or business outcome.",
    "- Use the exact terminology from the FSD. Avoid vague wording such as \"Verify functionality works correctly\". Do not write generic filler scenarios, repeat the same scenario with slightly different wording, or make an expected result more specific than the FSD supports.",
    "",
    "## 4. Business-critical and out-of-the-box coverage",
    "Include relevant scenarios (only where the FSD supports them — do not force every category into every FSD) for:",
    "- Complete end-to-end business processing; mandatory conditions and business-rule enforcement.",
    "- Conditional field visibility, editability, and validation; correct handling of configuration parameters.",
    "- Data consistency between screens, records, and integrated systems; incorrect, missing, stale, or mismatched data.",
    "- Duplicate submissions or repeated actions where they could affect processing.",
    "- API success, failure, timeout, or incomplete responses where the FSD defines the integration; retries, partial failures, process sequencing.",
    "- Boundary values and threshold-based decisions explicitly defined in the FSD.",
    "- Correct customer/applicant/account/transaction/record mapping where applicable.",
    "- Existing functionality that must not be impacted by the change; different application statuses, user roles, and supported business paths.",
    "- Incorrect progression, incorrect rejection, data loss, duplicate records, and other meaningful business risks.",
    "",
    "## 5. Eliminate duplicates and weak scenarios",
    "- Review every scenario against every other scenario before finalising: remove exact duplicates and scenarios that test the same behaviour.",
    "- Combine scenarios when their business purpose and expected result are effectively identical; keep separate scenarios only when they validate a genuinely different rule, outcome, integration, or risk.",
    "- Do not create extra scenarios merely to increase the count; do not add speculative scenarios as though they were confirmed requirements.",
    "- Prioritise quality, requirement coverage, and business value over quantity.",
    "",
    "## 6. Identifiers",
    "- Use the requirement/project identifier stated in the FSD to create sequential scenario IDs: [ProjectID]_TS_01, [ProjectID]_TS_02, … (e.g. LOAN_TS_01).",
    "- Do not invent a project ID: if the FSD does not clearly specify one, use the document name as the identifier and set clarificationNote on the first scenario flagging that the project ID needs confirmation.",
    "- Use the relevant FSD requirement identifier for requirementId whenever available.",
    "",
    "## 7. Handle missing or conflicting requirements correctly",
    "- If the FSD contains conflicting business rules, do not choose one arbitrarily — set clarificationNote describing the conflict.",
    "- If a rule is unclear, do not present an assumed result as confirmed expected behaviour — flag it via clarificationNote as requiring business confirmation.",
    "- Risk-based inferences (rather than explicit requirements) must also be flagged via clarificationNote. Never silently correct, reinterpret, or replace the FSD's stated behaviour.",
    "",
    "## 8. Final quality review before responding",
    "- The complete FSD was considered; the first scenarios cover the main end-to-end smoke flow in the correct sequence; detailed scenarios follow the business process logically.",
    "- Every scenario starts with \"Verify by…\" and every expected result starts with \"System should…\"; expected results match the relevant FSD requirement.",
    "- No duplicate or weak scenarios remain; meaningful business risks and applicable out-of-the-box conditions are covered; scenario IDs are sequential and unique; ambiguities are clearly flagged.",
    "",
    "RESPONSE FORMAT:",
    "The Excel workbook is assembled by the application, so respond with ONLY a single valid JSON object — no markdown fences, no commentary — matching this exact schema:",
    '{"testCases": [{"scenarioId": string (e.g. "PRJ_TS_01"), "summary": string (short meaningful title), "module": string, "type": "Positive" | "Negative" | "Edge Case", "priority": "High" | "Medium" | "Low", "precondition": string (setup, configuration, status, test data), "steps": string[] (clear executable steps in order), "scenario": string (starts with "Verify by…"), "expectedResult": string (starts with "System should…"), "requirementId": string, "clarificationNote": string (optional — FSD ambiguity/conflict flag)}]}',
    "Return ALL scenarios in one response.",
  ].join("\n");

  const userPrompt = `Generate the professional test-scenario suite for this requirement analysis, following every rule in the system prompt: smoke scenarios first in FSD business order, then detailed functional scenarios, "Verify by…" / "System should…" phrasing, no duplicates, ambiguities flagged.\n\n<analysis>\n${JSON.stringify(
    {
      documentName: analysis.documentName,
      documentType: analysis.documentType,
      summary: analysis.summary,
      modules: analysis.modules,
      requirements: analysis.requirements,
      userJourneys: analysis.userJourneys,
    },
    null,
    1,
  )}\n</analysis>`;

  const aiOutput = await executeAICall({
    system,
    userPrompt,
    maxTokens: 16000,
  });

  if (!aiOutput?.text) return null;

  const start = aiOutput.text.indexOf("{");
  const end = aiOutput.text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let parsed: ClaudeTestCaseOutput;
  try {
    parsed = JSON.parse(aiOutput.text.slice(start, end + 1)) as ClaudeTestCaseOutput;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) return null;

  const testCases: TestCase[] = parsed.testCases.slice(0, 90).map((tc, i) => {
    // Preserve all steps generated by the AI (clean leading numbers if any)
    const rawSteps = Array.isArray(tc.steps) ? tc.steps.map(String).filter(Boolean) : [];
    const steps = rawSteps.map(cleanStepText).filter(Boolean);

    if (steps.length === 0) {
      steps.push("Open the application.", "Execute the specified flow.", "Verify the result.");
    }

    const scenario = String(tc.scenario ?? tc.summary ?? "").trim();
    const clarification = String(tc.clarificationNote ?? "").trim();

    return {
      id: String(tc.scenarioId ?? "").trim() || `TC-${String(i + 1).padStart(3, "0")}`,
      title: truncate(scenario || `Verify by executing scenario ${i + 1} from the FSD.`, 500),
      summary: truncate(String(tc.summary ?? "").trim() || scenario, 100),
      module: String(tc.module ?? "General").trim() || "General",
      type: (["Positive", "Negative", "Edge Case"].includes(tc.type) ? tc.type : "Positive") as TestCase["type"],
      priority: (["High", "Medium", "Low"].includes(tc.priority) ? tc.priority : "Medium") as TestCase["priority"],
      precondition: String(tc.precondition ?? "").trim() || "System is online and test data is available.",
      steps,
      expectedResult: String(tc.expectedResult ?? "").trim(),
      requirementId: String(tc.requirementId ?? (i === 0 ? "SMOKE-001" : `REQ-${String(i).padStart(3, "0")}`)).trim(),
      clarificationNote: clarification || undefined,
    };
  });

  return { testCases, engineLabel: aiOutput.engineLabel };
}

export interface GeneratedSuite {
  engine: "claude" | "builtin";
  /** Display name for UI badges — reflects the configured model (e.g. "GLM AI" or "OpenRouter AI"). */
  engineLabel: string;
  testCases: TestCase[];
}

/**
 * Generate a test suite: the configured AI engine when credentials exist,
 * built-in rules otherwise.
 */
export async function generateTestSuite(analysis: RequirementAnalysis): Promise<GeneratedSuite> {
  if (claudeCredentialsPresent()) {
    try {
      const result = await claudeGenerate(analysis);
      if (result && result.testCases.length) {
        return { engine: "claude", engineLabel: result.engineLabel, testCases: result.testCases };
      }
    } catch (error) {
      console.error("[generate-tests] AI generation failed, falling back to built-in engine:", error);
    }
  }
  return { engine: "builtin", engineLabel: "Built-in Rule Engine", testCases: builtinGenerate(analysis) };
}
