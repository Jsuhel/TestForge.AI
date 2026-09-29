import type Anthropic from "@anthropic-ai/sdk";

/**
 * Central AI configuration for every AI step in TestForge:
 * requirement analysis, test case generation, Playwright script
 * generation and the project chat.
 *
 * Resolution order:
 *   1. TESTFORGE_MODEL                — explicit override for this app
 *   2. ANTHROPIC_DEFAULT_OPUS_MODEL   — opus-tier mapping (e.g. glm-5.1 on Z.AI)
 *   3. "claude-opus-5"                — first-party Anthropic default
 */
export const AI_MODEL =
  process.env.TESTFORGE_MODEL ??
  process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ??
  "claude-opus-5";

/** OpenRouter default model — Gemini 3.8 Flash. */
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";

/** Human-readable engine name for UI badges ("GLM AI", "OpenRouter AI", "Claude AI"). */
export function aiEngineLabel(provider?: "glm" | "openrouter" | "claude"): string {
  if (provider === "openrouter") return "OpenRouter AI";
  if (provider === "glm") return "GLM AI";
  return AI_MODEL.toLowerCase().startsWith("glm") ? "GLM AI" : "Claude AI";
}

/** Check if any AI credential is present (GLM/Anthropic or OpenRouter). */
export function aiCredentialsPresent(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.OPENROUTER_API_KEY
  );
}

/**
 * Build an SDK client honoring the environment: ANTHROPIC_BASE_URL routes to
 * the Anthropic-compatible endpoint (Z.AI), ANTHROPIC_AUTH_TOKEN authenticates,
 * API_TIMEOUT_MS raises the per-request timeout.
 */
export async function getAIClient(): Promise<Anthropic> {
  const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
  const timeout = Number(process.env.API_TIMEOUT_MS) || undefined;
  return new AnthropicClient(timeout ? { timeout } : {});
}

interface OpenRouterQuotaInfo {
  remainingRatio: number; // 0.0 to 1.0 (e.g. 0.65 means 65% remaining)
  checkedAt: number;
}

let cachedQuotaInfo: OpenRouterQuotaInfo | null = null;
const QUOTA_CACHE_TTL_MS = 60_000; // Check auth key limits once per minute max

/**
 * Check remaining quota ratio on OpenRouter.
 * Returns a value between 0.0 and 1.0 (e.g. 0.68 = 68% remaining).
 */
async function getOpenRouterRemainingRatio(apiKey: string): Promise<number | null> {
  const now = Date.now();
  if (cachedQuotaInfo && now - cachedQuotaInfo.checkedAt < QUOTA_CACHE_TTL_MS) {
    return cachedQuotaInfo.remainingRatio;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;

    let ratio = 1.0;
    // Check credit limit if specified
    if (typeof data.limit === "number" && data.limit > 0 && typeof data.limit_remaining === "number") {
      ratio = Math.min(ratio, data.limit_remaining / data.limit);
    }
    // Check free model daily limit if active
    if (data.free_model_daily_requests?.limit > 0 && typeof data.free_model_daily_requests?.remaining === "number") {
      ratio = Math.min(ratio, data.free_model_daily_requests.remaining / data.free_model_daily_requests.limit);
    }

    cachedQuotaInfo = { remainingRatio: ratio, checkedAt: now };
    return ratio;
  } catch {
    return cachedQuotaInfo?.remainingRatio ?? null;
  }
}

/**
 * Call OpenRouter API as a fallback when GLM is unavailable.
 * Primary: google/gemini-3.8-flash
 * If limits reach less than 70% (or on rate-limit error): automatically switches to google/gemini-2.5-flash.
 */
async function callOpenRouter(
  system: string,
  userPrompt: string,
  maxTokens: number,
): Promise<{ text: string; model: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // Check remaining limit ratio
  const remainingRatio = await getOpenRouterRemainingRatio(apiKey);
  const isBelow70Percent = remainingRatio !== null && remainingRatio < 0.70;

  if (isBelow70Percent) {
    console.warn(
      `[OpenRouter] Remaining limit is at ${(remainingRatio * 100).toFixed(1)}% (< 70%). Switching to google/gemini-2.5-flash.`
    );
  }

  // Model prioritization:
  // If limit reaches < 70%, prioritize Gemini 2.5 Flash; otherwise use Gemini 3.8 Flash.
  const candidateModels = isBelow70Percent
    ? ["google/gemini-2.5-flash", "google/gemini-3.8-flash"]
    : [OPENROUTER_MODEL, "google/gemini-2.5-flash"];

  for (const model of candidateModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://testforge.ai",
          "X-Title": "TestForge AI",
        },
        body: JSON.stringify({
          model,
          max_tokens: Math.min(maxTokens, 8000), // Safe token allowance
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[OpenRouter] model ${model} failed (${response.status}):`, errText);
        // If 429 (rate-limit) or limit error, continue to 2.5 Flash
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return { text: content.trim(), model };
      }
    } catch (err) {
      console.warn(`[OpenRouter] error calling model ${model}:`, err);
    }
  }

  return null;
}

export interface AICallOutput {
  text: string;
  engine: "claude" | "builtin";
  engineLabel: string;
}

/**
 * Execute AI call with seamless failover:
 * 1. Primary: GLM / Z.AI / Anthropic endpoint.
 * 2. Backup: OpenRouter API if GLM fails or is not configured.
 * 3. Fallback: returns null so the caller uses the built-in rule engine.
 */
export async function executeAICall({
  system,
  userPrompt,
  maxTokens = 8000,
}: {
  system: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<AICallOutput | null> {
  // Step 1: Try Primary (GLM / Anthropic) if credentials exist
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (hasAnthropic) {
    try {
      const client = await getAIClient();
      const stream = client.messages.stream({
        model: AI_MODEL,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: userPrompt }],
      });

      const response = await stream.finalMessage();
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      if (text) {
        return {
          text,
          engine: "claude",
          engineLabel: aiEngineLabel(AI_MODEL.toLowerCase().startsWith("glm") ? "glm" : "claude"),
        };
      }
    } catch (error) {
      console.warn("[AI] Primary GLM/Anthropic call failed. Attempting OpenRouter backup...", error);
    }
  }

  // Step 2: Try Backup (OpenRouter) if OPENROUTER_API_KEY is present
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const orResult = await callOpenRouter(system, userPrompt, maxTokens);
      if (orResult && orResult.text) {
        console.log(`[AI] Served successfully via OpenRouter backup (${orResult.model})`);
        return {
          text: orResult.text,
          engine: "claude",
          engineLabel: "OpenRouter AI",
        };
      }
    } catch (orError) {
      console.warn("[AI] OpenRouter backup call failed:", orError);
    }
  }

  // Step 3: Neither succeeded
  return null;
}
