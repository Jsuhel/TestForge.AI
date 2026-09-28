"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FSDUploadCard } from "@/components/dashboard/FSDUploadCard";
import { RequirementAnalysisCard } from "@/components/dashboard/RequirementAnalysisCard";
import { TestCasesCard } from "@/components/dashboard/TestCasesCard";
import { AutomationCard } from "@/components/dashboard/AutomationCard";
import GlowHorizonFM from "@/components/ui/glow-horizon";
import { AnimatedTitleFM } from "@/components/ui/glow-horizon-utils/animated-title-fm";
import type { RunLogLine, RunResult } from "@/lib/runner";
import type { RequirementAnalysis, TestCase } from "@/lib/types";

type Phase = "upload" | "analyzing" | "analyzed" | "generating" | "generated";

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testEngine, setTestEngine] = useState<"claude" | "builtin">("builtin");
  const [testEngineLabel, setTestEngineLabel] = useState("Built-in Rule Engine");
  const [error, setError] = useState<string | null>(null);

  const [automationTc, setAutomationTc] = useState<TestCase | null>(null);
  const [automationScript, setAutomationScript] = useState<string | null>(null);
  const [automationEngine, setAutomationEngine] = useState<"claude" | "builtin">("builtin");
  const [automationEngineLabel, setAutomationEngineLabel] = useState("Built-in Rule Engine");
  const [automating, setAutomating] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogLine[]>([]);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setPhase("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Failed to analyze the document. Please try again.");
        setPhase("upload");
        return;
      }

      setAnalysis(data as RequirementAnalysis);
      setTestCases([]);
      setPhase("analyzed");
      requestAnimationFrame(() => scrollToSection("analysis-section"));
    } catch {
      setError("Network error while analyzing the document. Is the server running?");
      setPhase("upload");
    }
  };

  const handleGenerate = async () => {
    if (!analysis) return;
    setPhase("generating");
    setError(null);

    try {
      const response = await fetch("/api/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Failed to generate test cases. Please try again.");
        setPhase("analyzed");
        return;
      }

      setTestCases(data.testCases as TestCase[]);
      setTestEngine(data.engine ?? "builtin");
      setTestEngineLabel(data.engineLabel ?? "AI");
      setPhase("generated");
      requestAnimationFrame(() => scrollToSection("testcases-section"));
    } catch {
      setError("Network error while generating test cases. Please try again.");
      setPhase("analyzed");
    }
  };

  const handleReset = () => {
    setPhase("upload");
    setSelectedFile(null);
    setAnalysis(null);
    setTestCases([]);
    setError(null);
    setAutomationTc(null);
    setAutomationScript(null);
    setAutomationError(null);
    setRunResult(null);
    setRunError(null);
    setRunLogs([]);
    requestAnimationFrame(() => scrollToSection("fsd-upload-section"));
  };

  const handleAutomate = (tc: TestCase) => {
    setAutomationTc(tc);
    setAutomationScript(null);
    setAutomationError(null);
    setRunResult(null);
    setRunError(null);
    setRunLogs([]);
    requestAnimationFrame(() => scrollToSection("automation-section"));
  };

  const handleRun = async (params: Record<string, string>, headed: boolean) => {
    if (!automationTc) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setRunLogs([]);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase: automationTc, params, headed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setRunError(data?.error ?? "Failed to run the test case.");
        return;
      }
      if (!response.body) {
        setRunError("The server did not stream a response.");
        return;
      }

      // Consume the NDJSON event stream — every browser action appears live.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: {
            type?: string;
            line?: RunLogLine;
            result?: RunResult;
            message?: string;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "log" && event.line) {
            const entry = event.line;
            setRunLogs((logs) => [...logs, entry]);
          } else if (event.type === "done" && event.result) {
            setRunResult(event.result);
          } else if (event.type === "error") {
            setRunError(event.message ?? "Failed to run the test case.");
          }
        }
      }
    } catch {
      setRunError("Network error while running the test. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const handleGenerateScript = async (params: Record<string, string>) => {
    if (!automationTc) return;
    setAutomating(true);
    setAutomationError(null);

    try {
      const response = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase: automationTc, params }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAutomationError(data?.error ?? "Failed to generate the Playwright script.");
        return;
      }

      setAutomationScript(data.script as string);
      setAutomationEngine(data.engine ?? "builtin");
      setAutomationEngineLabel(data.engineLabel ?? "AI");
    } catch {
      setAutomationError("Network error while generating the script. Please try again.");
    } finally {
      setAutomating(false);
    }
  };

  const showAnalysis = phase === "analyzed" || phase === "generating" || phase === "generated";

  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100">
      {/* Floating Shutter Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        hasTestCases={phase === "generated" && testCases.length > 0}
        hasAutomationScript={!!automationScript || !!automationTc}
        hasRunResult={!!runResult}
        testCasesCount={testCases.length}
        bugsCount={runResult?.steps.filter((s) => s.status === "failed").length ?? 0}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Hero — glow horizon landing. The section background stays transparent
            so the animated horizon glow renders through; title + FSD search bar
            sit on top and fill the first screen exactly. */}
        <section id="fsd-upload-section" className="relative scroll-mt-16">
          <div
            className={
              "relative flex w-full flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6" +
              (!showAnalysis ? " min-h-[calc(100dvh-4rem)]" : "")
            }
          >
            <GlowHorizonFM variant="top" />

            <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
              <AnimatedTitleFM open />

              {/* Step 1: FSD Upload / Requirement Analysis */}
              {!showAnalysis ? (
                <div className="tf-rise mt-8 w-full" style={{ animationDelay: "1.2s" }}>
                  <FSDUploadCard
                    selectedFile={selectedFile}
                    onSelectFile={(file) => {
                      setSelectedFile(file);
                      setError(null);
                    }}
                    onAnalyze={handleAnalyze}
                    analyzing={phase === "analyzing"}
                    error={error}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Dashboard Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl w-full mx-auto">

          {analysis && (
            <section id="analysis-section" className="scroll-mt-20">
              <RequirementAnalysisCard
                analysis={analysis}
                generating={phase === "generating"}
                onGenerate={handleGenerate}
                onReset={handleReset}
              />
            </section>
          )}

          {/* Step 2: Generated Test Cases */}
          {phase === "generated" && testCases.length > 0 && (
            <section id="testcases-section" className="scroll-mt-20">
              <TestCasesCard
                testCases={testCases}
                engine={testEngine}
                engineLabel={testEngineLabel}
                documentName={analysis?.documentName ?? "uploaded document"}
                onAutomate={handleAutomate}
                onUpdateTestCase={(updated) => {
                  setTestCases((tcs) => tcs.map((t) => (t.id === updated.id ? updated : t)));
                  // Keep an open automation fold in sync with the edited scenario.
                  setAutomationTc((current) => (current?.id === updated.id ? updated : current));
                }}
              />
            </section>
          )}

          {/* Step 3: Playwright automation for the selected test case */}
          {automationTc && (
            <section id="automation-section" className="scroll-mt-20">
              <AutomationCard
                testCase={automationTc}
                generating={automating}
                script={automationScript}
                engine={automationEngine}
                engineLabel={automationEngineLabel}
                error={automationError}
                onGenerate={handleGenerateScript}
                onRun={handleRun}
                running={running}
                runResult={runResult}
                runError={runError}
                runLogs={runLogs}
                onClose={() => {
                  setAutomationTc(null);
                  setAutomationScript(null);
                  setAutomationError(null);
                  setRunResult(null);
                  setRunError(null);
                  setRunLogs([]);
                }}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
