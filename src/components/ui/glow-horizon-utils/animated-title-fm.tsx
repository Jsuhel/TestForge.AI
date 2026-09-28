"use client";

import { motion, type Variants } from "framer-motion";

// Same curve as glow-horizon.tsx so the title reveal feels part of the horizon.
const EASE = [0.16, 1, 0.3, 1] as const;

const wordVariants: Variants = {
  hidden: { y: "110%", opacity: 0, filter: "blur(8px)" },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: EASE, delay: 0.35 + i * 0.09 },
  }),
};

const subtitleVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: EASE, delay: 0.9 },
  },
};

export interface AnimatedTitleFMProps {
  /** Plays the reveal when true (mirrors the demo's `open={true}` usage). */
  open?: boolean;
  /** Headline rendered with the staggered word-by-word reveal. */
  title?: string;
  /** Subtitle revealed underneath the headline. */
  subtitle?: string;
  /** Words of `title` rendered with the brand gradient (matched by word). */
  accent?: string;
  className?: string;
}

export function AnimatedTitleFM({
  open = true,
  title = "Welcome to TestForge AI",
  subtitle = "From Requirements to Reliable Testing",
  accent = "TestForge AI",
  className,
}: AnimatedTitleFMProps) {
  const words = title.split(" ");
  const accentWords = accent ? new Set(accent.split(" ")) : new Set<string>();
  const state = open ? "show" : "hidden";

  return (
    <div className={"flex w-full flex-col items-center text-center " + (className ?? "")}>
      <motion.h1
        initial="hidden"
        animate={state}
        className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
      >
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-1 -mb-1 align-bottom">
            <motion.span
              custom={i}
              variants={wordVariants}
              className={
                "inline-block will-change-transform " +
                (accentWords.has(word)
                  ? "tf-gradient-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent"
                  : "")
              }
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.h1>

      {subtitle && (
        <motion.p
          initial="hidden"
          animate={state}
          variants={subtitleVariants}
          className="mt-4 text-balance text-base font-medium text-slate-200/90 sm:text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
