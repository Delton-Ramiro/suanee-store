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

// ── Adapter ────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────

export function SearchOverlay() {
  const isOpen = useSearchOverlay();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchDocument[] | null>(null);
  const [loading, setLoading] = useState(false);

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

          {/* Results grid — exactly as ProductCard */}
          {hasResults && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-[5px]">
              {hits!.map((doc) => (
                <div key={doc.id} onClick={searchStore.close}>
                  <ProductCard product={toCardItem(doc)} compact />
                </div>
              ))}
            </div>
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

          {/* Idle state — no query yet */}
          {!hasQuery && !loading && (
            <div className="py-16 text-center text-sm text-text-muted">
              Escreva para pesquisar produtos
            </div>
          )}
        </div>
      </div>
    </>
  );
}
