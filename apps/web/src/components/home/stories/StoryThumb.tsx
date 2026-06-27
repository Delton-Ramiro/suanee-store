"use client";

import type { Story } from "@/lib/hooks/useStory";

/**
 * Exact gradient from Figma SVG (node 2039:127 — "Story ring")
 * linearGradient: #356E99 (top-right) → #DDDDDD (50%) → #FECD00 (bottom-left)
 * SVG coords: x1=127.105 y1=12.1053 → x2=0 y2=89.2763 (within 115×115 viewBox)
 */
const UNSEEN_RING =
  "linear-gradient(to bottom left, #356E99 0%, #DDDDDD 50%, #FECD00 100%)";
const SEEN_RING = "#d9d9d9";

export function StoryThumb({
  story,
  seen,
  onClick,
}: {
  story: Story;
  seen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 shrink-0 focus:outline-none cursor-pointer"
      aria-label={`Abrir story: ${story.name}`}
    >
      {/* Gradient ring — 2px stroke */}
      <span
        className="block rounded-full shrink-0"
        style={{ padding: "2px", background: seen ? SEEN_RING : UNSEEN_RING }}
      >
        {/* White separator gap */}
        <span
          className="block rounded-full bg-white"
          style={{ padding: "3px" }}
        >
          {/* Avatar — 60px */}
          <span className="block w-[60px] h-[60px] rounded-full overflow-hidden bg-muted-bg">
            {story.thumbnailUrl ? (
              <img
                src={story.thumbnailUrl}
                alt={story.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="block w-full h-full bg-muted-bg" />
            )}
          </span>
        </span>
      </span>
      {/* Label */}
      <span className="text-[12px] font-medium text-brand max-w-[74px] truncate leading-none text-center">
        {story.name}
      </span>
    </button>
  );
}
