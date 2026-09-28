"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { ListChecks, Download, Sparkles, Cpu, Zap, Pencil, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TestCase } from "@/lib/types";

export interface TestCasesCardProps {
  testCases: TestCase[];
  engine: "claude" | "builtin";
  /** Display name of the engine that produced the suite (e.g. "GLM AI"). */
  engineLabel?: string;
  documentName: string;
  onAutomate: (testCase: TestCase) => void;
  onUpdateTestCase: (testCase: TestCase) => void;
}

const inputClass =
  "w-full h-8 rounded-md border border-slate-700/80 bg-slate-900/70 px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors";

const textareaClass =
  "w-full min-h-[60px] rounded-md border border-slate-700/80 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors resize-y leading-relaxed";

/** Clean empty steps while preserving the full step list. */
function normalizeSteps(steps: string[]): string[] {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? cleaned : ["Open the application.", "Execute the specified flow.", "Verify the result."];
}

const PRIORITY_BADGE: Record<string, "destructive" | "warning" | "secondary"> = {
  High: "destructive",
  Medium: "warning",
  Low: "secondary",
};

function downloadExcel(testCases: TestCase[]) {
  // Template columns: Test Case No | Test Scenario | Priority | Test Steps | Expected Scenario
  const header = ["Test Case No", "Test Scenario", "Priority", "Test Steps", "Expected Scenario"];
  const rows = testCases.map((tc) => [
    tc.id,
    tc.title,
    tc.priority,
    tc.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    tc.expectedResult,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [
    { wch: 12 }, // Test Case No
    { wch: 55 }, // Test Scenario
    { wch: 10 }, // Priority
    { wch: 60 }, // Test Steps
    { wch: 55 }, // Expected Scenario
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Test Cases");
  XLSX.writeFile(workbook, "TestForge_TestCases.xlsx", { bookType: "xlsx" });
}

export function TestCasesCard({
  testCases,
  engine,
  engineLabel,
  documentName,
  onAutomate,
  onUpdateTestCase,
}: TestCasesCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TestCase | null>(null);

  const startEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setDraft({ ...tc, steps: [...tc.steps] });
  };

  const saveEdit = () => {
    if (!draft) return;
    const normalized: TestCase = {
      ...draft,
      title: draft.title.trim() || `Test case ${draft.id}`,
      steps: normalizeSteps(draft.steps),
      expectedResult: draft.expectedResult.trim() || "The system behaves as expected.",
    };
    onUpdateTestCase(normalized);
    setEditingId(null);
    setDraft(null);
  };

  return (
    <Card className="relative">
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                  Generated Test Cases
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {engine === "claude" ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                  {engineLabel ?? (engine === "claude" ? "Claude AI" : "Built-in Rule Engine")}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {testCases.length} test scenarios generated from{" "}
                <span className="text-slate-300">{documentName}</span>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => downloadExcel(testCases)}
            className="shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download Excel
          </Button>
        </div>

        {/* Table — template: No | Scenario | Priority | Steps | Expected */}
        <div className="overflow-auto max-h-[520px] rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-950 border-b border-slate-800">
                {[
                  "Test Case No",
                  "Test Scenario",
                  "Priority",
                  "Steps",
                  "Expected Scenario",
                  "Actions",
                ].map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {testCases.map((tc) => (
                <React.Fragment key={tc.id}>
                <tr
                  className="bg-slate-950/40 hover:bg-slate-900/50 transition-colors align-top"
                >
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-800/80 border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 whitespace-nowrap">
                      {tc.id}
                    </span>
                  </td>
                  <td className="px-3 py-3 max-w-[300px]">
                    <p className="text-xs font-medium text-slate-200 leading-relaxed">
                      {tc.title}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={PRIORITY_BADGE[tc.priority] ?? "secondary"}
                      className="text-[9px] px-1.5 py-0 whitespace-nowrap"
                    >
                      {tc.priority}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 max-w-[340px]">
                    <ol className="space-y-1">
                      {tc.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-mono text-slate-500">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td className="px-3 py-3 max-w-[280px]">
                    <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                      {tc.expectedResult}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5 min-w-[104px]">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onAutomate(tc)}
                        className="whitespace-nowrap"
                        title="Generate a Playwright script for this test case"
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        Automate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => (editingId === tc.id ? setEditingId(null) : startEdit(tc))}
                        className="whitespace-nowrap"
                        title="Manually edit this test case"
                      >
                        {editingId === tc.id ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" />
                        )}
                        {editingId === tc.id ? "Close" : "Edit"}
                      </Button>
                    </div>
                  </td>
                </tr>

                {/* Inline manual editor for this test case */}
                {editingId === tc.id && draft && (
                  <tr className="bg-slate-950/70">
                    <td colSpan={6} className="px-3 py-4">
                      <div className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-4 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-3.5 w-3.5 text-blue-400" />
                            <p className="text-xs font-semibold text-white">
                              Manually editing{" "}
                              <span className="font-mono text-blue-400">{tc.id}</span>
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Saved changes apply to the Playwright script, the browser run and the Excel export.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                          <div className="lg:col-span-9">
                            <label className="mb-1 block text-[11px] font-medium text-slate-400">
                              Test Scenario
                            </label>
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div className="lg:col-span-3">
                            <label className="mb-1 block text-[11px] font-medium text-slate-400">
                              Priority
                            </label>
                            <select
                              value={draft.priority}
                              onChange={(e) =>
                                setDraft({ ...draft, priority: e.target.value as TestCase["priority"] })
                              }
                              className={`${inputClass} cursor-pointer`}
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-slate-400">
                              Test Steps ({draft.steps.length})
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDraft({ ...draft, steps: [...draft.steps, ""] })}
                              className="h-6 text-[10px] text-blue-400 hover:text-blue-300"
                            >
                              + Add Step
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {draft.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-mono text-slate-400">
                                  {i + 1}
                                </span>
                                <input
                                  type="text"
                                  value={step}
                                  placeholder={`Action for step ${i + 1}`}
                                  onChange={(e) => {
                                    const steps = [...draft.steps];
                                    steps[i] = e.target.value;
                                    setDraft({ ...draft, steps });
                                  }}
                                  className={inputClass}
                                />
                                {draft.steps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const steps = draft.steps.filter((_, idx) => idx !== i);
                                      setDraft({ ...draft, steps });
                                    }}
                                    className="mt-1 text-slate-500 hover:text-rose-400 text-xs px-1"
                                    title="Remove this step"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-400">
                            Expected Scenario
                          </label>
                          <textarea
                            value={draft.expectedResult}
                            onChange={(e) => setDraft({ ...draft, expectedResult: e.target.value })}
                            className={textareaClass}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                          <Button type="button" variant="primary" size="sm" onClick={saveEdit}>
                            <Check className="h-3.5 w-3.5" />
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Download footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            {testCases.length} scenarios • sequential steps with expected outcomes, automation-ready.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => downloadExcel(testCases)}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download Excel (.xlsx)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
