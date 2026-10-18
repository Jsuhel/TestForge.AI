import { runTestCase } from "@/lib/runner";
import type { TestCase } from "@/lib/types";

export const runtime = "nodejs";
// A full browser run takes minutes — without this Vercel defaults to the plan
// minimum (10s on Hobby) and kills the run almost immediately.
export const maxDuration = 300;

/**
 * Vercel serverless functions cannot ship or launch real browser binaries.
 * Attempting it crashes the whole function (OOM / killed) instead of returning
 * the graceful launch error, so on serverless hosts we short-circuit BEFORE
 * touching Playwright and stream an honest, actionable error. Set
 * TESTFORGE_ENABLE_SERVERLESS_BROWSER=1 to override (e.g. on hosts that DO
 * bundle browsers, or when self-hosting behind a VERCEL-lookalike env).
 */
function serverlessBrowserBlocked(): boolean {
  return (
    Boolean(process.env.VERCEL) && process.env.TESTFORGE_ENABLE_SERVERLESS_BROWSER !== "1"
  );
}

const SERVERLESS_MESSAGE =
  "This deployment cannot open a real browser — serverless functions (Vercel/Netlify) have no browser binaries. " +
  "Options: (1) run the app locally with `npm run dev` and execute the automation from your machine, " +
  "(2) deploy the /api/run route on a container host (Railway, Fly.io, Render, a Docker VPS) where Playwright browsers can be installed, " +
  "or (3) download the generated .spec.ts and run it with `npx playwright test` in your own repo.";

function ndjsonErrorStream(message: string): Response {
  const encoder = new TextEncoder();
  const body = `${JSON.stringify({ type: "error", message })}\n`;
  return new Response(encoder.encode(body), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  let body: {
    testCase?: TestCase;
    params?: Record<string, string>;
    headed?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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

  const url = (body.params?.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return Response.json(
      { error: "A valid application URL (starting with http:// or https://) is required to run the test." },
      { status: 400 },
    );
  }

  // Serverless hosts can't launch browsers — bail out before Playwright is
  // touched so the function returns a clear error instead of crashing.
  if (serverlessBrowserBlocked()) {
    return ndjsonErrorStream(SERVERLESS_MESSAGE);
  }

  const cleanParams: Record<string, string> = { url };
  for (const [key, v] of Object.entries(body.params ?? {})) {
    if (typeof v === "string" && v.length <= 500) cleanParams[key] = v;
  }

  // Stream every browser action to the client as newline-delimited JSON,
  // so the dashboard shows what the runner is doing while it does it.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          // client disconnected — keep running, the run itself still completes
        }
      };

      try {
        const result = await runTestCase(tc, cleanParams, Boolean(body.headed), (event) => send(event));
        send({ type: "done", result });
      } catch (error) {
        console.error("[api/run] failed:", error);
        const message =
          error instanceof Error ? error.message : "Failed to run the test case.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
