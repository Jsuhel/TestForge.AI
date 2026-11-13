/**
 * Latency benchmark for the TestForge AI pipeline endpoints.
 *
 * Measures real end-to-end response time per API against a running server:
 *   /api/analyze        (multipart FSD upload → requirement analysis)
 *   /api/generate-tests (analysis → QA test suite)
 *   /api/automate       (test case → Playwright script)
 *   /api/chat           (question grounded in the analysis)
 *
 * Usage:
 *   node scripts/bench-apis.mjs                 # 3 runs per endpoint
 *   node scripts/bench-apis.mjs 5               # 5 runs per endpoint
 *   BASE_URL=http://localhost:3000 node scripts/bench-apis.mjs
 *
 * The chain is real: analyze's output feeds generate-tests, whose first test
 * case feeds automate. Each response reports its engine, so you can tell
 * GLM AI latency apart from the built-in rule engine.
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUNS = Math.max(1, Number(process.argv[2] ?? 3));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FSD_FILE = path.join(__dirname, "..", "tests", "e2e", "fixtures", "sample-fsd.txt");

const fmt = (ms) => `${String(Math.round(ms / 100) / 10).padStart(6)}s`;

/** Time one request; resolves { ms, json } — throws on non-2xx. */
async function timed(label, run) {
  const started = performance.now();
  const result = await run();
  return { ms: performance.now() - started, label, ...result };
}

async function main() {
  console.log(`Benchmarking ${BASE_URL} — ${RUNS} run(s) per endpoint\n`);

  // Server must be up (npm run dev / npm start).
  const probe = await fetch(BASE_URL, { redirect: "manual" }).catch(() => null);
  if (!probe) {
    console.error(`Server not reachable at ${BASE_URL}. Start it with: npm run dev`);
    process.exit(1);
  }

  const fsdBuffer = await readFile(FSD_FILE);

  // ── /api/analyze ──────────────────────────────────────────────────────────
  const analyzeRuns = [];
  let analysis = null;
  for (let i = 0; i < RUNS; i++) {
    const r = await timed(`analyze #${i + 1}`, async () => {
      const form = new FormData();
      form.append(
        "file",
        new Blob([fsdBuffer], { type: "text/plain" }),
        "sample-fsd.txt",
      );
      const res = await fetch(`${BASE_URL}/api/analyze`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(`analyze failed (${res.status}): ${json?.error}`);
      return { json };
    });
    analysis = r.json;
    analyzeRuns.push(r.ms);
    console.log(
      `  analyze            ${fmt(r.ms)}  engine=${r.json.engineLabel ?? r.json.engine ?? "?"}  ${r.json.requirements?.length ?? 0} requirements`,
    );
  }

  // ── /api/generate-tests ───────────────────────────────────────────────────
  const genRuns = [];
  let firstTestCase = null;
  for (let i = 0; i < RUNS; i++) {
    const r = await timed(`generate #${i + 1}`, async () => {
      const res = await fetch(`${BASE_URL}/api/generate-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`generate-tests failed (${res.status}): ${json?.error}`);
      return { json };
    });
    firstTestCase = r.json.testCases?.[0] ?? firstTestCase;
    genRuns.push(r.ms);
    console.log(
      `  generate-tests     ${fmt(r.ms)}  engine=${r.json.engineLabel ?? "?"}  ${r.json.testCases?.length ?? 0} test cases`,
    );
  }

  // ── /api/automate ─────────────────────────────────────────────────────────
  const autoRuns = [];
  if (firstTestCase) {
    for (let i = 0; i < RUNS; i++) {
      const r = await timed(`automate #${i + 1}`, async () => {
        const res = await fetch(`${BASE_URL}/api/automate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testCase: firstTestCase,
            params: { url: "https://example.com" },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`automate failed (${res.status}): ${json?.error}`);
        return { json };
      });
      autoRuns.push(r.ms);
      console.log(
        `  automate           ${fmt(r.ms)}  engine=${r.json.engineLabel ?? "?"}  script=${(r.json.script ?? "").split("\n").length} lines`,
      );
    }
  }

  // ── /api/chat ─────────────────────────────────────────────────────────────
  const chatRuns = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await timed(`chat #${i + 1}`, async () => {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          messages: [],
          question: "Which module does this FSD cover?",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`chat failed (${res.status}): ${json?.error}`);
      return { json };
    });
    chatRuns.push(r.ms);
    console.log(`  chat               ${fmt(r.ms)}  engine=${r.json.engineLabel ?? "?"}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const stats = (runs) => {
    const sorted = [...runs].sort((a, b) => a - b);
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    return { min: sorted[0], max: sorted[sorted.length - 1], avg };
  };

  console.log("\n─── Summary (min / avg / max) ───────────────────────");
  for (const [name, runs] of [
    ["/api/analyze", analyzeRuns],
    ["/api/generate-tests", genRuns],
    ["/api/automate", autoRuns],
    ["/api/chat", chatRuns],
  ]) {
    if (!runs.length) continue;
    const s = stats(runs);
    console.log(
      `${name.padEnd(22)} ${fmt(s.min)} / ${fmt(s.avg)} / ${fmt(s.max)}`,
    );
  }
}

main().catch((err) => {
  console.error(`\nBenchmark aborted: ${err.message}`);
  process.exit(1);
});
