"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap,
  Sparkles,
  Cpu,
  Loader2,
  Copy,
  Check,
  Download,
  X,
  AlertCircle,
  TerminalSquare,
  Play,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Globe,
  Timer,
  Monitor,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectPrerequisites } from "@/lib/automate";
import type { PrerequisiteField } from "@/lib/automate";
import type { RunLogLine, RunResult, StepResult } from "@/lib/runner";
import type { TestCase } from "@/lib/types";

export interface AutomationCardProps {
  testCase: TestCase;
  generating: boolean;
  script: string | null;
  engine: "claude" | "builtin";
  /** Display name of the engine that produced the script (e.g. "GLM AI"). */
  engineLabel?: string;
  error?: string | null;
  onGenerate: (params: Record<string, string>) => void;
  onRun: (params: Record<string, string>, headed: boolean) => void;
  running: boolean;
  runResult: RunResult | null;
  runError?: string | null;
  /** Live activity lines streamed from the runner while the test executes. */
  runLogs?: RunLogLine[];
  onClose: () => void;
}

/* Minimal code highlighting: comments, strings, keywords. */
function CodeLine({ line }: { line: string }) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return <span className="text-slate-500 italic">{line || " "}</span>;
  }
  const parts = line.split(/("[^"]*")/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('"') ? (
          <span key={i} className="text-amber-300/90">
            {part}
          </span>
        ) : (
          <span key={i}>
            {part.split(/\b(await|const|import|from|async|test|expect|process|env)\b/g).map((seg, j) =>
              /^(await|const|import|from|async|test|expect|process|env)$/.test(seg) ? (
                <span key={j} className="text-blue-400">
                  {seg}
                </span>
              ) : (
                <React.Fragment key={j}>{seg}</React.Fragment>
              ),
            )}
          </span>
        ),
      )}
    </>
  );
}

/** Terminal-style live feed of everything the runner does, streamed as it happens. */
function LiveConsole({ logs, running }: { logs: RunLogLine[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  if (!logs.length && !running) return null;

  const colorFor = (kind: RunLogLine["kind"]) =>
    kind === "error"
      ? "text-rose-300"
      : kind === "success"
        ? "text-emerald-300"
        : kind === "action"
          ? "text-blue-300"
          : "text-slate-500";

  const prefixFor = (kind: RunLogLine["kind"]) =>
    kind === "error" ? "[x]" : kind === "success" ? "[+]" : "[>]";

  return (
    <div className="rounded-lg border border-slate-800 bg-black overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/60">
        <TerminalSquare className="h-3 w-3 text-slate-500" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Live activity
        </span>
        {running && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            running
          </span>
        )}
      </div>
      <div
        ref={ref}
        className="max-h-44 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {logs.map((line, i) => (
          <div key={i} className={colorFor(line.kind)}>
            <span className="mr-1.5 select-none text-slate-700">{prefixFor(line.kind)}</span>
            {line.text}
          </div>
        ))}
        {running && !logs.length && (
          <div className="text-slate-500">starting the browser…</div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step }: { step: StepResult }) {  const icon =
    step.status === "passed" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
    ) : step.status === "failed" ? (
      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
    ) : (
      <MinusCircle className="h-4 w-4 text-slate-500 shrink-0" />
    );

  return (
    <div className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {icon}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 leading-relaxed">
              {step.step}
            </p>
            <p
              className={`mt-1 text-[11px] leading-relaxed ${
                step.status === "failed" ? "text-rose-300/80" : "text-slate-500"
              }`}
            >
              {step.detail}
            </p>
          </div>
        </div>
      </div>
      {step.screenshot && (
        <img
          src={`data:image/png;base64,${step.screenshot}`}
          alt={`Screenshot after step ${step.index + 1}`}
          className="hidden sm:block h-20 w-32 shrink-0 rounded-md border border-slate-800 object-cover object-top cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            const img = e.currentTarget;
            window.open(img.src, "_blank", "noopener");
          }}
        />
      )}
    </div>
  );
}

export function AutomationCard({
  testCase,
  generating,
  script,
  engine,
  engineLabel,
  error,
  onGenerate,
  onRun,
  running,
  runResult,
  runError,
  runLogs = [],
  onClose,
}: AutomationCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  // Visible browser by default — the run opens a real window you can watch.
  const [headed, setHeaded] = useState(true);

  // Prerequisites derive straight from the test case; the form resets when a
  // different row is automated (state adjusted during render, not in an effect).
  const fields = useMemo<PrerequisiteField[]>(
    () => detectPrerequisites(testCase),
    [testCase],
  );
  const formKey = `${testCase.id}::${testCase.title}`;
  const [appliedKey, setAppliedKey] = useState(formKey);
  if (appliedKey !== formKey) {
    setAppliedKey(formKey);
    setValues(Object.fromEntries(fields.map((f) => [f.key, f.defaultValue])));
  }

  const handleCopy = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text */
    }
  };

  const handleDownload = () => {
    if (!script) return;
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${testCase.id}.spec.ts`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="relative">
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TerminalSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                  Playwright Automation
                </h2>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {testCase.id}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{testCase.title}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 self-start sm:self-auto shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Prerequisites form */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Prerequisites for this test case
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Auto-detected from the test steps — review, adjust and generate.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map((field) => (
              <div key={field.key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                  className="w-full h-8 rounded-md border border-slate-700/80 bg-slate-900/70 px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors font-mono"
                />
                <p className="mt-1.5 text-[10px] text-slate-500 leading-snug">{field.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Generate action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            The script reads these values from constants with <span className="font-mono text-slate-300">process.env</span> fallbacks — safe to commit.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => onGenerate(values)}
            disabled={generating}
            className="w-full sm:w-auto"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {generating ? "Writing Playwright Script..." : "Generate Playwright Script"}
          </Button>
        </div>

        {/* Generated script */}
        {script && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{testCase.id}.spec.ts</span>
                <Badge variant="secondary" className="text-[10px]">
                  {engine === "claude" ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                  {engineLabel ?? (engine === "claude" ? "Claude AI" : "Built-in Engine")}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  .spec.ts
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800/80 bg-slate-950/60">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 font-mono text-[10px] text-slate-500">
                  {testCase.id}.spec.ts — Playwright / TypeScript
                </span>
              </div>
              <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed font-mono max-h-[480px] overflow-y-auto">
                <code>
                  {script.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span className="w-8 shrink-0 select-none text-right pr-3 text-slate-700">
                        {i + 1}
                      </span>
                      <span className="whitespace-pre text-slate-300">
                        <CodeLine line={line} />
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>

            <p className="text-[11px] text-slate-500">
              Run it with <span className="font-mono text-slate-400">npx playwright test --grep {testCase.id}</span> after <span className="font-mono text-slate-400">npm i -D @playwright/test &amp;&amp; npx playwright install</span>.
            </p>
          </div>
        )}

        {/* ── Live execution ── */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Run it now</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  TestForge opens the application in a real browser and executes every step.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={headed}
                  onChange={(e) => setHeaded(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-blue-500 cursor-pointer"
                />
                <Monitor className="h-3.5 w-3.5 text-slate-500" />
                Watch it live (open browser)
              </label>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => onRun(values, headed)}
                disabled={running || generating || !(values.url ?? "").trim()}
                className="w-full sm:w-auto"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {running ? "Running in browser..." : "Run Automation"}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            Target: <span className="font-mono text-slate-400 truncate">{(values.url ?? "").trim() || "set the Application URL above"}</span>
          </p>

          {runError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{runError}</span>
            </div>
          )}

          {running && (
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/20 bg-blue-950/20 p-3 text-xs text-blue-300">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                {headed
                  ? `A browser window is open on your desktop — watch it perform each step of ${testCase.id}, with a short pause between actions. Everything is also narrated live below.`
                  : `Browser is executing the steps of ${testCase.id} in the background — every action is narrated live below.`}
              </span>
            </div>
          )}

          <LiveConsole logs={runLogs} running={running} />

          {runResult && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={runResult.overall === "passed" ? "success" : "destructive"} className="text-[11px]">
                  {runResult.overall === "passed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {runResult.overall === "passed" ? "Test Passed" : "Test Failed"}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono">{runResult.browser}</Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Timer className="h-3 w-3" />
                  {(runResult.durationMs / 1000).toFixed(1)}s
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 min-w-0">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">{runResult.url}</span>
                </span>
              </div>

              <div className="space-y-2">
                {runResult.steps.map((step) => (
                  <StepRow key={step.index} step={step} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
