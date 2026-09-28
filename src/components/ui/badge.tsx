import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "destructive" | "warning" | "info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    secondary: "bg-slate-800/80 text-slate-300 border-slate-700/60",
    outline: "border-slate-700 text-slate-400",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    destructive: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
