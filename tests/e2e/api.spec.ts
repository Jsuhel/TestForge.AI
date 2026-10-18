import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Real API contract tests — no mocks. These exercise the actual AI pipeline
 * (analyze → generate-tests → automate → chat) and the run endpoint's
 * validation + streaming behaviour against a live server.
 */

const FSD_FILE = path.join(__dirname, "fixtures", "sample-fsd.txt");

/** A minimal analysis payload the generate/automate/chat endpoints accept. */
const MINIMAL_ANALYSIS = {
  documentName: "sample-fsd.txt",
  engine: "builtin",
  documentType: "Functional Specification Document",
  summary: "Login module rules.",
  modules: ["Authentication"],
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
  ],
  userJourneys: [{ name: "Login", steps: ["Open login page", "Enter credentials"] }],
  stats: { pages: 1, words: 50, requirementCount: 2, moduleCount: 1, journeyCount: 1 },
};

const MINIMAL_TC = {
  id: "API_TS_01",
  title: "Verify by opening the application and observing the landing page.",
  summary: "nav smoke",
  module: "Auth",
  type: "Positive",
  priority: "High",
  precondition: "none",
  steps: ["Navigate to the application"],
  expectedResult: "System should display the page.",
  requirementId: "FR-001",
};

async function postJson(request: APIRequestContext, url: string, body: unknown) {
  return request.post(url, {
    headers: { "Content-Type": "application/json" },
    data: body,
  });
}

test.describe("/api/analyze", () => {
  test("rejects a request without a file", async ({ request }) => {
    const res = await request.post("/api/analyze", { multipart: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json().catch(() => null);
    expect(body?.error).toBeTruthy();
  });

  test("analyzes a real FSD and honours the response contract", async ({ request }) => {
    test.setTimeout(300_000);
    const buffer = await readFile(FSD_FILE);
    const res = await request.post("/api/analyze", {
      multipart: {
        file: { name: "sample-fsd.txt", mimeType: "text/plain", buffer },
      },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.documentName).toBeTruthy();
    expect(Array.isArray(body.modules)).toBe(true);
    expect(Array.isArray(body.requirements)).toBe(true);
    expect(body.requirements.length).toBeGreaterThan(0);
    expect(body.stats.requirementCount).toBeGreaterThan(0);
    // Requirement identifiers the rest of the pipeline depends on.
    for (const req of body.requirements) {
      expect(typeof req.id).toBe("string");
      expect(typeof req.text).toBe("string");
    }
  });
});

test.describe("/api/generate-tests", () => {
  test("rejects an invalid body", async ({ request }) => {
    const res = await postJson(request, "/api/generate-tests", { nonsense: true });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("generates a suite in the Verify by / System should convention", async ({ request }) => {
    test.setTimeout(420_000);
    const res = await postJson(request, "/api/generate-tests", { analysis: MINIMAL_ANALYSIS });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.testCases)).toBe(true);
    expect(body.testCases.length).toBeGreaterThan(0);
    expect(body.engineLabel).toBeTruthy();

    for (const tc of body.testCases) {
      expect(Array.isArray(tc.steps)).toBe(true);
      expect(tc.steps.length).toBeGreaterThan(0);
      expect(tc.requirementId).toBeTruthy();
    }
    // The first scenario is the end-to-end smoke flow.
    expect(String(body.testCases[0].title).toLowerCase()).toMatch(
      /verify by|end-to-end|journey|complete/,
    );
  });
});

test.describe("/api/automate", () => {
  test("rejects a body without a test case", async ({ request }) => {
    const res = await postJson(request, "/api/automate", { params: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("produces a runnable Playwright script", async ({ request }) => {
    test.setTimeout(360_000);
    const res = await postJson(request, "/api/automate", {
      testCase: MINIMAL_TC,
      params: { url: "https://example.com" },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.engineLabel).toBeTruthy();
    expect(String(body.script)).toContain("test(");
    expect(String(body.script)).toContain("page.goto");
  });
});

test.describe("/api/chat", () => {
  test("rejects an invalid body", async ({ request }) => {
    const res = await postJson(request, "/api/chat", { question: "" });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("answers a question grounded in the analysis", async ({ request }) => {
    test.setTimeout(300_000);
    const res = await postJson(request, "/api/chat", {
      analysis: MINIMAL_ANALYSIS,
      messages: [],
      question: "Which module does this FSD cover?",
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
  });
});

test.describe("/api/run", () => {
  test("rejects a run without a valid URL", async ({ request }) => {
    const res = await postJson(request, "/api/run", {
      testCase: MINIMAL_TC,
      params: { url: "not-a-url" },
      headed: false,
    });
    expect(res.status()).toBe(400);
    const body = await res.json().catch(() => null);
    expect(body?.error).toMatch(/URL/i);
  });

  test("rejects a run without a test case", async ({ request }) => {
    const res = await postJson(request, "/api/run", {
      params: { url: "https://example.com" },
      headed: false,
    });
    expect(res.status()).toBe(400);
  });

  test("executes a one-step case and streams NDJSON to done", async ({ request }) => {
    test.setTimeout(360_000);
    const res = await postJson(request, "/api/run", {
      testCase: MINIMAL_TC,
      params: { url: "https://example.com" },
      headed: false,
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("x-ndjson");

    const text = await res.text();
    const events = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    const types = events.map((e) => e.type);
    expect(types).toContain("log");
    expect(types).toContain("done");

    const done = events.find((e) => e.type === "done");
    expect(done.result.overall).toBe("passed");
    expect(done.result.steps.length).toBeGreaterThan(0);
    expect(done.result.steps[0].status).toBe("passed");
    expect(done.result.steps[0].screenshot).toBeTruthy();
  });
});
