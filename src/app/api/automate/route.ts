import { generatePlaywrightScript } from "@/lib/automate";
import type { TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      testCase?: TestCase;
      params?: Record<string, string>;
    };
    const tc = body?.testCase;

    if (
      !tc ||
      typeof tc !== "object" ||
      typeof tc.id !== "string" ||
      !Array.isArray(tc.steps) ||
      !tc.steps.length
    ) {
      return Response.json(
        { error: "Invalid request: a test case with steps is required." },
        { status: 400 },
      );
    }

    const cleanParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(body.params ?? {})) {
      if (typeof value === "string" && value.length <= 500) {
        cleanParams[key] = value;
      }
    }

    const result = await generatePlaywrightScript(tc, cleanParams);
    return Response.json(result);
  } catch (error) {
    console.error("[api/automate] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate the Playwright script.";
    return Response.json({ error: message }, { status: 500 });
  }
}
