import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "destructive" | "warning" | "info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-zinc-800 text-zinc-300",
    secondary: "bg-zinc-800/80 text-zinc-300",
    outline: "text-zinc-400",
    success: "bg-emerald-500/10 text-emerald-400",
    destructive: "bg-rose-500/10 text-rose-400",
    warning: "bg-amber-500/10 text-amber-400",
    info: "bg-zinc-800 text-zinc-300",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
