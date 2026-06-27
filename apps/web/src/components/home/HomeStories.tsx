"use client";

import { useState, useCallback, useEffect } from "react";
import { StoryThumb } from "./stories/StoryThumb";
import { StoryViewer } from "./stories/StoryViewer";
import type { Story } from "@/lib/hooks/useStory";

export type { Story };

// ─── LocalStorage seen tracking ──────────────────────────────────────────────

const SEEN_KEY = "suanee_seen_stories";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const ids = getSeenIds();
    ids.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {}
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HomeStories({ stories }: { stories: Story[] }) {
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Hydrate seen state from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    setSeenIds(getSeenIds());
  }, []);

  const handleMarkSeen = useCallback((id: string) => {
    markSeen(id);
    setSeenIds((prev) => new Set([...prev, id]));
  }, []);

  if (!stories.length) return null;

  return (
    <>
      {/* ── Story strip ──────────────────────────────────────────── */}
      <section
        aria-label="Stories"
        className="w-full overflow-x-auto no-scrollbar py-4"
      >
        {/*
          Figma: gap-[41px], horizontally centered on desktop.
          On mobile: starts flush left with some padding so first item is fully visible.
        */}
        <div className="flex items-center gap-[41px] px-4 md:justify-center">
          {stories.map((story, idx) => (
            <StoryThumb
              key={story.id}
              story={story}
              seen={seenIds.has(story.id)}
              onClick={() => setActiveIdx(idx)}
            />
          ))}
        </div>
      </section>

      {/* ── Overlay viewer ───────────────────────────────────────── */}
      {activeIdx !== null && (
        <StoryViewer
          stories={stories}
          initialIdx={activeIdx}
          onClose={() => setActiveIdx(null)}
          onMarkSeen={handleMarkSeen}
        />
      )}
    </>
  );
}
