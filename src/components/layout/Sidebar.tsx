"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  Bug,
  BarChart3,
  MessageCircle,
  X,
  Plus,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import type { SessionSummary } from "@/lib/session-store";

interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  target: string;
  visible: boolean;
}

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  /** Pipeline progress flags for dynamic visibility */
  hasAnalysis?: boolean;
  hasTestCases?: boolean;
  hasAutomationScript?: boolean;
  hasRunResult?: boolean;
  testCasesCount?: number;
  bugsCount?: number;
  /** Saved project sessions, newest first — the persistent history. */
  sessions?: SessionSummary[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onNewSession?: () => void;
  onDeleteSession?: (id: string) => void;
}

/** Compact relative time for the history rows. */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function Sidebar({
  mobileOpen = false,
  onCloseMobile,
  hasAnalysis = false,
  hasTestCases = false,
  hasAutomationScript = false,
  hasRunResult = false,
  testCasesCount = 0,
  bugsCount = 0,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: SidebarProps) {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [isHovered, setIsHovered] = useState(false);

  // Dynamic Navigation Items based on current pipeline stage
  const navigationItems: NavItem[] = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      target: "fsd-upload-section",
      visible: true, // Always visible
    },
    {
      id: "fsd-chat",
      name: "FSD Chat",
      icon: MessageCircle,
      target: "chat-section",
      visible: hasAnalysis, // Appears once a document has been analyzed
    },
    {
      id: "testcases",
      name: "Test Cases",
      icon: ListChecks,
      badge: testCasesCount > 0 ? testCasesCount : undefined,
      target: "testcases-section",
      visible: hasTestCases, // Appears when test cases are generated
    },
    {
      id: "executions",
      name: "Executions",
      icon: PlayCircle,
      badge: "Live",
      target: "automation-section",
      visible: hasAutomationScript, // Appears when automation script is generated
    },
    {
      id: "bugs",
      name: "Bugs",
      icon: Bug,
      badge: bugsCount > 0 ? bugsCount : undefined,
      target: "automation-section",
      visible: bugsCount > 0, // Appears when bugs/failures are detected in execution
    },
    {
      id: "reports",
      name: "Reports",
      icon: BarChart3,
      badge: hasRunResult ? "Ready" : undefined,
      target: "automation-section",
      visible: hasRunResult, // Appears when execution/screenshots finish
    },
  ];

  const visibleItems = navigationItems.filter((item) => item.visible);

  const handleNavClick = (item: NavItem) => {
    setActiveItem(item.name);
    if (item.target) {
      const el = document.getElementById(item.target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    if (mobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const isExpanded = isHovered || mobileOpen;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Invisible spacer on desktop to reserve the w-16 gutter so content doesn't shift */}
      <div className="hidden lg:block w-16 shrink-0 transition-all duration-300 ease-in-out" />

      {/* Floating Shutter Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#101012] transition-all duration-300 ease-in-out",
          isExpanded ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-zinc-800/70 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="TestForge AI logo"
              className="h-9 w-9 shrink-0 rounded-xl select-none"
              draggable={false}
            />

            <div
              className={cn(
                "flex flex-col whitespace-nowrap transition-all duration-200 overflow-hidden",
                isExpanded ? "opacity-100 max-w-[180px]" : "opacity-0 max-w-0 pointer-events-none"
              )}
            >
              <span className="font-semibold text-zinc-100 tracking-tight text-base flex items-center gap-1.5">
                TestForge <span className="text-zinc-500 font-medium">AI</span>
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                QA Automation
              </span>
            </div>
          </div>

          {/* Close button visible on mobile */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white shrink-0"
              aria-label="Close Navigation"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Projects history — every analyzed FSD is saved here and survives refresh */}
        <div className="px-2 py-3">
          <button
            onClick={() => {
              onNewSession?.();
              if (mobileOpen && onCloseMobile) onCloseMobile();
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all text-left",
              "text-zinc-300 hover:bg-zinc-800/60 hover:text-white",
            )}
            title={!isExpanded ? "New project" : undefined}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              <AnimatedIcon icon={Plus} size={20} className="text-zinc-300" />
            </div>
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-200 overflow-hidden",
                isExpanded ? "opacity-100 max-w-[140px] flex-1" : "opacity-0 max-w-0 pointer-events-none",
              )}
            >
              New project
            </span>
          </button>

          {sessions.length > 0 && (
            <>
              <div
                className={cn(
                  "mt-2 mb-1 px-2.5 transition-all duration-200 overflow-hidden",
                  isExpanded ? "opacity-100 max-h-8" : "opacity-0 max-h-0",
                )}
              >
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                  History
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer",
                        isActive ? "bg-zinc-800/90" : "hover:bg-zinc-800/50",
                      )}
                      onClick={() => {
                        onSelectSession?.(session.id);
                        if (mobileOpen && onCloseMobile) onCloseMobile();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectSession?.(session.id);
                          if (mobileOpen && onCloseMobile) onCloseMobile();
                        }
                      }}
                      title={session.title}
                    >
                      <FileText
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-zinc-300" : "text-zinc-500 group-hover:text-zinc-300",
                        )}
                      />
                      <div
                        className={cn(
                          "min-w-0 flex-1 transition-all duration-200 overflow-hidden",
                          isExpanded ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0 pointer-events-none",
                        )}
                      >
                        <div
                          className={cn(
                            "truncate text-[13px] leading-tight",
                            isActive ? "text-white font-medium" : "text-zinc-300",
                          )}
                        >
                          {session.title}
                        </div>
                        <div className="truncate text-[10px] leading-tight text-zinc-500 mt-0.5">
                          {timeAgo(session.updatedAt)}
                          {session.chatCount > 0 && ` · ${session.chatCount} chat`}
                          {session.testCasesCount > 0 && ` · ${session.testCasesCount} TC`}
                        </div>
                      </div>
                      {isExpanded && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession?.(session.id);
                          }}
                          className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-opacity hover:bg-zinc-700/60 hover:text-rose-400 focus:opacity-100 group-hover:opacity-100"
                          aria-label={`Delete project ${session.title}`}
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Navigation Section — dynamic items based on pipeline progress */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all text-left",
                  isActive
                    ? "text-white"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {/* Same Lucide icons as before, wrapped in the AnimateIcons
                      hover animation (scale pop + gentle rotate, reduced-motion safe). */}
                  <AnimatedIcon
                    icon={Icon}
                    size={20}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                    )}
                  />
                </div>

                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 overflow-hidden",
                    isExpanded
                      ? "opacity-100 max-w-[140px] flex-1"
                      : "opacity-0 max-w-0 pointer-events-none"
                  )}
                >
                  {item.name}
                </span>

                {item.badge && isExpanded && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                      item.badge === "Live"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : item.name === "Bugs"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
