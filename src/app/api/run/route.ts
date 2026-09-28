import { runTestCase } from "@/lib/runner";
import type { TestCase } from "@/lib/types";

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
