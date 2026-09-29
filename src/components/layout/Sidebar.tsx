"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  Bug,
  BarChart3,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  hasTestCases?: boolean;
  hasAutomationScript?: boolean;
  hasRunResult?: boolean;
  testCasesCount?: number;
  bugsCount?: number;
}

export function Sidebar({
  mobileOpen = false,
  onCloseMobile,
  hasTestCases = false,
  hasAutomationScript = false,
  hasRunResult = false,
  testCasesCount = 0,
  bugsCount = 0,
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
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-[#0d121f]/95 backdrop-blur-md shadow-2xl transition-all duration-300 ease-in-out",
          isExpanded ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-slate-800/70 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20 text-white font-bold">
              <ShieldCheck className="h-5 w-5" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0d121f]" />
            </div>

            <div
              className={cn(
                "flex flex-col whitespace-nowrap transition-all duration-200 overflow-hidden",
                isExpanded ? "opacity-100 max-w-[180px]" : "opacity-0 max-w-0 pointer-events-none"
              )}
            >
              <span className="font-semibold text-white tracking-tight text-base flex items-center gap-1.5">
                TestForge <span className="text-blue-400 font-bold">AI</span>
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                QA Automation
              </span>
            </div>
          </div>

          {/* Close button visible on mobile */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
              aria-label="Close Navigation"
            >
              <X className="h-4 w-4" />
            </button>
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
                    ? "bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/25 shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"
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
                      "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap",
                      item.badge === "Live"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse"
                        : item.name === "Bugs"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700/60"
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
