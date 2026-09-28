import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  color?: "blue" | "emerald" | "purple" | "rose" | "amber";
  /** Tighter layout for the hero first fold. */
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "positive",
  icon: Icon,
  description,
  color = "blue",
  compact = false,
}: StatCardProps) {
  const iconColorStyles = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80 transition-all duration-200 group",
        compact ? "p-3.5" : "p-5"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
          {title}
        </span>
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border transition-transform group-hover:scale-105",
            compact ? "h-7 w-7" : "h-9 w-9",
            iconColorStyles[color]
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>
      </div>

      <div className={cn("flex items-baseline gap-2.5", compact ? "mt-1.5" : "mt-3")}>
        <span
          className={cn(
            "font-bold tracking-tight text-white",
            compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
          )}
        >
          {value}
        </span>

        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5",
              changeType === "positive" && "text-emerald-400 bg-emerald-500/10",
              changeType === "negative" && "text-rose-400 bg-rose-500/10",
              changeType === "neutral" && "text-slate-400 bg-slate-800"
            )}
          >
            {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
            {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
            {changeType === "neutral" && <Minus className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>

      {description && !compact && (
        <p className="mt-2 text-[11px] text-slate-400 leading-normal">
          {description}
        </p>
      )}
    </Card>
  );
}
