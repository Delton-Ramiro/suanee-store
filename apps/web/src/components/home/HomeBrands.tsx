"use client";

import Link from "next/link";
import { HorizontalScroll } from "./shared/HorizontalScroll";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

// ─── Single brand card ────────────────────────────────────────────────────────

export function BrandCard({ brand }: { brand: Brand }) {
  const bg = brand.logoUrl ?? brand.landingImage2Url;

  return (
    <Link
      href={`/marcas/${brand.slug}`}
      className="relative flex-shrink-0 overflow-hidden rounded-[5px] md:rounded-[10px] block
                 w-[170px] h-[154px] md:w-[220px] md:h-[280px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)]"
    >
      {bg ? (
        <img
          src={bg}
          alt={brand.name}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-200" />
      )}
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HomeBrands({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;

  return (
    <section className="py-8 md:py-10">
      <div className="relative z-10 mb-4 md:mb-6">
        <Link
          href="/marcas"
          className="text-muted-bg text-sm md:text-xl font-normal leading-none hover:underline"
        >
          Ver todas
        </Link>
        <p className="font-inter font-medium text-2xl md:text-h2 text-black tracking-[0.02em] leading-none mt-0.5">
          Marcas para si
        </p>
      </div>

      <HorizontalScroll wrapperClassName="-mt-3 md:-mt-9">
        {brands.map((brand) => (
          <BrandCard key={brand.id} brand={brand} />
        ))}
      </HorizontalScroll>
    </section>
  );
}
