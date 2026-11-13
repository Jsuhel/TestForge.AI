"use client";

import React, { useRef, useState } from "react";
import {
  Plus,
  X,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface FSDUploadCardProps {
  /** The selected file, if any. Actual File object is kept by the parent. */
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error?: string | null;
}

const CHIP: React.CSSProperties = {
  borderRadius: 36,
  background: "rgba(255,255,255,0.06)",
};

const ICON_GRAY = "#71717a";

export function FSDUploadCard({
  selectedFile,
  onSelectFile,
  onAnalyze,
  analyzing,
  error,
}: FSDUploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onSelectFile(file);
  };

  const fileSizeLabel = selectedFile
    ? selectedFile.size > 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
    : "";

  return (
    <div className="space-y-3 w-full">
      <div className="w-full">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
        />

        {/* FSD composer — flat card, no ornament */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="mx-auto block w-full max-w-[560px] rounded-2xl transition-colors duration-200"
          style={{
            background: dragOver ? "#1c1c1f" : "#141416",
          }}
        >
            <div className="p-3 sm:p-3.5 flex flex-col justify-between min-h-[104px] gap-2.5">
              {/* Top chip — attached FSD or decorative @ */}
              {selectedFile ? (
                <div
                  style={{
                    ...CHIP,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    width: "fit-content",
                    maxWidth: "100%",
                    height: 26,
                    padding: "0 6px 0 8px",
                    fontSize: 11,
                    lineHeight: "14px",
                    color: "#e4e4e7",
                  }}
                >
                  <FileText style={{ width: 13, height: 13, color: "#a1a1aa", flexShrink: 0 }} />
                  <span style={{ maxWidth: "clamp(120px, 45vw, 260px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedFile.name}
                  </span>
                  <span style={{ color: "#71717a", flexShrink: 0 }}>{fileSizeLabel}</span>
                  <button
                    type="button"
                    onClick={() => onSelectFile(null)}
                    title="Remove file"
                    className="hover:text-white transition-colors p-0.5"
                    style={{ display: "inline-flex", color: ICON_GRAY, flexShrink: 0 }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    ...CHIP,
                    display: "inline-flex",
                    alignItems: "center",
                    width: "fit-content",
                    height: 24,
                    padding: "0 7px",
                  }}
                >
                  <FileText style={{ width: 13, height: 13, color: "#71717a" }} />
                </div>
              )}

              {/* Input line — click to attach */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-left cursor-pointer w-full text-xs sm:text-sm leading-relaxed transition-colors duration-150"
                style={{
                  color: selectedFile ? "#e4e4e7" : "#71717a",
                  padding: "4px 2px",
                }}
                title="Click to browse for your FSD"
              >
                {selectedFile
                  ? "FSD attached — press the arrow to analyze and chat with AI."
                  : "Upload FSD / PRD and chat with AI for test automation..."}
              </button>

              {/* Bottom row — upload (+), engine (Auto), analyze (arrow) */}
              <div className="flex items-center gap-2 pt-1 mt-auto">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload FSD (PDF, DOCX or TXT)"
                  className="inline-flex items-center justify-center h-7 px-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs gap-1"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Plus style={{ width: 13, height: 13 }} />
                  <span className="hidden xs:inline text-[11px] font-medium">Attach</span>
                </button>

                <div
                  title="Engine is selected automatically — AI when configured, built-in rules fallback"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] text-zinc-400"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Auto
                  <ChevronDownIcon />
                </div>

                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={!selectedFile || analyzing}
                  title={selectedFile ? "Analyze requirements" : "Attach an FSD first"}
                  className={
                    "ml-auto inline-flex items-center justify-center h-7 w-7 sm:w-auto sm:px-3 rounded-full text-xs font-medium transition-colors " +
                    (selectedFile && !analyzing
                      ? "bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer"
                      : "bg-white/[0.06] text-zinc-500 cursor-not-allowed")
                  }
                >
                  {analyzing ? (
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                  ) : (
                    <>
                      <ArrowUpIcon />
                      <span className="hidden sm:inline ml-1 text-[11px]">Analyze</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        {/* Quick capability hints below composer */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] text-zinc-500">
          <span>Supported:</span>
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-zinc-400">PDF</span>
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-zinc-400">DOCX</span>
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-zinc-400">TXT</span>
          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-zinc-400">Markdown</span>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: "rotate(90deg)" }}>
      <path d="M7 11L10 8L7 5" stroke="#8B9099" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 12.6667V3.33333M12.6667 8L8 3.33333L3.33333 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
