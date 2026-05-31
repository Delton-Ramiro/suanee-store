"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type BrandItem = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function BrandsClient({ brands }: { brands: BrandItem[] }) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const lettersWithBrands = useMemo(() => {
    const set = new Set<string>();
    brands.forEach((b) => {
      const first = b.name[0]?.toUpperCase();
      if (first) set.add(first);
    });
    return set;
  }, [brands]);

  const filtered = useMemo(() => {
    let result = brands;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (activeLetter) {
      result = result.filter((b) => b.name[0]?.toUpperCase() === activeLetter);
    }
    return result;
  }, [brands, query, activeLetter]);

  return (
    <div className="py-8 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-medium text-[38px] text-black tracking-[0.76px] leading-none">
            Marcas
          </h1>
          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar marca..."
              className="h-[50px] w-full sm:w-[435px] rounded-full bg-primary text-white placeholder:text-white/70 pl-6 pr-12 text-[19px] font-medium outline-none"
            />
            <Search
              size={20}
              className="absolute right-5 text-white pointer-events-none"
            />
          </div>
        </div>
        <p className="text-[#a7a7a7] text-base">
          Todas as melhores marcas numa só loja
        </p>
      </div>

      {/* Letter filter grid */}
      <div className="grid grid-cols-[repeat(7,1fr)] sm:grid-cols-[repeat(13,1fr)] md:grid-cols-[repeat(16,1fr)] lg:grid-cols-[repeat(26,1fr)] gap-[10px]">
        {ALPHABET.map((letter) => {
          const hasItems = lettersWithBrands.has(letter);
          const isActive = activeLetter === letter;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => setActiveLetter(isActive ? null : letter)}
              disabled={!hasItems}
              className={`flex items-center justify-center p-[10px] text-[19px] font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white font-bold"
                  : hasItems
                    ? "bg-bg text-black hover:bg-border cursor-pointer"
                    : "bg-bg text-text-muted opacity-40 cursor-default"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Brand grid */}
      {filtered.length === 0 ? (
        <p className="text-text-muted text-sm py-10 text-center">
          Nenhuma marca encontrada
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-[5px]">
          {filtered.map((brand) => {
            const img =
              brand.landingImage1Url ??
              brand.landingImage2Url ??
              brand.logoUrl;
            return (
              <Link
                key={brand.id}
                href={`/marcas/${brand.slug}`}
                className="flex flex-col gap-[21px] items-center group"
              >
                <div className="h-[210px] w-full rounded-[5px] overflow-hidden bg-muted-bg relative">
                  {img ? (
                    <img
                      src={img}
                      alt={brand.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-brand/10">
                      <span className="text-brand/40 text-4xl font-bold">
                        {brand.name[0]}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-h5 font-bold text-black text-center">
                  {brand.name}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
