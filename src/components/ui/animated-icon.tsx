// Animated icon wrapper — animation pattern from AnimateIcons / Lucide
// (https://animateicons.in, Author: Avijit Dey @avijit07x, MIT).
// Adapted for this project: motion/react -> framer-motion, and generalized so
// ANY Lucide icon keeps its exact look while gaining the hover animation.

"use client";

import { cn } from "@/lib/utils";
import type { Variants } from "framer-motion";
import {
  LazyMotion,
  domMin,
  m,
  useAnimation,
  useReducedMotion,
} from "framer-motion";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface AnimatedIconProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | "color"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> {
  /** Any Lucide icon component — rendered unchanged, animated as a whole. */
  icon: React.ComponentType<{
    className?: string;
    color?: string;
    strokeWidth?: number;
    width?: number | string;
    height?: number | string;
  }>;
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  color?: string;
  strokeWidth?: number;
}

const AnimatedIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      icon: Icon,
      size = 24,
      duration = 0.6,
      isAnimated = true,
      color,
      strokeWidth,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, onMouseLeave],
    );

    // Same wiggle as the AnimateIcons layout-dashboard: a soft pop with a
    // slight counter-rotation, easeInOut — subtle enough for a sidebar.
    const iconVariants: Variants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.06, 0.98, 1],
        rotate: [0, -1.5, 1.5, 0],
        transition: { duration: 1.1 * duration, ease: "easeInOut" },
      },
    };

    return (
      <LazyMotion features={domMin} strict>
        <m.div
          className={cn("inline-flex items-center justify-center", className)}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          {...props}
          style={{ color, ...props.style }}
        >
          <m.div animate={controls} initial="normal" variants={iconVariants}>
            <Icon
              width={size}
              height={size}
              color={color}
              strokeWidth={strokeWidth}
            />
          </m.div>
        </m.div>
      </LazyMotion>
    );
  },
);

AnimatedIcon.displayName = "AnimatedIcon";
export { AnimatedIcon };
