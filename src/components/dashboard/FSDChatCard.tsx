"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, User, MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import type { ChatMessage, RequirementAnalysis } from "@/lib/types";

export interface FSDChatCardProps {
  analysis: RequirementAnalysis;
  /** Conversation is owned by the parent so it persists across refreshes. */
  messages: ChatMessage[];
  /** setState-compatible updater — the parent passes setMessages directly. */
  onMessagesChange: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Engine badge restored from the saved session, if any. */
  initialEngineLabel?: string | null;
  /** Notifies the parent of the serving engine so it persists with the session. */
  onEngineLabelChange?: (label: string) => void;
}

/** Starter questions shown before the first message is sent. */
const SUGGESTIONS = [
  "Explain this FSD in simple words",
  "What are the high-priority requirements?",
  "Which modules have validation rules?",
  "What user journeys does the document describe?",
];

export function FSDChatCard({ analysis, messages, onMessagesChange, initialEngineLabel, onEngineLabelChange }: FSDChatCardProps) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineLabel, setEngineLabel] = useState<string | null>(initialEngineLabel ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;

    setError(null);
    setInput("");
    const history = messages;
    onMessagesChange([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, messages: history, question: q }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.answer) {
        // Drop the empty assistant placeholder and surface the error.
        onMessagesChange((prev) => prev.slice(0, -1));
        setError(data?.error ?? `The chat failed (${response.status}). Please try again.`);
        return;
      }

      if (data.engineLabel) {
        setEngineLabel(data.engineLabel as string);
        onEngineLabelChange?.(data.engineLabel as string);
      }
      onMessagesChange((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: data.answer as string };
        return next;
      });
    } catch {
      onMessagesChange((prev) => prev.slice(0, -1));
      setError("Network error while contacting the AI. Please try again.");
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter adds a newline — standard chat behavior.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="rounded-xl bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
            <MessageCircle className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">
              Ask about this FSD
            </p>
            <p className="text-[11px] text-zinc-500 leading-tight">
              {engineLabel
                ? `Chatting with ${engineLabel} about ${analysis.documentName}`
                : `Clarify anything in ${analysis.documentName}`}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onMessagesChange([]);
              setError(null);
            }}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        className="px-5 sm:px-7 py-6 max-h-[28rem] overflow-y-auto space-y-5"
      >
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
              <Bot className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Any doubts about <span className="text-zinc-200 font-medium">{analysis.documentName}</span>?
              Ask and the AI will explain the FSD — requirements, rules, flows — directly from the analysis.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full bg-zinc-800 px-3.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-2.5">
                <div className="rounded-2xl rounded-tr-sm bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 whitespace-pre-wrap">
                  {m.content}
                </div>
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="flex max-w-[92%] items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                  <Bot className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-300">
                  {m.content ? (
                    <RichText text={m.content} />
                  ) : (
                    <span className="flex items-center gap-2 text-zinc-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking…
                    </span>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {/* Error line */}
      {error && (
        <div className="mx-5 sm:mx-7 mb-3 flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-zinc-900 px-5 sm:px-7 py-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask anything about this FSD… (Enter to send)"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-zinc-700/70 bg-zinc-800/40 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500/60 focus:outline-none focus:ring-1 focus:ring-zinc-400/40"
          />
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={() => void send(input)}
            disabled={thinking || !input.trim()}
            className="h-11 w-11 shrink-0"
            aria-label="Send message"
          >
            {thinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
