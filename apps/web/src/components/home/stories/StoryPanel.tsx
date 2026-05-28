"use client";

import type React from "react";
import type {
  Story,
  StoryDetail,
  StorySlide,
  SlideWithProducts,
} from "@/lib/hooks/useStory";

/** Premium shimmer loader shown while media is fetching. */
function StoryLoader() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
      {/* Shimmer wash */}
      <div
        className="story-loader-shimmer absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* Spinner ring */}
      <div className="story-loader-ring w-12 h-12 rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

interface StoryPanelProps {
  story: Story;
  detail?: StoryDetail | null;
  /** Slides to display — pass story.slides for peek panels, detail.slides for active */
  slides: (StorySlide | SlideWithProducts)[];
  slideIdx: number;
  /** 0–1 progress for current slide */
  progress: number;
  isActive: boolean;
  isLoading: boolean;
  onLoad: () => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Single story panel — media + active overlay (progress bars + avatar/name).
 * Products UI is managed at the viewer level, not here.
 */
export function StoryPanel({
  story,
  slides,
  slideIdx,
  progress,
  isActive,
  isLoading,
  onLoad,
  videoRef,
}: StoryPanelProps) {
  const slide = slides[slideIdx];
  const isVideo = slide?.mediaType === "video";

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[inherit] bg-black select-none">
      {/* ── Media ─────────────────────────────────────────────────── */}
      {slide ? (
        isVideo ? (
          <video
            ref={
              isActive
                ? (videoRef as React.RefObject<HTMLVideoElement>)
                : undefined
            }
            src={slide.mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            autoPlay={isActive}
            onLoadedData={onLoad}
          />
        ) : (
          <img
            src={slide.mediaUrl}
            alt={story.name}
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={onLoad}
          />
        )
      ) : story.thumbnailUrl ? (
        <img
          src={story.thumbnailUrl}
          alt={story.name}
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={onLoad}
        />
      ) : null}

      {/* Premium loader */}
      {isActive && isLoading && <StoryLoader />}

      {/* Gradient vignette — only on active */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/20 pointer-events-none" />
      )}

      {/* ── Active overlay: progress bars + avatar + name ─────────── */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 z-10 px-[17px] pt-[10px] flex flex-col gap-[10px]">
          {/* Progress bars — Figma: 4px tall, white track */}
          <div className="flex gap-[4px]">
            {slides.map((s, i) => (
              <div
                key={s.id}
                className="flex-1 h-[4px] rounded-full bg-white/30 overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width:
                      i < slideIdx
                        ? "100%"
                        : i === slideIdx
                          ? `${progress * 100}%`
                          : "0%",
                    transition: "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Avatar + story name — Figma: 70px avatar, Inter Bold 15px white */}
          <div className="flex items-center gap-2">
            <span className="w-[40px] h-[40px] rounded-full overflow-hidden bg-white/10 shrink-0 ring-2 ring-white/30">
              {story.thumbnailUrl && (
                <img
                  src={story.thumbnailUrl}
                  alt={story.name}
                  className="w-full h-full object-cover"
                />
              )}
            </span>
            <span className="text-white text-[15px] font-bold leading-none drop-shadow">
              {story.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
