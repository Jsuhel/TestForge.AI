import { generateTestSuite } from "@/lib/generate-tests";
import type { RequirementAnalysis } from "@/lib/types";

export const runtime = "nodejs";
// Full-suite generation with a large model takes 2-3 minutes — 60s gets the
// function killed mid-generation (observed 135s for a 25-case suite).
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { analysis?: RequirementAnalysis };
    const analysis = body?.analysis;

    if (
      !analysis ||
      typeof analysis !== "object" ||
      !Array.isArray(analysis.requirements) ||
      typeof analysis.documentName !== "string"
    ) {
      return Response.json(
        { error: "Invalid request: a prior requirement analysis is required." },
        { status: 400 },
      );
    }

    const suite = await generateTestSuite(analysis);
    return Response.json(suite);
  } catch (error) {
    console.error("[api/generate-tests] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate test cases.";
    return Response.json({ error: message }, { status: 500 });
  }
}
