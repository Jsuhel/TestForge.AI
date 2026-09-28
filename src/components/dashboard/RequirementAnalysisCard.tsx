"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, RotateCcw, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RequirementAnalysis } from "@/lib/types";

export interface RequirementAnalysisCardProps {
  analysis: RequirementAnalysis;
  generating: boolean;
  onGenerate: () => void;
  onReset: () => void;
}

/** Restate a raw requirement ("The system shall validate...") as clean plain language ("Validates..."). */
function restate(text: string): string {
  let s = text.trim();
  s = s
    .replace(/^the (?:system|application|platform|solution|user|applicant)\s+(?:shall|must|should|will|can|is required to|needs to)\s+/i, "")
    .replace(/^(?:the|a)\s+(?:system|application|platform|solution)\s+/i, "")
    .replace(/^users?\s+(?:can|shall|must)\s+/i, "")
    .replace(/^applicants?\s+(?:can|shall|must)\s+/i, "")
    .trim();
  if (!s) s = text.trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

/** Shorten a journey step at a word boundary, never mid-word. */
function shorten(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Turn the structured analysis into a complete end-to-end explanation of the document. */
function composeExplanation(analysis: RequirementAnalysis): string {
  const { requirements, modules, userJourneys, stats } = analysis;
  const parts: string[] = [];
  const docType = analysis.documentType.replace(/\s*\(.*\)\s*/, "");
  const pagesLabel = stats.pages ? `${stats.pages} page${stats.pages === 1 ? "" : "s"}` : "multiple pages";

  parts.push(
    `I've read **${analysis.documentName}** end to end — ${pagesLabel}, ${stats.words.toLocaleString()} words, **${requirements.length} requirement statements** across **${modules.length} areas**. Let me walk you through everything this document specifies, from top to bottom.`,
  );

  if (requirements.length === 0) {
    parts.push(
      `It identifies as a **${docType}**, but it's written at a high level — I couldn't find explicit "shall"/"must" statements, so it reads more like an overview than a strict specification. I can still work from its overall scope and build a smoke suite from it.`,
    );
    parts.push(
      `Whenever you're ready, hit the button below and I'll turn this into test scenarios.`,
    );
    return parts.join("\n\n");
  }

  // ── Purpose ──
  parts.push(
    `### What this system is`,
    `This is a **${docType}** for a system built around ${modules.length} areas: ${modules
      .slice(0, 6)
      .map((m) => m.toLowerCase())
      .join(", ")}${modules.length > 6 ? ` and ${modules.length - 6} more` : ""}. ${
      analysis.engine === "claude" && analysis.summary
        ? analysis.summary
        : `Together, these areas describe how the product is expected to behave for its users — every rule below comes straight from the document.`
    }`,
  );

  // ── Module-by-module walkthrough: every functional & validation requirement restated ──
  parts.push(`### How each area works, requirement by requirement`);
  const walkthroughModules = modules.filter((m) =>
    requirements.some((r) => r.module === m && (r.type === "functional" || r.type === "validation")),
  );
  walkthroughModules.slice(0, 10).forEach((module, mi) => {
    const moduleReqs = requirements.filter(
      (r) => r.module === module && (r.type === "functional" || r.type === "validation"),
    );
    const shown = moduleReqs.slice(0, 12).map((r) => `• ${restate(r.text)} *(${r.id})*`);
    if (moduleReqs.length > 12) {
      shown.push(`• …plus ${moduleReqs.length - 12} more rules in this area.`);
    }
    parts.push(`**${mi + 1}. ${module}**\n\n${shown.join("\n")}`);
  });
  if (walkthroughModules.length > 10) {
    parts.push(`…and ${walkthroughModules.length - 10} more areas follow the same pattern.`);
  }

  // ── Business rules & limits ──
  const businessRules = requirements.filter((r) => r.type === "business-rule");
  if (businessRules.length) {
    parts.push(
      `### Business rules & limits`,
      `These constraints decide what the system accepts and rejects:\n\n${businessRules
        .slice(0, 12)
        .map((r) => `• ${restate(r.text)} *(${r.id})*`)
        .join("\n")}${businessRules.length > 12 ? `\n• …plus ${businessRules.length - 12} more.` : ""}`,
    );
  }

  // ── End-to-end user flows ──
  if (userJourneys.length) {
    parts.push(
      `### How users move through the system`,
      `${userJourneys
        .slice(0, 4)
        .map(
          (j) =>
            `**${j.name}:** ${j.steps
              .slice(0, 5)
              .map((s) =>
                shorten(
                  s
                    .replace(/^the (?:system|application)\s+(?:shall|must|will)\s+/i, "")
                    .replace(/^(?:the )?(?:system|application)\s+/i, "")
                    .toLowerCase(),
                  60,
                ),
              )
              .join(" → ")}`,
        )
        .join("\n\n")}${userJourneys.length > 4 ? `\n\n…plus ${userJourneys.length - 4} more journeys.` : ""}`,
    );
  }

  // ── Security & performance ──
  const nfrs = requirements.filter((r) => r.type === "non-functional");
  if (nfrs.length) {
    parts.push(
      `### Security & performance expectations`,
      `The document is also explicit about how the system should run:\n\n${nfrs
        .slice(0, 10)
        .map((r) => `• ${restate(r.text)} *(${r.id})*`)
        .join("\n")}${nfrs.length > 10 ? `\n• …plus ${nfrs.length - 10} more.` : ""}`,
    );
  }

  // ── Wrap-up ──
  const high = requirements.filter((r) => r.priority === "High").length;
  parts.push(
    `### The full picture`,
    `In total: **${requirements.length} requirements** (${high} hard "must/shall" constraints, ${businessRules.length} business rules, ${nfrs.length} security/performance statements) across **${modules.length} areas** and **${userJourneys.length} user journeys** — every one of them covered above. That's the complete specification, end to end. Hit the button below whenever you're ready to turn it into test scenarios.`,
  );

  return parts.join("\n\n");
}

/** Minimal markdown renderer: ### headings, "• " bullets, **bold** and *italic* spans. */
function RichText({ text }: { text: string }) {
  const blocks = text.split("\n\n");
  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="font-display text-sm font-semibold text-white mt-6 mb-2 pb-1.5 border-b border-slate-800/80"
            >
              {renderInline(block.slice(4))}
            </h4>
          );
        }
        const lines = block.split("\n");
        const isBulletList = lines.every((l) => l.startsWith("• "));
        if (isBulletList) {
          return (
            <ul key={i} className="my-2 space-y-1.5">
              {lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/80" />
                  <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2 leading-relaxed">
            {renderInline(block)}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** first, then *italic* inside plain segments.
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, i) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return (
      <React.Fragment key={i}>
        {segment.split(/(\*[^*]+\*)/g).map((seg, j) =>
          seg.startsWith("*") && seg.endsWith("*") && seg.length > 2 ? (
            <em key={j} className="not-italic font-mono text-[11px] text-blue-400/70">
              {seg.slice(1, -1)}
            </em>
          ) : (
            <React.Fragment key={j}>{seg}</React.Fragment>
          ),
        )}
      </React.Fragment>
    );
  });
}

const CHARS_PER_TICK = 16;
const TICK_MS = 14;

export function RequirementAnalysisCard({
  analysis,
  generating,
  onGenerate,
  onReset,
}: RequirementAnalysisCardProps) {
  const fullText = useMemo(() => composeExplanation(analysis), [analysis]);
  const [visible, setVisible] = useState(0);
  const streamingRef = useRef(false);

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const raf = requestAnimationFrame(() => setVisible(fullText.length));
      return () => cancelAnimationFrame(raf);
    }

    // Reset + stream via callbacks so state is never set synchronously in the effect body.
    const reset = requestAnimationFrame(() => setVisible(0));
    streamingRef.current = true;
    let count = 0;
    const interval = setInterval(() => {
      count += CHARS_PER_TICK;
      if (count >= fullText.length) {
        clearInterval(interval);
        streamingRef.current = false;
        setVisible(fullText.length);
        return;
      }
      setVisible(count);
    }, TICK_MS);
    return () => {
      cancelAnimationFrame(reset);
      clearInterval(interval);
    };
  }, [fullText]);

  const done = visible >= fullText.length;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shadow-sm shadow-black/20 overflow-hidden">
      {/* Subtle top glow */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

      {/* Chat header */}
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 pt-5 pb-3 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-lg shadow-blue-500/25">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-white leading-tight">
              TestForge AI
            </p>
            <p className="text-[11px] text-slate-500 leading-tight">
              {done ? "Analysis complete" : "Analyzing your document..."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-slate-500 hover:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Document</span>
        </Button>
      </div>

      {/* Explanation body */}
      <div className="px-5 sm:px-7 py-6">
        <div className="max-w-3xl mx-auto text-sm sm:text-[15px] text-slate-300">
          <RichText text={fullText.slice(0, visible)} />
          {!done && <span className="tf-caret" aria-hidden>&nbsp;</span>}
        </div>
      </div>

      {/* Meta footer + action */}
      <div className="px-5 sm:px-7 pb-6">
        <div className="max-w-3xl mx-auto">
          {done && (
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-600">
              <FileText className="h-3 w-3" />
              <span>{analysis.stats.pages || "—"} pages</span>
              <span className="text-slate-800">·</span>
              <span>{analysis.stats.words.toLocaleString()} words</span>
              <span className="text-slate-800">·</span>
              <span>{analysis.stats.requirementCount} requirements</span>
              <span className="text-slate-800">·</span>
              <span>{analysis.stats.moduleCount} modules</span>
              <span className="text-slate-800">·</span>
              <span>{analysis.stats.journeyCount} journeys</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-900">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              {analysis.requirements.length > 0
                ? `${analysis.requirements.length} test scenarios ready to be generated.`
                : "A document-level smoke suite is ready to generate."}
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onGenerate}
              disabled={generating}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "Generating Test Cases..." : "Generate Test Cases"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
