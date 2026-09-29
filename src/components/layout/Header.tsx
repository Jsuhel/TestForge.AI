"use client";

import React from "react";
import { Menu, Sparkles } from "lucide-react";
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
    </header>
  );
}
