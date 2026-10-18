"use client";

import React, { useState } from "react";
import { ListChecks, Download, Sparkles, Cpu, Zap, Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import ExcelJS from "exceljs";
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
  /** Append a manually created test case to the suite. */
  onAddTestCase: (testCase: TestCase) => void;
  /** Remove a test case by id. */
  onDeleteTestCase: (id: string) => void;
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

/**
 * Build the "Test Scenario" workbook: 11 columns in the mandated order,
 * blue header with bold white text, alternating light-blue/white row shading,
 * wrapped text and consistent borders — a QA-team-ready deliverable.
 */
async function downloadExcel(testCases: TestCase[], documentName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TestForge AI";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Test Scenario", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const header = [
    "Requirement ID",
    "Test Scenario ID",
    "Test Summary",
    "Pre-condition",
    "Test Steps",
    "Test Scenario",
    "Expected Test Result",
    "Actual Results",
    "Reviewed By",
    "Reviewer Remarks",
    "Tester Remarks",
  ];
  sheet.columns = header.map((_, i) => ({ key: String(i) }));
  sheet.addRow(header);

  // Blue header row, bold white text, centred.
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 24;

  for (const tc of testCases) {
    const row = sheet.addRow([
      tc.requirementId,
      tc.id,
      tc.summary || tc.title,
      tc.precondition,
      tc.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
      tc.title,
      tc.expectedResult,
      "", // Actual Results — filled during execution
      "", // Reviewed By
      tc.clarificationNote || "", // Reviewer Remarks — FSD ambiguity flags land here
      "", // Tester Remarks
    ]);

    // Alternating light-blue / white shading with consistent borders + wrap.
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.font = { size: 10 };
      cell.border = thinBorder();
    });
    row.getCell(2).font = { size: 10, bold: true };
  }
  for (let r = 2; r <= testCases.length + 1; r += 2) {
    sheet.getRow(r).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
    });
  }

  // Readable widths, wrapped long-text columns.
  const widths = [14, 16, 34, 28, 46, 52, 52, 18, 14, 28, 24];
  widths.forEach((wch, i) => {
    sheet.getColumn(i + 1).width = wch;
  });

  const baseName =
    documentName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "TestScenarios";
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${baseName}_Test_Scenarios.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function thinBorder() {
  const edge = { style: "thin" as const, color: { argb: "FFB0B7C3" } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

/** Inline editor shared by "edit row" and "add test case" — one panel, two entry points. */
function TestCaseEditor({
  draft,
  mode,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TestCase;
  mode: "edit" | "new";
  onChange: (d: TestCase) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-blue-400" />
          <p className="text-xs font-semibold text-white">
            {mode === "new" ? (
              <>
                New test case{" "}
                <span className="font-mono text-blue-400">{draft.id}</span>
              </>
            ) : (
              <>
                Manually editing{" "}
                <span className="font-mono text-blue-400">{draft.id}</span>
              </>
            )}
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
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
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
              onChange({ ...draft, priority: e.target.value as TestCase["priority"] })
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
            onClick={() => onChange({ ...draft, steps: [...draft.steps, ""] })}
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
                  onChange({ ...draft, steps });
                }}
                className={inputClass}
              />
              {draft.steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const steps = draft.steps.filter((_, idx) => idx !== i);
                    onChange({ ...draft, steps });
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
          onChange={(e) => onChange({ ...draft, expectedResult: e.target.value })}
          className={textareaClass}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={onSave}>
          <Check className="h-3.5 w-3.5" />
          {mode === "new" ? "Save Test Case" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

export function TestCasesCard({
  testCases,
  engine,
  engineLabel,
  documentName,
  onAutomate,
  onUpdateTestCase,
  onAddTestCase,
  onDeleteTestCase,
}: TestCasesCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TestCase | null>(null);
  // Row whose Delete button is armed — click again to confirm, leaving the row cancels.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const closeEditor = () => {
    setEditingId(null);
    setDraft(null);
  };

  const startEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setArmedDeleteId(null);
    setDraft({ ...tc, steps: [...tc.steps] });
  };

  // Open the editor with a fresh, uniquely numbered test case.
  const startAdd = () => {
    const nextNum = testCases.reduce((max, tc) => {
      const m = tc.id.match(/(\d+)\s*$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    setEditingId("new");
    setArmedDeleteId(null);
    setDraft({
      id: `TC-${String(nextNum + 1).padStart(3, "0")}`,
      title: "",
      module: "Manual",
      type: "Positive",
      priority: "Medium",
      precondition: "",
      steps: [""],
      expectedResult: "",
      requirementId: "MANUAL",
    });
  };

  const saveEdit = () => {
    if (!draft) return;
    const normalized: TestCase = {
      ...draft,
      title: draft.title.trim() || `Test case ${draft.id}`,
      steps: normalizeSteps(draft.steps),
      expectedResult: draft.expectedResult.trim() || "The system behaves as expected.",
    };
    if (editingId === "new") onAddTestCase(normalized);
    else onUpdateTestCase(normalized);
    closeEditor();
  };

  const handleDelete = (tc: TestCase) => {
    if (armedDeleteId !== tc.id) {
      setArmedDeleteId(tc.id);
      return;
    }
    onDeleteTestCase(tc.id);
    setArmedDeleteId(null);
    if (editingId === tc.id) closeEditor();
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startAdd}
              title="Manually add a test case to the suite"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Test Case
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void downloadExcel(testCases, documentName)}
            >
              <Download className="h-3.5 w-3.5" />
              Download Excel
            </Button>
          </div>
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
              {/* Inline editor for a manually added test case */}
              {editingId === "new" && draft && (
                <tr className="bg-slate-950/70">
                  <td colSpan={6} className="px-3 py-4">
                    <TestCaseEditor
                      mode="new"
                      draft={draft}
                      onChange={setDraft}
                      onSave={saveEdit}
                      onCancel={closeEditor}
                    />
                  </td>
                </tr>
              )}
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
                        onClick={() => (editingId === tc.id ? closeEditor() : startEdit(tc))}
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
                      {/* Delete — first click arms it, second confirms, moving away cancels. */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(tc)}
                        onMouseLeave={() => setArmedDeleteId((armed) => (armed === tc.id ? null : armed))}
                        className={
                          "whitespace-nowrap " +
                          (armedDeleteId === tc.id
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                            : "text-slate-500 hover:text-rose-300 hover:border-rose-500/30")
                        }
                        title={armedDeleteId === tc.id ? "Click again to delete this test case" : "Delete this test case"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {armedDeleteId === tc.id ? "Confirm" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>

                {/* Inline manual editor for this test case */}
                {editingId === tc.id && draft && (
                  <tr className="bg-slate-950/70">
                    <td colSpan={6} className="px-3 py-4">
                      <TestCaseEditor
                        mode="edit"
                        draft={draft}
                        onChange={setDraft}
                        onSave={saveEdit}
                        onCancel={closeEditor}
                      />
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
            onClick={() => void downloadExcel(testCases, documentName)}
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
