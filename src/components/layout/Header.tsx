"use client";

import React from "react";
import { Menu } from "lucide-react";

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-[#0a0a0b] px-4 sm:px-6 lg:px-8">
      {/* Left side: Mobile menu toggle + Title & Description */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-100">
            Dashboard
          </h2>
          <p className="hidden md:block truncate text-xs text-zinc-500">
            Test automation from requirements to execution
          </p>
        </div>
      </div>
    </header>
  );
}
