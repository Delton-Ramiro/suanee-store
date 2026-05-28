"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type RefObject,
} from "react";
import { StoryPanel } from "./StoryPanel";
import { ProductsPanel } from "./ProductsPanel";
import { useStory } from "@/lib/hooks/useStory";
import type {
  Story,
  StorySlide,
  SlideWithProducts,
  SlideProduct,
} from "@/lib/hooks/useStory";

const IMAGE_DURATION_MS = 10_000;

type StoryCheckpoint = { slideIdx: number; elapsedMs: number };
type TransitionDir = "next" | "prev" | null;

function preloadImage(url?: string | null) {
  if (!url || typeof window === "undefined") return;
  // eslint-disable-next-line no-new
  new Image().src = url;
}

// ─── Peek panel — fills its container with the story's first image ───────────
// No onClick/side — the parent wrapper handles those.
function PeekPanel({ story }: { story: Story }) {
  const slide = story.slides[0];
  const src =
    (slide?.mediaType === "image" ? slide.mediaUrl : null) ??
    story.thumbnailUrl ??
    null;

  return (
    <div className="absolute inset-0">
      {src ? (
        <img
          src={src}
          alt={story.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-800" />
      )}
    </div>
  );
}

// ─── Products trigger button — defined OUTSIDE viewer to avoid remount bug ───
function ProductsTrigger({ onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white flex items-center justify-center gap-3 shrink-0 hover:bg-gray-50 transition-colors"
      style={{ height: 52 }}
    >
      <span className="font-bold text-brand text-[16px] leading-none">
        Ver produtos
      </span>
      <span className="text-[22px] leading-none" aria-hidden>
        👀
      </span>
    </button>
  );
}

// ─── Main viewer ─────────────────────────────────────────────────────────────

export function StoryViewer({
  stories,
  initialIdx,
  onClose,
  onMarkSeen,
}: {
  stories: Story[];
  initialIdx: number;
  onClose: () => void;
  onMarkSeen: (id: string) => void;
}) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [storyIdx, setStoryIdx] = useState(initialIdx);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [transitionDir, setTransitionDir] = useState<TransitionDir>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const holdRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productsOpenRef = useRef(false);
  const mediaLoadedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const checkpointRef = useRef(new Map<string, StoryCheckpoint>());

  // ── Sync mutable mirrors ────────────────────────────────────────────────────
  useEffect(() => {
    productsOpenRef.current = productsOpen;
  }, [productsOpen]);
  useEffect(() => {
    mediaLoadedRef.current = mediaLoaded;
  }, [mediaLoaded]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const story = stories[storyIdx];
  const prevStory = storyIdx > 0 ? stories[storyIdx - 1] : null;
  const nextStory =
    storyIdx < stories.length - 1 ? stories[storyIdx + 1] : null;

  const { data: detail, isLoading: detailLoading } = useStory(
    story?.id ?? null,
  );

  const slides = useMemo<(StorySlide | SlideWithProducts)[]>(
    () => detail?.slides ?? story?.slides ?? [],
    [detail, story],
  );
  const slide = slides[slideIdx];
  const isVideo = slide?.mediaType === "video";

  const slideProducts: SlideProduct[] = useMemo(() => {
    if (!detail) return [];
    const s = detail.slides[slideIdx];
    return s?.products ?? [];
  }, [detail, slideIdx]);
  const hasProducts = slideProducts.length > 0;

  // ── Prefetching ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ps = prevStory?.slides?.[0];
    if (ps?.mediaType === "image") preloadImage(ps.mediaUrl);
    const ns = nextStory?.slides?.[0];
    if (ns?.mediaType === "image") preloadImage(ns.mediaUrl);
    const n1 = slides[slideIdx + 1];
    if (n1?.mediaType === "image") preloadImage(n1.mediaUrl);
    const n2 = slides[slideIdx + 2];
    if (n2?.mediaType === "image") preloadImage(n2.mediaUrl);
  }, [storyIdx, slideIdx, prevStory, nextStory, slides]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const saveCheckpoint = useCallback(() => {
    if (story) {
      checkpointRef.current.set(story.id, {
        slideIdx,
        elapsedMs: elapsedRef.current,
      });
    }
  }, [story, slideIdx]);

  const goToStory = useCallback(
    (idx: number, dir: TransitionDir = "next") => {
      saveCheckpoint();
      stopRaf();
      const target = stories[idx];
      const cp = target ? checkpointRef.current.get(target.id) : undefined;
      holdRef.current = false;
      startTsRef.current = null;
      elapsedRef.current = cp?.elapsedMs ?? 0;
      setTransitionDir(dir);
      setStoryIdx(idx);
      setSlideIdx(cp?.slideIdx ?? 0);
      setProgress(0);
      setMediaLoaded(false);
      setProductsOpen(false);
    },
    [saveCheckpoint, stopRaf, stories],
  );

  // Stable goNext ref so RAF closure always uses the latest
  const goNextCb = useCallback(() => {
    stopRaf();
    startTsRef.current = null;
    holdRef.current = false;
    if (slide?.id) {
      /* slide seen */
    }
    const nextSlide = slideIdx + 1;
    if (nextSlide < slides.length) {
      elapsedRef.current = 0;
      setSlideIdx(nextSlide);
      setProgress(0);
      setMediaLoaded(false);
      setProductsOpen(false);
    } else {
      if (story) {
        onMarkSeen(story.id);
        checkpointRef.current.delete(story.id);
      }
      if (storyIdx + 1 < stories.length) {
        goToStory(storyIdx + 1, "next");
      } else {
        onClose();
      }
    }
  }, [
    stopRaf,
    slideIdx,
    slides.length,
    slide?.id,
    story,
    storyIdx,
    stories.length,
    onMarkSeen,
    onClose,
    goToStory,
  ]);

  const goNextRef = useRef(goNextCb);
  useEffect(() => {
    goNextRef.current = goNextCb;
  }, [goNextCb]);

  const goNext = goNextCb;

  const goPrev = useCallback(() => {
    stopRaf();
    startTsRef.current = null;
    holdRef.current = false;
    setProductsOpen(false);
    if (slideIdx > 0) {
      elapsedRef.current = 0;
      setSlideIdx((s) => s - 1);
      setProgress(0);
      setMediaLoaded(false);
    } else if (storyIdx > 0) {
      goToStory(storyIdx - 1, "prev");
    }
  }, [stopRaf, slideIdx, storyIdx, goToStory]);

  // ── Image RAF progress ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!slide || isVideo) return;
    stopRaf();
    startTsRef.current = null;

    function tick(ts: number) {
      const paused =
        holdRef.current || productsOpenRef.current || !mediaLoadedRef.current;
      if (paused) {
        startTsRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!startTsRef.current) startTsRef.current = ts - elapsedRef.current;
      const elapsed = ts - startTsRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(elapsed / IMAGE_DURATION_MS, 1);
      setProgress(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        elapsedRef.current = 0;
        goNextRef.current();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return stopRaf;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, isVideo, mediaLoaded]);

  // ── Video progress ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isVideo) return;
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    if (!holdRef.current && !productsOpenRef.current)
      vid.play().catch(() => {});
    const onTime = () => {
      if (vid.duration) setProgress(vid.currentTime / vid.duration);
    };
    const onEnded = () => goNextRef.current();
    const onLoaded = () => {
      setMediaLoaded(true);
      if (!holdRef.current && !productsOpenRef.current)
        vid.play().catch(() => {});
    };
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("ended", onEnded);
    vid.addEventListener("loadeddata", onLoaded);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("ended", onEnded);
      vid.removeEventListener("loadeddata", onLoaded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, isVideo]);

  useEffect(() => {
    if (!isVideo) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (holdRef.current || productsOpen) vid.pause();
    else vid.play().catch(() => {});
  }, [productsOpen, isVideo]);

  // ── Hold-to-pause ───────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    holdTimerRef.current = setTimeout(() => {
      holdRef.current = true;
      videoRef.current?.pause();
    }, 150);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdRef.current) {
      holdRef.current = false;
      if (!productsOpenRef.current) videoRef.current?.play().catch(() => {});
    }
  }, []);

  const handlePointerCancel = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdRef.current = false;
  }, []);

  // ── Tap: left 35% = prev, right 65% = next ─────────────────────────────────

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (holdRef.current) return;
      // If products panel is open, tapping the story closes it and resumes
      if (productsOpen) {
        setProductsOpen(false);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.35) goPrev();
      else goNext();
    },
    [productsOpen, goPrev, goNext],
  );

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      else if (ev.key === "ArrowRight") goNext();
      else if (ev.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  // ── Checkpoint restore on mount ─────────────────────────────────────────────

  useEffect(() => {
    const cp = story ? checkpointRef.current.get(story.id) : undefined;
    if (cp) {
      setSlideIdx(cp.slideIdx);
      elapsedRef.current = cp.elapsedMs;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!story) return null;

  const animClass =
    transitionDir === "next"
      ? "story-enter-next"
      : transitionDir === "prev"
        ? "story-enter-prev"
        : "";

  // ── Shared active story panel ─────────────────────────────────────────────
  // Lives inside the absolute slot assigned by the parent layout.
  // Products panel slides up from the bottom, never leaves the story bounds.
  const activeStoryContent = (
    <div className="relative w-full h-full overflow-hidden rounded-[10px]">
      {/* Media layer — keyed by storyIdx so React triggers the enter animation */}
      <div
        key={storyIdx}
        className={`absolute inset-0 ${animClass}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleTap}
        style={{ cursor: "pointer" }}
      >
        <StoryPanel
          story={story}
          detail={detail}
          slides={slides}
          slideIdx={slideIdx}
          progress={progress}
          isActive
          isLoading={!mediaLoaded}
          onLoad={() => setMediaLoaded(true)}
          videoRef={videoRef as RefObject<HTMLVideoElement | null>}
        />
      </div>

      {/* Products panel — slides up inside the story */}
      {hasProducts && (
        <div
          className="absolute left-0 right-0 bottom-0 z-30 flex flex-col overflow-hidden"
          style={{
            maxHeight: productsOpen ? "75%" : 52,
            transition: "max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ProductsTrigger
            open={productsOpen}
            onClick={() => setProductsOpen((o) => !o)}
          />
          <div
            className="flex-1 overflow-y-auto bg-white"
            style={{
              opacity: productsOpen ? 1 : 0,
              transition: "opacity 0.2s ease 0.1s",
              pointerEvents: productsOpen ? "auto" : "none",
            }}
          >
            <ProductsPanel
              products={slideProducts}
              onClose={() => setProductsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    /* Backdrop — rgba(0,0,0,0.4) per Figma, click outside to close */
    <div
      className="fixed inset-0 z-[100]"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP (md+)
          One centered 700×883 container with THREE absolute panels:
            • Left peek  (z:10) — inset: 2.74% 52.57% 22.37% 0%
            • Right peek (z:10) — inset: 2.74% 0%    22.37% 52.57%
            • Active     (z:20) — inset: 0%    16.71% 16.67% 20.43%
          Active sits on top; peeks go behind. No bg when absent.
          Container uses the Figma 700:883 ratio, capped by vw and vh.
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex items-center justify-center h-full">
        <div
          className="relative translate-y-1/8"
          style={{
            width: "min(700px, 96vw, calc(92vh * 0.793))",
            aspectRatio: "700 / 883",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {prevStory && (
            <div
              className="absolute z-10 overflow-hidden rounded-[10px] cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              style={{ inset: "2.74% 52.57% 22.37% 0%" }}
              onClick={() => goToStory(storyIdx - 1, "prev")}
            >
              <PeekPanel story={prevStory} />
            </div>
          )}
          {nextStory && (
            <div
              className="absolute z-10 overflow-hidden rounded-[10px] cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              style={{ inset: "2.74% 0% 22.37% 52.57%" }}
              onClick={() => goToStory(storyIdx + 1, "next")}
            >
              <PeekPanel story={nextStory} />
            </div>
          )}
          <div
            className="absolute z-20"
            style={{ inset: "0% 16.71% 16.67% 20.43%" }}
          >
            {activeStoryContent}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE (< md)
          9:16 story centered in the viewport. Page content is visible
          above and below. Peek slivers (20 px) sit just outside the
          story bounds. Tapping the backdrop closes the viewer.
          Width formula: narrowest of (screen − 40 px) and (88 vh × 9/16)
          so the story never taller than 88 vh on any phone.
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex items-center justify-center h-full overflow-hidden">
        {/* Story container — 9:16, centered, sized to fit within 88 vh */}
        <div
          className="relative"
          style={{
            width: "min(calc(100vw - 40px), calc(88vh * 0.5625))",
            aspectRatio: "9 / 16",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left peek sliver — 20 px, positioned just outside story's left edge */}
          {prevStory && (
            <div
              className="absolute z-10 top-0 bottom-0 overflow-hidden rounded-r-xl cursor-pointer opacity-80"
              style={{ width: 20, right: "100%" }}
              onClick={(e) => {
                e.stopPropagation();
                goToStory(storyIdx - 1, "prev");
              }}
            >
              <PeekPanel story={prevStory} />
            </div>
          )}
          {/* Right peek sliver — 20 px, positioned just outside story's right edge */}
          {nextStory && (
            <div
              className="absolute z-10 top-0 bottom-0 overflow-hidden rounded-l-xl cursor-pointer opacity-80"
              style={{ width: 20, left: "100%" }}
              onClick={(e) => {
                e.stopPropagation();
                goToStory(storyIdx + 1, "next");
              }}
            >
              <PeekPanel story={nextStory} />
            </div>
          )}
          {/* Active story — fills the container */}
          <div className="absolute inset-0 z-20">
            {activeStoryContent}
          </div>
        </div>
      </div>
    </div>
  );
}
