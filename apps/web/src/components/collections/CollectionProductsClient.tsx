"use client";

import { useCallback, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCollectionProducts } from "@/lib/hooks/useCollectionProducts";
import { useCollectionFilters } from "@/lib/hooks/useCollectionFilters";
import { ProductCard } from "@/components/products/ProductCard";
import { FilterSidebar, type ActiveFilters } from "@/components/products/FilterSidebar";
import { SortBar } from "@/components/products/SortBar";
import { Pagination } from "@/components/products/Pagination";

type CollectionInfo = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
};

const PAGE_LIMIT = 24;

/* ── URL helpers ─────────────────────────────────────────────────────────── */

function readFromUrl(params: URLSearchParams): ActiveFilters & {
  page: number;
  sort: "newest" | "price_asc" | "price_desc";
} {
  const sort = params.get("sort");
  return {
    page: Math.max(1, Number(params.get("page") ?? 1)),
    sort: (["newest", "price_asc", "price_desc"].includes(sort ?? "")
      ? sort
      : "newest") as "newest" | "price_asc" | "price_desc",
    brand: params.get("brand")?.split(",").filter(Boolean) ?? [],
    color: params.get("color")?.split(",").filter(Boolean) ?? [],
    size: params.get("size")?.split(",").filter(Boolean) ?? [],
    subcats: [],
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    attrFilters: {},
  };
}

function buildUrl(
  pathname: string,
  filters: ActiveFilters,
  page: number,
  sort: string,
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (sort !== "newest") params.set("sort", sort);
  if (filters.brand.length) params.set("brand", filters.brand.join(","));
  if (filters.color.length) params.set("color", filters.color.join(","));
  if (filters.size.length) params.set("size", filters.size.join(","));
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function CollectionProductsClient({
  collection,
}: {
  collection: CollectionInfo;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const urlState = readFromUrl(searchParams);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    brand: urlState.brand,
    color: urlState.color,
    size: urlState.size,
    subcats: [],
    minPrice: urlState.minPrice,
    maxPrice: urlState.maxPrice,
    attrFilters: {},
  });
  const [sort, setSort] = useState(urlState.sort);
  const [page, setPage] = useState(urlState.page);

  useEffect(() => {
    const s = readFromUrl(searchParams);
    setActiveFilters({
      brand: s.brand,
      color: s.color,
      size: s.size,
      subcats: [],
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      attrFilters: {},
    });
    setSort(s.sort);
    setPage(s.page);
  }, [searchParams]);

  const { data: filtersData } = useCollectionFilters(collection.slug);
  const { data, isLoading, isFetching } = useCollectionProducts(collection.slug, {
    page,
    limit: PAGE_LIMIT,
    sort,
    brand: activeFilters.brand.join(",") || undefined,
    color: activeFilters.color.join(",") || undefined,
    size: activeFilters.size.join(",") || undefined,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
  });

  const pushUrl = useCallback(
    (filters: ActiveFilters, newPage: number, newSort: string) => {
      const url = buildUrl(pathname, filters, newPage, newSort);
      startTransition(() => router.push(url, { scroll: false }));
    },
    [pathname, router],
  );

  function handleFiltersChange(next: ActiveFilters) {
    // Drop any subcats/attrFilters that FilterSidebar might emit — not used for collections
    const clean: ActiveFilters = {
      ...next,
      subcats: [],
      attrFilters: {},
    };
    setActiveFilters(clean);
    setPage(1);
    pushUrl(clean, 1, sort);
  }

  function handleSort(newSort: "newest" | "price_asc" | "price_desc") {
    setSort(newSort);
    setPage(1);
    pushUrl(activeFilters, 1, newSort);
  }

  function handlePage(newPage: number) {
    setPage(newPage);
    pushUrl(activeFilters, newPage, sort);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const hasActiveFilters =
    activeFilters.brand.length > 0 ||
    activeFilters.color.length > 0 ||
    activeFilters.size.length > 0 ||
    activeFilters.minPrice !== undefined ||
    activeFilters.maxPrice !== undefined;

  // Shape available filters to match FilterSidebar's expected type
  const available = filtersData
    ? {
        filters: [],
        brands: filtersData.brands,
        colors: filtersData.colors,
        sizes: filtersData.sizes,
      }
    : null;

  return (
    <div>
      {/* Heading */}
      <div className="mb-4">
        <h1 className="font-inter font-medium text-2xl md:text-[38px] text-black tracking-[0.02em] leading-none uppercase">
          {collection.name}
        </h1>
        <p className="text-sm text-text-muted mt-1 hidden md:block">
          Descubra todos os produtos desta coleção.
        </p>
      </div>

      <SortBar
        total={total}
        page={page}
        limit={PAGE_LIMIT}
        sort={sort}
        filtersOpen={filtersOpen}
        hasActiveFilters={hasActiveFilters}
        onSortChange={handleSort}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
      />

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div
          className={`hidden lg:block overflow-hidden transition-all duration-300 ease-in-out flex-none ${
            filtersOpen ? "w-[260px] opacity-100" : "w-0 opacity-0"
          }`}
        >
          {available && (
            <FilterSidebar
              available={available}
              active={activeFilters}
              onChange={handleFiltersChange}
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>

        {/* Mobile overlay */}
        {available && (
          <div className="lg:hidden">
            <FilterSidebar
              available={available}
              active={activeFilters}
              onChange={handleFiltersChange}
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            />
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-1.25 gap-y-6">
              {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                <div key={i} className="skeleton rounded-[10px] aspect-3/4" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-medium text-brand">Nenhum produto encontrado</p>
              <p className="text-sm text-text-muted mt-1">Tente ajustar os filtros.</p>
            </div>
          ) : (
            <div
              className={`grid gap-x-1.25 gap-y-6 transition-opacity duration-200 ${
                isFetching ? "opacity-60" : "opacity-100"
              } ${
                filtersOpen
                  ? "grid-cols-2 md:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={handlePage} />
        </div>
      </div>
    </div>
  );
}
