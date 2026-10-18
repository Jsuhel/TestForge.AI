"use client";

import React from "react";

/**
 * Brand floating action button — the TestForge logo mark pinned to the
 * bottom-right corner. Replaces the Next.js dev-tools bubble. Tapping it
 * returns to the top of the page (handy on this long scroll).
 */
export function BrandFab() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700/80 bg-[#0d121f] shadow-lg shadow-black/40 transition-all hover:border-blue-500/50 hover:scale-105 active:scale-95 cursor-pointer"
    >
      {/* The logo fills the whole button, clipped to the circle — a single
          round chip instead of a square icon floating inside a ring. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fab-logo.png"
        alt=""
        aria-hidden
        className="h-full w-full rounded-full object-cover select-none pointer-events-none"
        draggable={false}
      />
    </button>
  );
}
