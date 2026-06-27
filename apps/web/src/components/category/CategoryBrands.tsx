"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { SectionHeading } from "@/components/home/shared/SectionHeading";
import type { Brand } from "@/components/home/HomeBrands";

/* ── Card — same dimensions as SubcategoryCard ──────────────────────────────── */

function CategoryBrandCard({
  brand,
  categorySlug,
}: {
  brand: Brand;
  categorySlug: string;
}) {
  const bg = brand.landingImage1Url ?? brand.landingImage2Url ?? brand.logoUrl;

  return (
    <Link
      href={`/categorias/${categorySlug}/produtos?brand=${brand.id}`}
      className="flex-shrink-0 flex flex-col items-center gap-2 group"
    >
      <div className="relative overflow-hidden rounded-[10px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] w-[160px] h-[145px] md:w-[200px] md:h-[180px]">
        {bg ? (
          <img
            src={bg}
            alt={brand.name}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-muted-bg flex items-center justify-center">
            <span className="text-sm font-medium text-text-muted text-center px-2">
              {brand.name}
            </span>
          </div>
        )}
      </div>
      <span className="text-[13px] font-medium text-brand text-center leading-snug max-w-[160px] md:max-w-[200px] group-hover:text-primary transition-colors duration-150">
        {brand.name}
      </span>
    </Link>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────────── */

interface CategoryBrandsProps {
  brands: Brand[];
  categorySlug: string;
}

export function CategoryBrands({ brands, categorySlug }: CategoryBrandsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [viewportRatio, setViewportRatio] = useState(1);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
    setViewportRatio(el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const indicatorLeft = scrollPct * (1 - viewportRatio) * 100;
  const indicatorWidth = Math.max(viewportRatio * 100, 5);

  if (!brands.length) return null;

  return (
    <section className="py-8 md:py-8">
      <SectionHeading title="Marcas" />
      <p className="-mt-2.5 mb-10 text-text-muted text-sm md:text-base leading-normal max-w-xl">
        Reunimos os produtos destas marcas para a sua categoria
      </p>

      <div
        ref={scrollRef}
        onScroll={measure}
        className="flex gap-1.25 overflow-x-auto no-scrollbar overscroll-x-contain"
      >
        {brands.map((brand) => (
          <CategoryBrandCard key={brand.id} brand={brand} categorySlug={categorySlug} />
        ))}
      </div>

      <div className="mt-4 h-[5px] bg-gray-100 overflow-hidden rounded-full relative">
        <div
          className="absolute top-0 h-full rounded-full transition-[left,width] duration-100"
          style={{
            left: `${indicatorLeft}%`,
            width: `${indicatorWidth}%`,
            background: "rgba(16,87,142,0.31)",
          }}
        />
      </div>
    </section>
  );
}
