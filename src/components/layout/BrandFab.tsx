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
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
    >
      {/* The logo is the button — its own rounded indigo square fills the
          chip edge-to-edge, no ring around it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.svg"
        alt=""
        aria-hidden
        className="h-full w-full object-cover select-none pointer-events-none"
        draggable={false}
      />
    </button>
  );
}
