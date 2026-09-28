import React from "react";
import {
  UploadCloud,
  Sparkles,
  PlayCircle,
  Bug,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActionItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

export function QuickActions({
  onUploadClick,
}: {
  onUploadClick?: () => void;
}) {
  const actions: ActionItem[] = [
    {
      title: "Upload FSD",
      description: "Ingest PRD or FSD documents to extract testable specifications",
      icon: UploadCloud,
      color: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
      badge: "Fast Track",
    },
    {
      title: "Generate Test Scenario",
      description: "Synthesize edge-case matrices and Gherkin step definitions",
      icon: Sparkles,
      color: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
      badge: "AI Powered",
    },
    {
      title: "View Executions",
      description: "Inspect live pipeline telemetry and browser regression runs",
      icon: PlayCircle,
      color: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
    },
    {
      title: "View Bugs",
      description: "Review open failure tickets and auto-triaged regressions",
      icon: Bug,
      color: "from-rose-500/20 to-rose-600/5 text-rose-400 border-rose-500/20",
      badge: "7 Open",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <div
            key={action.title}
            onClick={() => {
              if (action.title === "Upload FSD" && onUploadClick) {
                onUploadClick();
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 hover:border-slate-700/90 hover:bg-slate-900/90 transition-all cursor-pointer shadow-xs"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-b transition-transform group-hover:scale-105",
                    action.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {action.badge && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                    {action.badge}
                  </span>
                )}
              </div>

              <h4 className="mt-3 text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                {action.title}
              </h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                {action.description}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-blue-400 transition-colors">
              <span>Execute Action</span>
              <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
