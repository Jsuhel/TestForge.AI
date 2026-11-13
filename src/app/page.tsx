"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BrandFab } from "@/components/layout/BrandFab";
import { FSDUploadCard } from "@/components/dashboard/FSDUploadCard";
import { RequirementAnalysisCard } from "@/components/dashboard/RequirementAnalysisCard";
import { FSDChatCard } from "@/components/dashboard/FSDChatCard";
import { TestCasesCard } from "@/components/dashboard/TestCasesCard";
import { AutomationCard } from "@/components/dashboard/AutomationCard";
import {
  deleteSession,
  getActiveSessionId,
  getSession,
  listSessions,
  newSessionId,
  putSession,
  setActiveSessionId,
  subscribeToSessions,
  toSummary,
  type ProjectSession,
  type SessionSummary,
} from "@/lib/session-store";
import type { RunLogLine, RunResult } from "@/lib/runner";
import type { ChatMessage, RequirementAnalysis, TestCase } from "@/lib/types";
import type { SessionPhase } from "@/lib/session-store";

type Phase = "upload" | "analyzing" | "analyzed" | "generating" | "generated";

/** Phases worth persisting — transient work states are never saved. */
function isSavedPhase(phase: Phase): phase is SessionPhase {
  return phase === "analyzed" || phase === "generated";
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** "shopping-cart-fsd.pdf" → "shopping-cart-fsd" for the history title. */
function titleFromDocument(documentName: string): string {
  return documentName.replace(/\.[^.]+$/, "") || documentName;
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

  // FSD chat — lifted here so the conversation persists with the session.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatEngineLabel, setChatEngineLabel] = useState<string | null>(null);

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

  // ── Project sessions (persistent history) ─────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  /** False until the saved session (if any) has been restored from storage. */
  const [hydrated, setHydrated] = useState(false);

  const createdAtRef = useRef<number>(Date.now());
  /** Serialized payload of the last write — skips no-op saves after hydration. */
  const lastPersistedRef = useRef<string | null>(null);
  /** True only right after a real analysis — restored sessions skip the typing animation. */
  const [freshAnalysis, setFreshAnalysis] = useState(false);

  const refreshSessions = useCallback(async () => {
    const all = await listSessions();
    setSessions(all.map(toSummary));
  }, []);

  /** Restore a saved session into the dashboard. */
  const applySession = useCallback((session: ProjectSession) => {
    createdAtRef.current = session.createdAt;
    lastPersistedRef.current = null; // allow the debounced save to run its compare
    setFreshAnalysis(false); // restored analysis renders instantly, no replay
    setSessionId(session.id);
    setPhase(session.phase);
    setAnalysis(session.analysis);
    setChatMessages(session.chat);
    setChatEngineLabel(session.chatEngineLabel ?? null);
    setTestCases(session.testCases);
    setTestEngine(session.testEngine);
    setTestEngineLabel(session.testEngineLabel);
    setAutomationTc(session.automation?.testCase ?? null);
    setAutomationScript(session.automation?.script ?? null);
    setAutomationEngine(session.automation?.engine ?? "builtin");
    setAutomationEngineLabel(session.automation?.engineLabel ?? "Built-in Rule Engine");
    setRunResult(session.runResult);
    setRunLogs(session.runLogs);
    setSelectedFile(null);
    setError(null);
  }, []);

  /** Open a project from the history list (pushes a URL entry so Back works). */
  const selectSession = useCallback(
    async (id: string, push = true) => {
      const session = await getSession(id);
      if (!session) return;
      applySession(session);
      if (push) {
        const url = new URL(window.location.href);
        url.searchParams.set("session", id);
        window.history.pushState(null, "", url.toString());
      }
      window.scrollTo({ top: 0 });
    },
    [applySession],
  );

  // Hydrate once on mount: ?session= param wins, else the last active session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paramId = new URLSearchParams(window.location.search).get("session");
      const savedId = paramId ?? getActiveSessionId();
      if (savedId) {
        const session = await getSession(savedId);
        if (session && !cancelled) applySession(session);
      }
      await refreshSessions();
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, refreshSessions]);

  // Keep the URL and the "last active" pointer in sync with the open session.
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (sessionId) url.searchParams.set("session", sessionId);
    else url.searchParams.delete("session");
    window.history.replaceState(null, "", url.toString());
    setActiveSessionId(sessionId);
  }, [sessionId, hydrated]);

  // Browser Back/Forward moves between project sessions.
  useEffect(() => {
    if (!hydrated) return;
    const onPopState = () => {
      const id = new URLSearchParams(window.location.search).get("session");
      if (id && id !== sessionId) void selectSession(id, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sessionId, hydrated, selectSession]);

  // Other tabs/windows editing sessions updates this tab's history list.
  useEffect(() => subscribeToSessions(() => void refreshSessions()), [refreshSessions]);

  // Snapshot the current workspace into a session object (null when nothing durable yet).
  const buildSession = useCallback((): ProjectSession | null => {
    if (!sessionId || !analysis || !isSavedPhase(phase)) return null;
    return {
      id: sessionId,
      title: titleFromDocument(analysis.documentName),
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      phase,
      analysis,
      chat: chatMessages,
      chatEngineLabel: chatEngineLabel ?? undefined,
      testCases,
      testEngine,
      testEngineLabel,
      automation:
        automationTc !== null
          ? {
              testCase: automationTc,
              script: automationScript,
              engine: automationEngine,
              engineLabel: automationEngineLabel,
            }
          : null,
      runResult,
      runLogs,
    };
  }, [
    sessionId,
    analysis,
    phase,
    chatMessages,
    chatEngineLabel,
    testCases,
    testEngine,
    testEngineLabel,
    automationTc,
    automationScript,
    automationEngine,
    automationEngineLabel,
    runResult,
    runLogs,
  ]);

  // Auto-save (debounced): every change — chat turns, edits, runs — is persisted,
  // so a refresh always lands exactly where the user left off.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const session = buildSession();
      if (!session) return;
      const serialized = JSON.stringify({ ...session, updatedAt: 0 });
      if (serialized === lastPersistedRef.current) return;
      lastPersistedRef.current = serialized;
      void putSession(session).then(() => refreshSessions());
    }, 400);
    return () => clearTimeout(timer);
  }, [hydrated, buildSession, refreshSessions]);

  /** Start a brand-new project context (the old one stays in History). */
  const startNewSession = useCallback(() => {
    setSessionId(null);
    setPhase("upload");
    setSelectedFile(null);
    setAnalysis(null);
    setChatMessages([]);
    setChatEngineLabel(null);
    setTestCases([]);
    setError(null);
    setAutomationTc(null);
    setAutomationScript(null);
    setAutomationError(null);
    setRunResult(null);
    setRunError(null);
    setRunLogs([]);
    lastPersistedRef.current = null;
    setFreshAnalysis(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const summary = sessions.find((s) => s.id === id);
      const ok = window.confirm(
        `Delete project "${summary?.title ?? id}" and its saved conversation? This cannot be undone.`,
      );
      if (!ok) return;
      await deleteSession(id);
      if (id === sessionId) startNewSession();
      await refreshSessions();
    },
    [sessions, sessionId, startNewSession, refreshSessions],
  );

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setPhase("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      let data: { error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        // Response was not JSON
      }

      if (!response.ok) {
        setError(
          data?.error ??
            `Failed to analyze the document (${response.status}: ${response.statusText || "Server Error"}).`,
        );
        setPhase("upload");
        return;
      }

      const freshAnalysis = data as unknown as RequirementAnalysis;
      const id = sessionId ?? newSessionId();
      const now = Date.now();
      createdAtRef.current = now;

      // Persist immediately — a refresh right after analysis must not lose work.
      const session: ProjectSession = {
        id,
        title: titleFromDocument(freshAnalysis.documentName),
        createdAt: now,
        updatedAt: now,
        phase: "analyzed",
        analysis: freshAnalysis,
        chat: [],
        testCases: [],
        testEngine: "builtin",
        testEngineLabel: "Built-in Rule Engine",
        automation: null,
        runResult: null,
        runLogs: [],
      };
      lastPersistedRef.current = null;
      void putSession(session).then(() => refreshSessions());

      setSessionId(id);
      setAnalysis(freshAnalysis);
      setFreshAnalysis(true); // stream the explanation only for genuinely new analyses
      setChatMessages([]);
      setChatEngineLabel(null);
      setTestCases([]);
      setPhase("analyzed");
      requestAnimationFrame(() => scrollToSection("analysis-section"));
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Analysis request failed: ${err.message}`
          : "Network error while analyzing the document. Please check your connection.",
      );
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
      let data: {
        error?: string;
        testCases?: TestCase[];
        engine?: RequirementAnalysis["engine"];
        engineLabel?: string;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        // Response was not JSON
      }

      if (!response.ok) {
        setError(
          data?.error ??
            `Failed to generate test cases (${response.status}: ${response.statusText || "Server Error"}).`,
        );
        setPhase("analyzed");
        return;
      }

      setTestCases((data?.testCases as TestCase[]) ?? []);
      setTestEngine(data?.engine ?? "builtin");
      setTestEngineLabel(data?.engineLabel ?? "AI");
      setPhase("generated");
      requestAnimationFrame(() => scrollToSection("testcases-section"));
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Generation request failed: ${err.message}`
          : "Network error while generating test cases. Please try again.",
      );
      setPhase("analyzed");
    }
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
    <div className="flex min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Floating Shutter Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        hasAnalysis={!!analysis}
        hasTestCases={phase === "generated" && testCases.length > 0}
        hasAutomationScript={!!automationScript || !!automationTc}
        hasRunResult={!!runResult}
        testCasesCount={testCases.length}
        bugsCount={runResult?.steps.filter((s) => s.status === "failed").length ?? 0}
        sessions={sessions}
        activeSessionId={sessionId}
        onSelectSession={(id) => void selectSession(id)}
        onNewSession={startNewSession}
        onDeleteSession={(id) => void handleDeleteSession(id)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Hero — static, flat. Fills the first screen before any analysis. */}
        <section id="fsd-upload-section" className="relative scroll-mt-16">
          <div
            className={
              "flex w-full flex-col items-center px-4 sm:px-6 " +
              (!showAnalysis
                ? " min-h-[calc(100dvh-4rem)] justify-center py-10 sm:py-14 lg:py-16"
                : " py-8 sm:py-10")
            }
          >
            <div className="flex w-full max-w-2xl flex-col items-center">
              <h1 className="text-balance text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-zinc-100 px-2">
                TestForge AI
              </h1>
              <p className="mt-3 sm:mt-4 text-balance text-sm sm:text-base text-zinc-500 max-w-lg px-4">
                From requirements to reliable testing
              </p>

              {/* Step 1: FSD Upload / Requirement Analysis.
                  Held back one tick until saved sessions are restored so a
                  refresh never flashes the empty upload screen. */}
              {!showAnalysis && hydrated ? (
                <div className="mt-8 sm:mt-10 w-full max-w-[560px]">
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
        <main className={showAnalysis ? "flex-1 p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl w-full mx-auto" : "hidden"}>

          {analysis && (
            <section id="analysis-section" className="scroll-mt-20">
              <RequirementAnalysisCard
                analysis={analysis}
                generating={phase === "generating"}
                onGenerate={handleGenerate}
                onReset={startNewSession}
                animate={freshAnalysis}
              />
            </section>
          )}

          {/* FSD Chat — ask GLM clarifying questions about the analyzed document.
              Conversation lives in the session so it survives refreshes. */}
          {showAnalysis && analysis && (
            <section id="chat-section" className="scroll-mt-20">
              <FSDChatCard
                key={sessionId ?? analysis.documentName}
                analysis={analysis}
                messages={chatMessages}
                onMessagesChange={setChatMessages}
                initialEngineLabel={chatEngineLabel}
                onEngineLabelChange={setChatEngineLabel}
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
                onAddTestCase={(tc) => setTestCases((tcs) => [...tcs, tc])}
                onDeleteTestCase={(id) => {
                  setTestCases((tcs) => tcs.filter((t) => t.id !== id));
                  // Deleting the case being automated closes its fold too.
                  if (automationTc?.id === id) {
                    setAutomationTc(null);
                    setAutomationScript(null);
                    setAutomationError(null);
                    setRunResult(null);
                    setRunError(null);
                    setRunLogs([]);
                  }
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
                onUpdateScript={(script) => setAutomationScript(script)}
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

      {/* Brand floating action button (replaces the Next.js dev-tools bubble) */}
      <BrandFab />
    </div>
  );
}
