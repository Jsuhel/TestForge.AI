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

/** Human-readable engine name for UI badges ("GLM AI" vs "Claude AI"). */
export function aiEngineLabel(): string {
  return AI_MODEL.toLowerCase().startsWith("glm") ? "GLM AI" : "Claude AI";
}

/**
 * Build an SDK client honoring the environment: ANTHROPIC_BASE_URL routes to
 * the Anthropic-compatible endpoint (Z.AI), ANTHROPIC_AUTH_TOKEN authenticates,
 * API_TIMEOUT_MS raises the per-request timeout. Lazy import keeps the SDK out
 * of any client bundle — only server routes call this.
 */
export async function getAIClient(): Promise<Anthropic> {
  const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
  const timeout = Number(process.env.API_TIMEOUT_MS) || undefined;
  return new AnthropicClient(timeout ? { timeout } : {});
}
