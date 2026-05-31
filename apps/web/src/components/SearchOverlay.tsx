"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useSearchOverlay, searchStore } from "@/lib/stores/searchStore";
import { apiFetch } from "@/lib/api";
import {
  ProductCard,
  type ProductCardItem,
} from "@/components/products/ProductCard";

// ── Types ──────────────────────────────────────────────────────────

interface MostSearchedCategory {
  id: string;
  position: number;
  category: {
    id: string;
    name: string;
    slug: string;
    level: number;
    parent: { slug: string } | null;
  };
}

interface SearchDocument {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  brandId: string;
  brandName: string;
  brandSlug: string;
  media: Array<{
    id: string;
    url: string;
    mediaType: string;
    isPrimary: boolean;
  }>;
  colors: Array<{ id: string; name: string; hexCode: string }>;
}

interface SearchResponse {
  hits: Array<{ document: SearchDocument }>;
}

// ── Helpers ────────────────────────────────────────────────────────

function toCardItem(doc: SearchDocument): ProductCardItem {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    basePrice: doc.basePrice,
    isIndicativePrice: doc.isIndicativePrice,
    hasDiscount: doc.hasDiscount,
    discountPrice: doc.discountPrice,
    brand: { id: doc.brandId, name: doc.brandName, slug: doc.brandSlug },
    media: doc.media,
    variants: doc.colors.map((c) => ({ colorId: c.id, color: c })),
  };
}

function primaryImageUrl(doc: SearchDocument): string {
  const primary = doc.media.find((m) => m.isPrimary) ?? doc.media[0];
  return primary?.url ?? "";
}

function formatPrice(value: number): string {
  return `MZN ${Math.round(value).toLocaleString("pt-PT")}`;
}

// ── Component ──────────────────────────────────────────────────────

function categoryUrl(cat: MostSearchedCategory["category"]): string {
  return cat.level <= 1
    ? `/categorias/${cat.slug}`
    : `/categorias/${cat.slug}/produtos`;
}

export function SearchOverlay() {
  const isOpen = useSearchOverlay();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchDocument[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mostSearched, setMostSearched] = useState<MostSearchedCategory[]>([]);

  // Fetch most-searched once on mount
  useEffect(() => {
    apiFetch<MostSearchedCategory[]>("/search/most-searched")
      .then(setMostSearched)
      .catch(() => {});
  }, []);

  // Auto-focus and reset on open/close
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setHits(null);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") searchStore.close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(q)}&perPage=6`)
        .then((data) => setHits(data.hits.map((h) => h.document)))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = query.trim().length > 0;
  const noResults = !loading && hasQuery && hits !== null && hits.length === 0;
  const hasResults = !loading && hits !== null && hits.length > 0;

  return (
    <>
      {/* Panel — sits directly below the fixed header */}
      <div
        role="search"
        aria-label="Pesquisar produtos"
        className={`fixed left-0 right-0 bottom-0 z-40 bg-white overflow-y-auto transition-all duration-300 ease-out ${
          isOpen
            ? "top-nav opacity-100 pointer-events-auto"
            : "top-nav opacity-0 pointer-events-none -translate-y-4"
        }`}
      >
        <div className="container-web py-8">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={searchStore.close}
              aria-label="Fechar pesquisa"
              className="text-black hover:opacity-60 transition-opacity"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>

          {/* Input */}
          <div className="flex flex-col gap-1.5 mb-8">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="O que procura?"
              autoComplete="off"
              className="w-full bg-transparent text-base font-medium text-brand placeholder:text-brand/50 outline-none"
            />
            <div className="h-px bg-brand/20" />
          </div>

          {/* Loading spinner */}
          {loading && (
            <div className="flex justify-center py-16">
              <span className="w-7 h-7 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
            </div>
          )}

          {/* Results — vertical list on mobile, product card grid on sm+ */}
          {hasResults && (
            <>
              {/* Mobile list */}
              <div className="flex flex-col sm:hidden">
                {hits!.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/produtos/${doc.slug}`}
                    onClick={searchStore.close}
                    className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="relative w-[55px] h-[55px] shrink-0 rounded-[5px] overflow-hidden bg-muted-bg">
                      {primaryImageUrl(doc) && (
                        <img
                          src={primaryImageUrl(doc)}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-[7px] flex-1 min-w-0">
                      <p className="text-[15px] font-normal tracking-[0.3px] text-brand truncate">
                        {doc.name}
                      </p>
                      <p className="text-[11px] font-bold tracking-[0.22px] text-brand">
                        {doc.brandName}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-bold tracking-[0.26px] text-brand">
                          {formatPrice(doc.basePrice)}
                        </p>
                        {doc.colors.length > 0 && (
                          <p className="text-[10px] font-normal tracking-[0.2px] text-brand">
                            +{doc.colors.length} cores
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop grid */}
              <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-x-1.25 gap-y-6">
                {hits!.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("button")) {
                        searchStore.close();
                      }
                    }}
                  >
                    <ProductCard product={toCardItem(doc)} compact />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* No results state */}
          {noResults && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <p className="text-h4 font-medium text-text-muted">
                Sem resultados
              </p>

              <div className="text-white">
                <Link
                  href="/conta/chat"
                  onClick={searchStore.close}
                  className="flex items-center justify-center w-60 h-12 bg-brand text-base font-bold rounded-[3px] hover:bg-primary transition-colors duration-150"
                >
                  Conversar
                </Link>
              </div>
            </div>
          )}

          {/* Idle state — no query yet, show most-searched categories */}
          {!hasQuery && !loading && (
            <div className="flex flex-col gap-3">
              {mostSearched.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Mais procurados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mostSearched.map(({ id, category }) => (
                      <Link
                        key={id}
                        href={categoryUrl(category)}
                        onClick={searchStore.close}
                        className="border border-black rounded-[17px] px-5 py-1.5 text-[13px] font-medium text-brand bg-[#fafafa] hover:bg-gray-100 transition-colors"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
