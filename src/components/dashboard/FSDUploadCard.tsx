"use client";

import React, { useRef, useState } from "react";
import {
  AtSign,
  Plus,
  X,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";


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
  background: "rgba(255,255,255,0.04)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 0 rgba(255,255,255,0.04)",
};

const ICON_GRAY = "#808388";

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
    <div className="space-y-3">
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
        />

        {/* Chat-style FSD composer wrapped in the animated beam border */}
        <BorderBeam size="md" colorVariant="colorful" className="mx-auto block w-full max-w-[520px]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              width: "100%",
              maxWidth: 520,
              margin: "0 auto",
              borderRadius: 16,
              background: dragOver ? "#1c2230" : "#161a22",
              overflow: "hidden",
              position: "relative",
            }}
          >
          <div style={{ padding: "6px 6px 7px", display: "flex", flexDirection: "column", minHeight: 92 }}>
            {/* Top chip — the attached FSD, or a decorative @ */}
            {selectedFile ? (
              <div
                style={{
                  ...CHIP,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: "fit-content",
                  maxWidth: "100%",
                  height: 24,
                  padding: "0 4px 0 8px",
                  marginLeft: 1,
                  fontSize: 11,
                  lineHeight: "13px",
                  color: "#caccd2",
                }}
              >
                <FileText style={{ width: 13, height: 13, color: "#60a5fa", flexShrink: 0 }} />
                <span style={{ maxWidth: "clamp(100px, 36vw, 220px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile.name}
                </span>
                <span style={{ color: "#6b7280", flexShrink: 0 }}>{fileSizeLabel}</span>
                <button
                  type="button"
                  onClick={() => onSelectFile(null)}
                  title="Remove file"
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
                  marginLeft: 1,
                }}
              >
                <AtSign style={{ width: 14, height: 14, color: ICON_GRAY }} />
              </div>
            )}

            {/* Input line — click (or drop a file) to attach the FSD */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 12.5,
                lineHeight: "15px",
                color: selectedFile ? "#a5adc4" : "#4e4e4e",
                padding: "10px 4px 0",
                textAlign: "left",
                cursor: "pointer",
              }}
              title="Click to browse for your FSD"
            >
              {selectedFile
                ? "FSD attached — press the arrow to analyze, then chat with the AI about it."
                : "Upload FSD and chat with AI for explanation..."}
            </button>

            {/* Bottom row — upload (+), engine (Auto), analyze (arrow) */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: "auto" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload FSD (PDF, DOCX or TXT)"
                style={{
                  ...CHIP,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 22,
                  marginLeft: 1,
                  color: "#caccd2",
                  cursor: "pointer",
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
              </button>

              <div
                title="Engine is selected automatically — Claude AI when configured, built-in rules otherwise"
                style={{
                  ...CHIP,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 22,
                  padding: "0 6px 0 7px",
                  fontSize: 11,
                  lineHeight: "13px",
                  color: "#caccd2",
                }}
              >
                Auto
                <ChevronDownIcon />
              </div>

              <button
                type="button"
                onClick={onAnalyze}
                disabled={!selectedFile || analyzing}
                title={selectedFile ? "Analyze requirements" : "Attach an FSD first"}
                style={{
                  ...CHIP,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 27,
                  height: 24,
                  marginLeft: "auto",
                  padding: "0 7px",
                  color: selectedFile && !analyzing ? "#e7eaf0" : "#565b64",
                  cursor: selectedFile && !analyzing ? "pointer" : "not-allowed",
                }}
              >
                {analyzing ? (
                  <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
                ) : (
                  <ArrowUpIcon />
                )}
              </button>
            </div>
          </div>
          </div>
        </BorderBeam>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
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
      <path d="M8 12.6667V3.33333M12.6667 8L8 3.33333L3.33333 8" stroke="#8B8B8B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
