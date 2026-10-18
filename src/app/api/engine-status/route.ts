import { aiCredentialsPresent } from "@/lib/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics: tells the dashboard (and anyone curl-ing the
 * deployed URL) whether the AI engine is actually configured. When keys are
 * missing, every pipeline endpoint silently falls back to the built-in rule
 * engine — this makes that state visible instead of mysterious.
 */
export async function GET() {
  const hasAnthropic = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const configured = aiCredentialsPresent();

  return Response.json({
    aiConfigured: configured,
    providers: { anthropic: hasAnthropic, openRouter: hasOpenRouter },
    model: process.env.TESTFORGE_MODEL ?? process.env.OPENROUTER_MODEL ?? "default",
    hint: configured
      ? undefined
      : "No AI credentials found in this environment. Add ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) or OPENROUTER_API_KEY in your hosting provider's environment variables, then redeploy. Until then the app uses the built-in rule engine.",
  });
}
