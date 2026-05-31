"use client";

import { useCallback, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useBrandProducts } from "@/lib/hooks/useBrandProducts";
import { useBrandFilters } from "@/lib/hooks/useBrandFilters";
import { ProductCard } from "@/components/products/ProductCard";
import { SortBar } from "@/components/products/SortBar";
import { Pagination } from "@/components/products/Pagination";
import {
  BrandFilterSidebar,
  type BrandActiveFilters,
} from "./BrandFilterSidebar";

type BrandInfo = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

const PAGE_LIMIT = 24;

/* ── URL helpers ─────────────────────────────────────────────────────────── */

function readFromUrl(params: URLSearchParams): BrandActiveFilters & {
  page: number;
  sort: "newest" | "price_asc" | "price_desc";
} {
  const sort = params.get("sort");

  // Parse attrg-{name} params back into mergedAttrs
  const mergedAttrs: Record<string, { defId: string; optId: string }[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith("attrg-")) {
      const groupName = key.slice(6);
      const pairs = value
        .split(",")
        .map((p) => { const [defId, optId] = p.split(":"); return { defId: defId ?? "", optId: optId ?? "" }; })
        .filter((p) => p.defId && p.optId);
      if (pairs.length > 0) mergedAttrs[groupName] = pairs;
    }
  });

  return {
    page: Math.max(1, Number(params.get("page") ?? 1)),
    sort: (["newest", "price_asc", "price_desc"].includes(sort ?? "")
      ? sort
      : "newest") as "newest" | "price_asc" | "price_desc",
    cats: params.get("cat")?.split(",").filter(Boolean) ?? [],
    color: params.get("color")?.split(",").filter(Boolean) ?? [],
    size: params.get("size")?.split(",").filter(Boolean) ?? [],
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    mergedAttrs,
  };
}

function buildUrl(
  pathname: string,
  filters: BrandActiveFilters,
  page: number,
  sort: string,
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (sort !== "newest") params.set("sort", sort);
  if (filters.cats.length) params.set("cat", filters.cats.join(","));
  if (filters.color.length) params.set("color", filters.color.join(","));
  if (filters.size.length) params.set("size", filters.size.join(","));
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));

  // Encode merged attr groups: attrg-{name}=defId1:optId1,defId2:optId2,...
  for (const [key, pairs] of Object.entries(filters.mergedAttrs)) {
    if (pairs.length > 0) {
      params.set(`attrg-${key}`, pairs.map((p) => `${p.defId}:${p.optId}`).join(","));
    }
  }

  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

function buildProductFetchParams(filters: BrandActiveFilters): Record<string, string> {
  const extra: Record<string, string> = {};
  for (const [key, pairs] of Object.entries(filters.mergedAttrs)) {
    if (pairs.length > 0) {
      extra[`attrg-${key}`] = pairs.map((p) => `${p.defId}:${p.optId}`).join(",");
    }
  }
  return extra;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function BrandProductsClient({ brand }: { brand: BrandInfo }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const urlState = readFromUrl(searchParams);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<BrandActiveFilters>({
    cats: urlState.cats,
    color: urlState.color,
    size: urlState.size,
    minPrice: urlState.minPrice,
    maxPrice: urlState.maxPrice,
    mergedAttrs: urlState.mergedAttrs,
  });
  const [sort, setSort] = useState(urlState.sort);
  const [page, setPage] = useState(urlState.page);

  useEffect(() => {
    const s = readFromUrl(searchParams);
    setActiveFilters({
      cats: s.cats,
      color: s.color,
      size: s.size,
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      mergedAttrs: s.mergedAttrs,
    });
    setSort(s.sort);
    setPage(s.page);
  }, [searchParams]);

  const { data: filtersData } = useBrandFilters(brand.slug);

  // Build extra params for merged attrs so the query key changes on attr changes
  const mergedAttrParams = buildProductFetchParams(activeFilters);

  const { data, isLoading, isFetching } = useBrandProducts(brand.slug, {
    page,
    limit: PAGE_LIMIT,
    sort,
    cats: activeFilters.cats.join(",") || undefined,
    color: activeFilters.color.join(",") || undefined,
    size: activeFilters.size.join(",") || undefined,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    extra: mergedAttrParams,
  });

  const pushUrl = useCallback(
    (filters: BrandActiveFilters, newPage: number, newSort: string) => {
      const url = buildUrl(pathname, filters, newPage, newSort);
      startTransition(() => router.push(url, { scroll: false }));
    },
    [pathname, router],
  );

  function handleFiltersChange(next: BrandActiveFilters) {
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
    activeFilters.cats.length > 0 ||
    activeFilters.color.length > 0 ||
    activeFilters.size.length > 0 ||
    activeFilters.minPrice !== undefined ||
    activeFilters.maxPrice !== undefined ||
    Object.values(activeFilters.mergedAttrs).some((p) => p.length > 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-inter font-medium text-2xl md:text-[38px] text-black tracking-[0.02em] leading-none uppercase">
          {brand.name}
        </h1>
        <p className="text-sm text-text-muted mt-1 hidden md:block">
          Todos os produtos desta marca com os filtros abaixo.
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
          {filtersData && (
            <BrandFilterSidebar
              categories={filtersData.categories}
              colors={filtersData.colors}
              sizes={filtersData.sizes}
              attrDefs={filtersData.filters}
              active={activeFilters}
              onChange={handleFiltersChange}
              isOpen={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>

        {/* Mobile overlay */}
        {filtersData && (
          <div className="lg:hidden">
            <BrandFilterSidebar
              categories={filtersData.categories}
              colors={filtersData.colors}
              sizes={filtersData.sizes}
              attrDefs={filtersData.filters}
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
