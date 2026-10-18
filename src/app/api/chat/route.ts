import { executeAICall } from "@/lib/model";
import type { RequirementAnalysis } from "@/lib/types";

export const runtime = "nodejs";
// GLM answers usually land in 5-20s, but leave headroom for long FSDs.
export const maxDuration = 300;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 10; // last N turns sent along so the AI keeps context
const MAX_QUESTION_CHARS = 2000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      analysis?: RequirementAnalysis;
      messages?: ChatMessage[];
      question?: string;
    };

    const analysis = body?.analysis;
    const question = (body?.question ?? "").trim();

    if (
      !analysis ||
      typeof analysis !== "object" ||
      typeof analysis.documentName !== "string" ||
      !Array.isArray(analysis.requirements)
    ) {
      return Response.json(
        { error: "Invalid request: a prior requirement analysis is required." },
        { status: 400 },
      );
    }

    if (!question) {
      return Response.json({ error: "Please type a question first." }, { status: 400 });
    }

    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (m): m is ChatMessage =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-MAX_HISTORY)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim().slice(0, MAX_QUESTION_CHARS)}`)
      .join("\n\n");

    const system = [
      "You are TestForge AI — a senior QA business analyst chatting with a stakeholder about their Functional Requirements Document (FSD).",
      "The user already uploaded and analyzed the document; your job is to explain it, clarify doubts and answer questions strictly based on the analysis below.",
      "",
      "Rules:",
      "- Ground every answer in the supplied analysis. When you reference a requirement, cite its id like (FR-003).",
      "- If something is NOT covered by the document, say so plainly instead of inventing details.",
      "- Be clear and structured: short paragraphs, ### headings for topics, • bullets for lists, **bold** for key terms.",
      "- Keep answers focused and practical — the user is preparing to test this system.",
      "",
      "<analysis>",
      JSON.stringify(
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
      ),
      "</analysis>",
    ].join("\n");

    const userPrompt = history
      ? `Conversation so far:\n${history}\n\nUser's new question:\n${question.slice(0, MAX_QUESTION_CHARS)}`
      : question.slice(0, MAX_QUESTION_CHARS);

    const aiOutput = await executeAICall({
      system,
      userPrompt,
      maxTokens: 4000,
    });

    if (!aiOutput?.text) {
      return Response.json(
        {
          error:
            "No AI engine is configured. Add ANTHROPIC_AUTH_TOKEN (GLM) or OPENROUTER_API_KEY to enable the FSD chat.",
        },
        { status: 503 },
      );
    }

    return Response.json({ answer: aiOutput.text, engineLabel: aiOutput.engineLabel });
  } catch (error) {
    console.error("[api/chat] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to answer the question.";
    return Response.json({ error: message }, { status: 500 });
  }
}
