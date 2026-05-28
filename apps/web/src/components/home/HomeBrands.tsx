"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

// ─── Single brand card ────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: Brand }) {
  const bg = brand.logoUrl ?? brand.landingImage2Url;

  return (
    <Link
      href={`/marcas/${brand.slug}`}
      className="relative flex-shrink-0 overflow-hidden rounded-[5px] md:rounded-[10px] block
                 w-[170px] h-[154px] md:w-[220px] md:h-[280px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)]"
    >
      {/* Background */}
      {bg ? (
        <img
          src={bg}
          alt={brand.name}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-200" />
      )}

      {/* Logo bar */}
      {/* <div className="absolute bottom-0 left-0 right-0 h-8 md:h-10 bg-white/70 flex items-center justify-center px-3 overflow-hidden">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="max-h-[19px] md:max-h-[22px] max-w-full object-contain"
          />
        ) : (
          <span className="font-medium text-xs md:text-sm text-gray-900 tracking-wide truncate">
            {brand.name}
          </span>
        )}
      </div> */}
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HomeBrands({ brands }: { brands: Brand[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  if (!brands.length) return null;

  // Progress bar indicator width: starts at a minimum 10% so it's always visible
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
      <div className="relative z-10 mb-4 md:mb-6">
        <p className="text-[#adadad] text-sm md:text-xl font-normal leading-none">
          Ver todas
        </p>
        <p className="text-black text-2xl md:text-3xl font-medium font-inter tracking-[0.02em] leading-none mt-1">
          Marcas para si
        </p>
      </div>

      {/*
        Bleed wrapper: stretches to full viewport width without adding page scroll.
        overflow-hidden clips children so they don't contribute to page overflow.
        The inner div scrolls independently via overflow-x-auto.
      */}
      <div
        className="overflow-hidden -mt-3 md:-mt-9"
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
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      </div>

      {/* Scroll progress bar */}
      <div className="mt-4 h-[5px] bg-gray-100 overflow-hidden rounded-full">
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
