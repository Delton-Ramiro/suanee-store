"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Collection = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  position: number;
  isActive: boolean;
};

// ─── Single collection card ───────────────────────────────────────────────────

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/colecoes/${collection.slug}`}
      className="relative overflow-hidden rounded-[10px] block h-full w-full shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] group"
    >
      {collection.coverImageUrl ? (
        <img
          src={collection.coverImageUrl}
          alt={collection.name}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-300" />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />

      <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-5 xl:bottom-6 xl:left-6 flex items-center gap-1.5">
        <span className="font-medium leading-none text-white text-h6 sm:text-h6 md:text-h5 lg:text-h4 xl:text-h3">
          {collection.name}
        </span>
        <ChevronRight className="shrink-0 text-white w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 xl:w-5 xl:h-5 mt-px" />
      </div>
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HomeTrend({ collections }: { collections: Collection[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  if (!collections.length) return null;

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
    <section className="py-8 md:py-10">
      {/* Title */}
      <div className="mb-4 md:mb-6">
        <p className="font-inter font-medium text-2xl md:text-[38px] text-black tracking-[0.02em] leading-none">
          Tendência
        </p>
        {/* Mobile subtitle */}
        <p className="mt-1 text-[#a7a7a7] text-sm leading-[1.4] md:hidden">
          As categorias que os outros mais têm comprado
        </p>
      </div>

      {/* ── Mobile: 2-column grid ─────────────────────────────────────────── */}
      <div className="md:hidden grid grid-cols-2 gap-[5px]">
        {collections.map((col) => (
          <div key={col.id} className="relative h-[200px]">
            <CollectionCard collection={col} />
          </div>
        ))}
      </div>

      {/* ── Desktop: full-bleed horizontal scroll ─────────────────────────── */}
      <div
        className="hidden md:block overflow-hidden"
        style={{
          marginLeft: "calc(50% - 50vw)",
          width: "100vw",
          maskImage:
            "linear-gradient(to right, transparent 0, transparent max(16px, calc((100vw - 1240px) / 2 + 16px)), black max(16px, calc((100vw - 1240px) / 2 + 16px)), black 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, transparent max(16px, calc((100vw - 1240px) / 2 + 16px)), black max(16px, calc((100vw - 1240px) / 2 + 16px)), black 100%)",
        }}
      >
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-[5px] overflow-x-auto no-scrollbar overscroll-x-contain"
          style={{
            paddingLeft: "max(16px, calc((100vw - 1240px) / 2 + 16px))",
            paddingRight: 5,
          }}
        >
          {collections.map((col) => (
            <div
              key={col.id}
              className="relative flex-shrink-0 w-[300px] h-[480px]"
            >
              <CollectionCard collection={col} />
            </div>
          ))}
        </div>
      </div>

      {/* Scroll progress bar — desktop only */}
      <div className="hidden md:block mt-4 h-[5px] bg-gray-100 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${indicatorPct}%`,
            background: "rgba(16, 87, 142, 0.31)",
          }}
        />
      </div>
    </section>
  );
}
