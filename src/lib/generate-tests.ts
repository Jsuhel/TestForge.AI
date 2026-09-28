import type Anthropic from "@anthropic-ai/sdk";
import { claudeCredentialsPresent } from "./analyze";
import { getAIClient, AI_MODEL, aiEngineLabel } from "./model";
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
): TestCase {
  const cleaned = steps.map(cleanStepText).filter(Boolean);

  return {
    id: `TC-${String(index + 1).padStart(3, "0")}`,
    title: truncate(title, 140),
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
      `Verify complete end-to-end journey for ${primaryJourney?.name || docName}`,
      e2eSteps,
      `System should allow the user to navigate through the entire workflow from start to finish and view confirmation without errors.`,
      "Browser is open, user has appropriate permissions, and the system is in ready state.",
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
      `The system successfully completes the operation as specified in ${req.id}: ${truncate(req.text, 160)}`,
    );

    // 2. Negative case — invalid input is rejected gracefully
    if (INPUT_HINTS.test(req.text)) {
      push(
        req,
        "Negative",
        `Verify input rejection with invalid data in ${req.module}`,
        [
          `Open the application and navigate to the ${req.module} section.`,
          `Locate the input fields for: ${truncate(clause, 70)}`,
          `Enter deliberately invalid or malformed data.`,
          `Attempt to submit or proceed past the input stage.`,
          `Observe the validation response and error notifications.`,
        ],
        "The system rejects the invalid input with a clear error notification; invalid data is not accepted or processed.",
      );
    }

    // 3. Edge case — boundary limits
    if (NUMERIC_HINTS.test(req.text)) {
      push(
        req,
        "Edge Case",
        `Verify boundary behavior for ${req.module} limits`,
        [
          `Open the application and navigate to ${req.module}.`,
          `Locate the threshold/limit field related to: ${truncate(clause, 70)}`,
          `Enter the exact minimum and maximum boundary values.`,
          `Submit each boundary value and record the response.`,
          `Enter a value just beyond the boundary threshold and attempt submission.`,
        ],
        "Valid boundary values are accepted, while values exceeding or below the allowed thresholds are rejected with informative error messages.",
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
    title: string;
    module: string;
    type: string;
    priority: string;
    precondition: string;
    steps: string[];
    expectedResult: string;
    requirementId: string;
  }>;
}

export async function claudeGenerate(analysis: RequirementAnalysis): Promise<TestCase[] | null> {
  const client = await getAIClient();

  const system = [
    "You are an elite QA automation and manual test design engineer.",
    "Your objective is to read the requirement analysis and generate a comprehensive, professional test suite.",
    "",
    "CRITICAL GENERATION RULES:",
    "1. FIRST TEST CASE (TC-001) MUST BE THE COMPLETE END-TO-END (E2E) USER JOURNEY:",
    "   - TC-001 must always test the entire end-to-end journey from start to finish across the whole application/feature.",
    "   - Steps for TC-001 must be granular, chronological, and exhaustive (typically 8 to 15 concrete actions: e.g. Open browser -> Navigate to URL -> Wait for page load -> Locate search/entry -> Fill data -> Submit -> Wait for results -> Select listing -> Verify detail page -> Complete final action -> Verify feedback/confirmation).",
    "   - Expected result must verify that the user can execute the entire complete journey without errors.",
    "",
    "2. SUBSEQUENT TEST CASES (TC-002 ONWARD) MUST BREAK DOWN INDIVIDUAL FUNCTIONAL & AUTOMATABLE FLOWS:",
    "   - Break down each functional requirement, module, input validation, and boundary into targeted, modular test cases.",
    "   - Every test case must have concrete, actionable UI steps (typically 4 to 8 clear steps).",
    "   - Cover Positive, Negative (invalid/malformed input rejection), and Edge Cases (boundary limits).",
    "",
    "3. ACTIONABLE & SPECIFIC STEPS ONLY:",
    "   - Never write vague or abstract steps like 'Observe response' or 'Perform flow'.",
    "   - Write explicit actions: 'Open browser', 'Navigate to X', 'Locate the Y field', 'Enter value Z', 'Click button W', 'Wait for page/modal to load', 'Verify text V is displayed'.",
    "   - This ensures the test cases are directly automatable via Playwright/Selenium without ambiguity.",
    "",
    "RESPONSE FORMAT:",
    "Respond with ONLY a single valid JSON object, no markdown code fences, no commentary, matching this exact schema:",
    '{"testCases": [{"title": string, "module": string, "type": "Positive" | "Negative" | "Edge Case", "priority": "High" | "Medium" | "Low", "precondition": string, "steps": string[] (array of strings for each numbered action), "expectedResult": string (specific, verifiable outcome), "requirementId": string}]}',
  ].join("\n");

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // Deep reasoning for test design — correctness matters more than latency here.
    output_config: { effort: "xhigh" },
    system,
    messages: [
      {
        role: "user",
        content: `Generate a complete, automatable test suite for this requirement analysis.\nEnsure TC-001 is the complete End-to-End journey with detailed sequential steps, followed by modular test cases.\n\n<analysis>\n${JSON.stringify(
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
        )}\n</analysis>`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let parsed: ClaudeTestCaseOutput;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as ClaudeTestCaseOutput;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) return null;

  return parsed.testCases.slice(0, 90).map((tc, i) => {
    // Preserve all steps generated by the AI (clean leading numbers if any)
    const rawSteps = Array.isArray(tc.steps) ? tc.steps.map(String).filter(Boolean) : [];
    const steps = rawSteps.map(cleanStepText).filter(Boolean);

    if (steps.length === 0) {
      steps.push("Open the application.", "Execute the specified flow.", "Verify the result.");
    }

    return {
      id: `TC-${String(i + 1).padStart(3, "0")}`,
      title: truncate(String(tc.title ?? "").trim() || `Test case ${i + 1}`, 140),
      module: String(tc.module ?? "General").trim() || "General",
      type: (["Positive", "Negative", "Edge Case"].includes(tc.type) ? tc.type : "Positive") as TestCase["type"],
      priority: (["High", "Medium", "Low"].includes(tc.priority) ? tc.priority : "Medium") as TestCase["priority"],
      precondition: String(tc.precondition ?? "").trim() || "System is online and test data is available.",
      steps,
      expectedResult: String(tc.expectedResult ?? "").trim(),
      requirementId: String(tc.requirementId ?? (i === 0 ? "E2E-001" : `FR-${String(i).padStart(3, "0")}`)).trim(),
    };
  });
}

export interface GeneratedSuite {
  engine: "claude" | "builtin";
  /** Display name for UI badges — reflects the configured model (e.g. "GLM AI"). */
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
      const cases = await claudeGenerate(analysis);
      if (cases && cases.length) return { engine: "claude", engineLabel: aiEngineLabel(), testCases: cases };
    } catch (error) {
      console.error("[generate-tests] AI generation failed, falling back to built-in engine:", error);
    }
  }
  return { engine: "builtin", engineLabel: "Built-in Rule Engine", testCases: builtinGenerate(analysis) };
}
