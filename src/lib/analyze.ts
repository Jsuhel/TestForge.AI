import type Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./model";
import type {
  ExtractedRequirement,
  Priority,
  RequirementAnalysis,
  RequirementType,
} from "./types";

// ---------------------------------------------------------------------------
// Built-in rule-based analyzer (works offline, no API key required)
// ---------------------------------------------------------------------------

const REQUIREMENT_PATTERN =
  /\b(shall|must|should|needs? to|required to|will (?:support|allow|provide|enable|display|validate|send|generate|maintain|process)|allows? the user|enables? the|the (?:user|system|application) (?:can|will)|users? (?:can|shall|must))\b/i;

const VALIDATION_HINTS =
  /\b(valid\w*|invalid|format|mask|regex|must contain|mandatory|required field|field length|input check|email|phone number|date of birth|ssn)\b/i;
const BUSINESS_RULE_HINTS =
  /\b(business rule|limit|threshold|exceed|cap(?:ped)?|minimum|maximum|at least|at most|up to|range|eligib\w+|criteria|policy|score|fee|rate|amount)\b/i;
const NON_FUNCTIONAL_HINTS =
  /\b(performance|latency|response time|uptime|availability|scalab\w+|security|encrypt\w*|ssl|tls|audit|concurrent users?|within \d+ (?:ms|seconds?)|sla|compliance|gdpr|pci)\b/i;

const MUST_PATTERN = /\b(must|shall)\b/i;

function splitSentences(block: string): string[] {
  return block
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
}

function classifyRequirement(sentence: string): RequirementType {
  if (NON_FUNCTIONAL_HINTS.test(sentence)) return "non-functional";
  if (VALIDATION_HINTS.test(sentence)) return "validation";
  if (BUSINESS_RULE_HINTS.test(sentence)) return "business-rule";
  return "functional";
}

function classifyPriority(sentence: string): Priority {
  if (MUST_PATTERN.test(sentence)) return "High";
  if (/\bshould\b/i.test(sentence)) return "Medium";
  if (/\b(may|could|optionally)\b/i.test(sentence)) return "Low";
  return "Medium";
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  // Numbered headings like "3.2 Loan Processing" or "4) Security Requirements"
  if (/^\d+(\.\d+)*[.)]?\s+[A-Z]/.test(trimmed)) return true;
  // Short lines, no terminal punctuation, mostly title-case or ALL-CAPS
  if (/[.:;]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 10) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const caps = trimmed.replace(/[^A-Z]/g, "").length;
  const isAllCaps = caps / letters.length > 0.7;
  const titleCased = words
    .filter((w) => /[A-Za-z]/.test(w))
    .every((w) => /^[A-Z]/.test(w));
  return isAllCaps || titleCased;
}

function guessDocumentType(text: string): string {
  const head = text.slice(0, 4000);
  if (/product requirement|prd\b/i.test(head)) return "Product Requirements Document (PRD)";
  if (/software requirement|srs\b/i.test(head)) return "Software Requirements Specification (SRS)";
  if (/functional spec|fsd\b/i.test(head)) return "Functional Specification Document (FSD)";
  return "Requirements Document";
}

const STOPWORD_MODULES = new Set([
  "introduction",
  "overview",
  "scope",
  "purpose",
  "definitions",
  "revision history",
  "appendix",
  "references",
  "table of contents",
]);

export function builtinAnalyze(
  text: string,
  documentName: string,
  pages: number,
): RequirementAnalysis {
  const lines = text.split(/\r?\n/);
  const modules: string[] = [];
  let currentModule = "General";
  const requirements: ExtractedRequirement[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isHeading(trimmed)) {
      const name = trimmed.replace(/^\d+(\.\d+)*[.)]?\s+/, "").trim();
      if (
        name &&
        !STOPWORD_MODULES.has(name.toLowerCase()) &&
        !REQUIREMENT_PATTERN.test(trimmed)
      ) {
        currentModule = name.replace(/\s+/g, " ");
        if (!modules.includes(currentModule)) modules.push(currentModule);
      }
      continue;
    }

    if (!REQUIREMENT_PATTERN.test(trimmed)) continue;

    for (const sentence of splitSentences(trimmed)) {
      if (!REQUIREMENT_PATTERN.test(sentence)) continue;
      requirements.push({
        id: `FR-${String(requirements.length + 1).padStart(3, "0")}`,
        text: sentence,
        module: currentModule,
        type: classifyRequirement(sentence),
        priority: classifyPriority(sentence),
      });
      if (requirements.length >= 60) break;
    }
    if (requirements.length >= 60) break;
  }

  // Group requirements into one user journey per module (primary flows).
  const userJourneys = (modules.length ? modules : ["General"]).map((module) => {
    const steps = requirements
      .filter((r) => r.module === module)
      .slice(0, 5)
      .map(
        (r) =>
          r.text.length > 110 ? `${r.text.slice(0, 107).trim()}...` : r.text,
      );
    return { name: module, steps };
  });

  const words = text.split(/\s+/).filter(Boolean).length;
  const documentType = guessDocumentType(text);
  const topModules = modules.slice(0, 4).join(", ");

  const summary =
    requirements.length > 0
      ? `Parsed as a ${documentType}. The built-in rule engine identified ${requirements.length} requirement statements across ${modules.length || 1} functional area${modules.length === 1 ? "" : "s"}${topModules ? ` (including ${topModules})` : ""}. ${requirements.filter((r) => r.priority === "High").length} requirements are hard constraints ("must"/"shall"), which will map to high-priority test cases.`
      : `Parsed as a ${documentType}, but no explicit requirement statements ("shall", "must", "should", ...) were detected. Test generation will fall back to a document-level smoke suite.`;

  return {
    documentName,
    engine: "builtin",
    documentType,
    summary,
    modules: modules.length ? modules : ["General"],
    requirements,
    userJourneys: userJourneys.filter((j) => j.steps.length > 0),
    stats: {
      pages,
      words,
      requirementCount: requirements.length,
      moduleCount: modules.length || 1,
      journeyCount: userJourneys.filter((j) => j.steps.length > 0).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Claude AI analyzer (used automatically when ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------

const MAX_DOC_CHARS = 120_000;

export function claudeCredentialsPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

interface ClaudeAnalyzeOutput {
  documentType: string;
  summary: string;
  modules: string[];
  requirements: Array<{
    text: string;
    module: string;
    type: string;
    priority: string;
  }>;
  userJourneys: Array<{ name: string; steps: string[] }>;
}

export async function claudeAnalyze(
  text: string,
  documentName: string,
  pages: number,
): Promise<RequirementAnalysis | null> {
  const client = await getAIClient();

  const docText = text.length > MAX_DOC_CHARS
    ? `${text.slice(0, MAX_DOC_CHARS)}\n\n[...document truncated for length...]`
    : text;

  const system = [
    "You are a senior QA business analyst.",
    "Analyze the supplied requirements document and respond with ONLY a single JSON object,",
    "no markdown fences, no commentary, matching exactly this shape:",
    '{"documentType": string, "summary": string (2-4 sentences explaining what the document is, its scope and the key functional areas), "modules": string[] (functional module names), "requirements": [{"text": string (one atomic requirement statement), "module": string, "type": "functional" | "validation" | "business-rule" | "non-functional", "priority": "High" | "Medium" | "Low"}], "userJourneys": [{"name": string, "steps": string[] (ordered user actions)}]}',
    "Extract every meaningful requirement (up to 40). Quote requirement text closely from the document.",
  ].join(" ");

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [
      {
        role: "user",
        content: `Analyze this document, uploaded as "${documentName}".\n\n<document>\n${docText}\n</document>`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = parseJsonLoose<ClaudeAnalyzeOutput>(raw);
  if (!parsed?.requirements?.length) return null;

  const words = text.split(/\s+/).filter(Boolean).length;
  const requirements: ExtractedRequirement[] = parsed.requirements.slice(0, 60).map((r, i) => ({
    id: `FR-${String(i + 1).padStart(3, "0")}`,
    text: String(r.text ?? "").trim(),
    module: String(r.module ?? "General").trim() || "General",
    type: (["functional", "validation", "business-rule", "non-functional"].includes(r.type)
      ? r.type
      : "functional") as RequirementType,
    priority: (["High", "Medium", "Low"].includes(r.priority) ? r.priority : "Medium") as Priority,
  }));

  const modules = parsed.modules?.length
    ? parsed.modules.map(String)
    : [...new Set(requirements.map((r) => r.module))];
  const userJourneys = (parsed.userJourneys ?? [])
    .filter((j) => j?.name && Array.isArray(j.steps) && j.steps.length)
    .slice(0, 12)
    .map((j) => ({ name: String(j.name), steps: j.steps.map(String).slice(0, 8) }));

  return {
    documentName,
    engine: "claude",
    documentType: parsed.documentType || guessDocumentType(text),
    summary: parsed.summary || "",
    modules,
    requirements,
    userJourneys,
    stats: {
      pages,
      words,
      requirementCount: requirements.length,
      moduleCount: modules.length,
      journeyCount: userJourneys.length,
    },
  };
}

function parseJsonLoose<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Analyze an extracted document: Claude when credentials exist, built-in rules otherwise.
 * Claude failures silently fall back to the built-in engine so the UI never dead-ends.
 */
export async function analyzeDocument(
  text: string,
  documentName: string,
  pages: number,
): Promise<RequirementAnalysis> {
  if (claudeCredentialsPresent()) {
    try {
      const result = await claudeAnalyze(text, documentName, pages);
      if (result) return result;
    } catch (error) {
      console.error("[analyze] Claude analysis failed, falling back to built-in engine:", error);
    }
  }
  return builtinAnalyze(text, documentName, pages);
}
