"use client";

import Link from "next/link";
import { useRef, useState, useCallback } from "react";

/* ── Contained scroll — stays within container-web boundaries ──────────────── */

function ContainedScroll({ children }: { children: React.ReactNode }) {
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

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex gap-1.25 overflow-x-auto no-scrollbar overscroll-x-contain"
      >
        {children}
      </div>
      <div className="mt-4 h-[5px] bg-gray-100 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${indicatorPct}%`,
            background: "rgba(16,87,142,0.31)",
          }}
        />
      </div>
    </>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type CategoryChild = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  position: number;
};

/* ── Card ───────────────────────────────────────────────────────────────────── */

function SubcategoryCard({ category }: { category: CategoryChild }) {
  return (
    <Link
      href={`/produtos?categoria=${category.slug}`}
      className="flex-shrink-0 flex flex-col items-center gap-2 group"
    >
      <div className="relative overflow-hidden rounded-[10px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] w-[160px] h-[145px] md:w-[200px] md:h-[180px]">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-muted-bg" />
        )}
      </div>
      <span className="text-[13px] font-bold text-brand text-center leading-snug max-w-[160px] md:max-w-[200px] group-hover:text-primary transition-colors duration-150">
        {category.name}
      </span>
    </Link>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────────── */

interface CategorySubcategoriesProps {
  children: CategoryChild[];
}

export function CategorySubcategories({
  children,
}: CategorySubcategoriesProps) {
  if (!children.length) return null;

  return (
    <section className="py-6 md:py-8">
      <ContainedScroll>
        {children.map((cat) => (
          <SubcategoryCard key={cat.id} category={cat} />
        ))}
      </ContainedScroll>
    </section>
  );
}
