"use client";

import { useRef, useState, useCallback } from "react";

// Shared CSS values for the left-edge mask that hides cards already scrolled past
const LEFT_EDGE = "max(16px, calc((100vw - 1240px) / 2 + 16px))";
const MASK = `linear-gradient(to right, transparent 0, transparent ${LEFT_EDGE}, black ${LEFT_EDGE}, black 100%)`;

interface HorizontalScrollProps {
  children: React.ReactNode;
  /** Extra classes on the outer overflow-hidden wrapper (e.g. "-mt-3 md:-mt-9" or "hidden md:block") */
  wrapperClassName?: string;
  /** Extra classes on the progress bar row */
  progressClassName?: string;
}

/**
 * Full-bleed horizontally scrollable strip with a scroll-progress bar.
 * Breaks out of the container-web constraint without causing page-level
 * horizontal overflow, and clips scrolled-past content at the container edge.
 */
export function HorizontalScroll({
  children,
  wrapperClassName = "",
  progressClassName = "",
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  // Indicator fills from current position to end of visible area
  const indicatorPct = Math.min(
    Math.max(
      scrollPct * 100 +
        (scrollRef.current
          ? (scrollRef.current.clientWidth / scrollRef.current.scrollWidth) *
            100
          : 30),
      10,
    ),
    100,
  );

  return (
    <>
      {/* Full-bleed clip wrapper */}
      <div
        className={`overflow-hidden ${wrapperClassName}`}
        style={{
          marginLeft: "calc(50% - 50vw)",
          width: "100vw",
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-[5px] overflow-x-auto no-scrollbar overscroll-x-contain"
          style={{
            paddingLeft: LEFT_EDGE,
            paddingRight: 5,
          }}
        >
          {children}
        </div>
      </div>

      {/* Scroll progress bar */}
      <div
        className={`mt-4 h-[5px] bg-gray-100 overflow-hidden rounded-full ${progressClassName}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${indicatorPct}%`,
            background: "rgba(16, 87, 142, 0.31)",
          }}
        />
      </div>
    </>
  );
}
