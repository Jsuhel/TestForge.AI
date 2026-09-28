"use client";

import React from "react";
import { Menu, Sparkles, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-[#090d16]/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left side: Mobile menu toggle + Title & Description */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/60 hover:text-white"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Dashboard
            </h1>
            <Badge variant="info" className="hidden sm:inline-flex text-[10px]">
              <Sparkles className="h-3 w-3" />
              v1.0 Live
            </Badge>
          </div>
          <p className="hidden md:block truncate text-xs text-slate-400">
            AI-powered test automation from requirements to execution
          </p>
        </div>
      </div>

      {/* Right side: Aesthetic Founder profile */}
      <div className="flex items-center gap-3">
        <div className="group flex items-center gap-2.5 rounded-full border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-[#0e1628]/80 to-slate-900/90 py-1 pl-1.5 pr-3.5 shadow-sm shadow-black/40 backdrop-blur-md hover:border-slate-700/80 transition-all">
          {/* Avatar with initials & active pulse indicator */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 font-bold text-white text-[11px] shadow-sm shadow-blue-500/30">
            JS
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#090d16]" />
          </div>

          {/* Founder Name & Title */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-white tracking-wide group-hover:text-blue-200 transition-colors">
                J SUHEL
              </span>
            </div>

            <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-300 shadow-2xs">
              <Crown className="h-2.5 w-2.5 text-amber-400" />
              Founder
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
