"use client";

import { useRef, useState, useCallback } from "react";
import { SectionHeading } from "@/components/home/shared/SectionHeading";
import { CollectionCard, type Collection } from "@/components/home/HomeTrend";

interface CategoryCollectionsProps {
  collections: Collection[];
}

export function CategoryCollections({ collections }: CategoryCollectionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

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

  if (!collections.length) return null;

  return (
    <section className="py-6 md:py-8">
      <SectionHeading title="Momentos especiais" />
      <p className="-mt-2.5 mb-10 text-text-muted text-sm md:text-base leading-normal max-w-xl">
        Os looks para os momentos fora do dia-a-dia já combinados para si
      </p>

      {/* Mobile: 2-column grid */}
      <div className="md:hidden grid grid-cols-2 gap-1.25">
        {collections.map((col) => (
          <div key={col.id} className="relative h-50">
            <CollectionCard collection={col} />
          </div>
        ))}
      </div>

      {/* Desktop: contained horizontal scroll */}
      <div className="hidden md:block">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-1.25 overflow-x-auto no-scrollbar overscroll-x-contain"
        >
          {collections.map((col) => (
            <div key={col.id} className="relative flex-shrink-0 w-70 h-110">
              <CollectionCard collection={col} />
            </div>
          ))}
        </div>

        <div className="mt-4 h-1.25 bg-gray-100 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${indicatorPct}%`,
              background: "rgba(16,87,142,0.31)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
