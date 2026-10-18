"use client";

import React from "react";
import { CheckCircle2, XCircle, MinusCircle, Download, FileText, Timer, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RunResult, StepResult } from "@/lib/runner";
import type { TestCase } from "@/lib/types";

export interface ExecutionReportProps {
  testCase: TestCase;
  runResult: RunResult;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Build a self-contained HTML execution report — screenshots embedded as
 *  base64 so the single file can be shared, archived, or printed to PDF. */
function buildHtmlReport(tc: TestCase, run: RunResult): string {
  const passed = run.steps.filter((s) => s.status === "passed").length;
  const failed = run.steps.filter((s) => s.status === "failed").length;
  const skipped = run.steps.filter((s) => s.status === "skipped").length;
  const failedSteps = run.steps.filter((s) => s.status === "failed");

  const stepRows = run.steps
    .map((s) => {
      const color = s.status === "passed" ? "#16a34a" : s.status === "failed" ? "#dc2626" : "#94a3b8";
      const icon = s.status === "passed" ? "PASS" : s.status === "failed" ? "FAIL" : "SKIP";
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;white-space:nowrap;color:${color};font-weight:700">${icon}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0">${escapeHtml(s.step)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;color:#475569">${escapeHtml(s.detail)}</td>
      </tr>`;
    })
    .join("\n");

  const failureBlocks = failedSteps
    .map((s, i) => {
      const img = s.screenshot
        ? `<img src="data:image/jpeg;base64,${s.screenshot}" alt="Failure ${i + 1}" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" />`
        : `<p style="color:#94a3b8;font-style:italic">(no screenshot captured — the page was unreachable when this step failed)</p>`;
      return `<div style="margin:0 0 28px 0;padding:16px;border:1px solid #fecaca;background:#fef2f2;border-radius:10px">
        <h3 style="margin:0 0 4px 0;font-size:15px;color:#b91c1c">Failure ${i + 1} — Step ${s.index + 1}: ${escapeHtml(s.step)}</h3>
        <p style="margin:0 0 12px 0;font-size:13px;color:#7f1d1d"><strong>Error:</strong> ${escapeHtml(s.detail)}</p>
        ${img}
      </div>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Execution Report — ${escapeHtml(tc.id)}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;max-width:960px;margin:0 auto;padding:32px;color:#0f172a">
  <h1 style="font-size:22px;margin:0 0 2px">TestForge AI — Test Execution Report</h1>
  <p style="color:#64748b;margin:0 0 20px">Generated ${new Date().toLocaleString()}</p>

  <table style="border-collapse:collapse;margin-bottom:20px;font-size:13px">
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Test Case</td><td><b>${escapeHtml(tc.id)}</b> — ${escapeHtml(tc.summary || tc.title)}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Requirement</td><td>${escapeHtml(tc.requirementId)}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Overall result</td><td style="color:${run.overall === "passed" ? "#16a34a" : "#dc2626"};font-weight:700">${run.overall === "passed" ? "PASSED" : "FAILED"}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Target / Browser</td><td>${escapeHtml(run.url)} • ${escapeHtml(run.browser)} (${run.headed ? "headed" : "headless"})</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Duration</td><td>${(run.durationMs / 1000).toFixed(1)}s — ${passed} passed, ${failed} failed, ${skipped} skipped</td></tr>
  </table>

  ${failed > 0 ? `<h2 style="font-size:17px;border-bottom:2px solid #dc2626;padding-bottom:6px">Where the logic failed (${failed})</h2>${failureBlocks}` : `<div style="padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;color:#166534">All steps passed — no failures to report.</div>`}

  <h2 style="font-size:17px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:8px">All steps</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f8fafc">
      <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Status</th>
      <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Step</th>
      <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left">Detail</th>
    </tr></thead>
    <tbody>${stepRows}</tbody>
  </table>
</body></html>`;
}

function downloadReport(tc: TestCase, run: RunResult) {
  const html = buildHtmlReport(tc, run);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${tc.id}_Execution_Report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A failed step with its error description and the screenshot of exactly
 *  where the logic broke — the heart of the report. */
function FailureBlock({ step }: { step: StepResult }) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
          <XCircle className="h-4 w-4 text-rose-400" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white leading-snug">
            Step {step.index + 1} — {step.step}
          </p>
          <p className="mt-1 text-[11px] text-rose-300/90 leading-relaxed">
            <span className="font-semibold text-rose-300">Error:</span> {step.detail}
          </p>
        </div>
      </div>
      {step.screenshot && (
        <img
          src={`data:image/jpeg;base64,${step.screenshot}`}
          alt={`Screenshot at failing step ${step.index + 1}`}
          className="w-full rounded-md border border-slate-800 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={(e) => {
            const img = e.currentTarget;
            window.open(img.src, "_blank", "noopener");
          }}
        />
      )}
    </div>
  );
}

export function ExecutionReport({ testCase, runResult }: ExecutionReportProps) {
  const passed = runResult.steps.filter((s) => s.status === "passed").length;
  const failedSteps = runResult.steps.filter((s) => s.status === "failed");
  const skipped = runResult.steps.filter((s) => s.status === "skipped").length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4" data-testid="execution-report">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div
            className={
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border " +
              (runResult.overall === "passed"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-400")
            }
          >
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Execution Report</p>
            <p className="text-[11px] text-slate-500 leading-snug flex flex-wrap items-center gap-x-2">
              <Timer className="h-3 w-3 inline" />
              {(runResult.durationMs / 1000).toFixed(1)}s
              <span className="text-slate-700">·</span>
              <CheckCircle2 className="h-3 w-3 inline text-emerald-400" />
              {passed} passed
              {failedSteps.length > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <XCircle className="h-3 w-3 inline text-rose-400" />
                  {failedSteps.length} failed
                </>
              )}
              {skipped > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <MinusCircle className="h-3 w-3 inline text-slate-500" />
                  {skipped} skipped
                </>
              )}
              <span className="text-slate-700">·</span>
              <Globe className="h-3 w-3 inline" />
              <span className="font-mono truncate">{runResult.url}</span>
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => downloadReport(testCase, runResult)}
          className="shrink-0"
          title="Download the full report with failure screenshots as a single HTML file"
        >
          <Download className="h-3.5 w-3.5" />
          Download Report
        </Button>
      </div>

      {/* Failures — description + the screenshot of where the logic broke */}
      {failedSteps.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            Where the logic failed ({failedSteps.length})
          </p>
          {failedSteps.map((step) => (
            <FailureBlock key={step.index} step={step} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>All steps passed — no failures to report. Download the report for the full execution record.</span>
        </div>
      )}
    </div>
  );
}
