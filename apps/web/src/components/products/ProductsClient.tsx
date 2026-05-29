"use client";

import { useCallback, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useProducts } from "@/lib/hooks/useProducts";
import { useCategoryFilters } from "@/lib/hooks/useCategoryFilters";
import { ProductCard } from "./ProductCard";
import { FilterSidebar, type ActiveFilters } from "./FilterSidebar";
import { SortBar } from "./SortBar";
import { Pagination } from "./Pagination";

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
};

type Props = {
  category: CategoryInfo;
};

const PAGE_LIMIT = 24;

/* ── URL serialisation helpers ───────────────────────────────────────────── */

function readFiltersFromUrl(params: URLSearchParams): ActiveFilters & {
  page: number;
  sort: "newest" | "price_asc" | "price_desc";
} {
  const attrFilters: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith("attr-")) {
      const defId = key.slice(5);
      attrFilters[defId] = value.split(",").filter(Boolean);
    }
  });

  const sort = params.get("sort");

  return {
    page: Math.max(1, Number(params.get("page") ?? 1)),
    sort: (["newest", "price_asc", "price_desc"].includes(sort ?? "")
      ? sort
      : "newest") as "newest" | "price_asc" | "price_desc",
    brand: params.get("brand")?.split(",").filter(Boolean) ?? [],
    color: params.get("color")?.split(",").filter(Boolean) ?? [],
    size: params.get("size")?.split(",").filter(Boolean) ?? [],
    minPrice: params.get("minPrice")
      ? Number(params.get("minPrice"))
      : undefined,
    maxPrice: params.get("maxPrice")
      ? Number(params.get("maxPrice"))
      : undefined,
    attrFilters,
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
  if (filters.minPrice !== undefined)
    params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined)
    params.set("maxPrice", String(filters.maxPrice));
  for (const [defId, optIds] of Object.entries(filters.attrFilters)) {
    if (optIds.length > 0) params.set(`attr-${defId}`, optIds.join(","));
  }
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

/* ── ProductsClient ──────────────────────────────────────────────────────── */

export function ProductsClient({ category }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const urlState = readFiltersFromUrl(searchParams);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    brand: urlState.brand,
    color: urlState.color,
    size: urlState.size,
    minPrice: urlState.minPrice,
    maxPrice: urlState.maxPrice,
    attrFilters: urlState.attrFilters,
  });
  const [sort, setSort] = useState(urlState.sort);
  const [page, setPage] = useState(urlState.page);

  // Sync state from URL on navigation (back/forward)
  useEffect(() => {
    const state = readFiltersFromUrl(searchParams);
    setActiveFilters({
      brand: state.brand,
      color: state.color,
      size: state.size,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      attrFilters: state.attrFilters,
    });
    setSort(state.sort);
    setPage(state.page);
  }, [searchParams]);

  const { data: filtersData } = useCategoryFilters(category.slug);
  const { data, isLoading, isFetching } = useProducts(category.slug, {
    page,
    limit: PAGE_LIMIT,
    sort,
    brand: activeFilters.brand.join(",") || undefined,
    color: activeFilters.color.join(",") || undefined,
    size: activeFilters.size.join(",") || undefined,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    attrFilters: activeFilters.attrFilters,
  });

  const pushUrl = useCallback(
    (filters: ActiveFilters, newPage: number, newSort: string) => {
      const url = buildUrl(pathname, filters, newPage, newSort);
      startTransition(() => router.push(url, { scroll: false }));
    },
    [pathname, router],
  );

  function handleFiltersChange(next: ActiveFilters) {
    setActiveFilters(next);
    setPage(1);
    pushUrl(next, 1, sort);
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
    activeFilters.maxPrice !== undefined ||
    Object.values(activeFilters.attrFilters).some((v) => v.length > 0);

  return (
    <div>
      {/* Page heading */}
      <div className="mb-4">
        <h1 className="font-inter font-medium text-2xl md:text-[38px] text-black tracking-[0.02em] leading-none uppercase">
          {category.name}
        </h1>
        <p className="text-sm text-text-muted mt-1 hidden md:block">
          Descubra os melhores produtos desta categoria com os filtros abaixo.
        </p>
      </div>

      {/* Sort bar */}
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

      {/* Layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Filter sidebar — desktop slides in, mobile overlay drawer */}
        <div
          className={`hidden lg:block overflow-hidden transition-all duration-300 ease-in-out flex-none ${
            filtersOpen ? "w-[260px] opacity-100" : "w-0 opacity-0"
          }`}
        >
          {filtersData && (
            <FilterSidebar
              available={filtersData}
              active={activeFilters}
              onChange={handleFiltersChange}
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>

        {/* Mobile overlay drawer */}
        {filtersData && (
          <div className="lg:hidden">
            <FilterSidebar
              available={filtersData}
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[5px]">
              {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                <div key={i} className="skeleton rounded-[10px] aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-medium text-brand">
                Nenhum produto encontrado
              </p>
              <p className="text-sm text-text-muted mt-1">
                Tente ajustar os filtros ou termos de pesquisa.
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-[5px] transition-opacity duration-200 ${
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

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePage}
          />
        </div>
      </div>
    </div>
  );
}
