"use client";

import { useCallback, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useSearch, type SearchDocument } from "@/lib/hooks/useSearch";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import {
  useCategoryFilters,
  useAllColors,
  type BrandOption,
} from "@/lib/hooks/useCategoryFilters";
import { ProductCard } from "@/components/products/ProductCard";
import { SortBar, SORT_VALUES, type Sort } from "@/components/products/SortBar";
import { Pagination } from "@/components/products/Pagination";
import {
  SearchFilterSidebar,
  type SearchActiveFilters,
  type CategorySelection,
  EMPTY_CAT_SELECTION,
} from "@/components/search/SearchFilterSidebar";

type BrandInfo = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

const PAGE_LIMIT = 24;

function toCardItem(doc: SearchDocument) {
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

/* ── URL helpers (same shape as pesquisa, minus brand) ──────────────────── */

type UrlState = {
  q: string;
  page: number;
  sort: Sort;
  cat0: string | null; cat0Id: string | null;
  cat1: string | null; cat1Id: string | null;
  cat2: string | null; cat2Id: string | null;
  colorIds: string[];
  sizeIds: string[];
  minPrice?: number;
  maxPrice?: number;
  attrFilters: Record<string, string[]>;
};

function readUrl(params: URLSearchParams): UrlState {
  const attrFilters: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith("attr-")) attrFilters[key.slice(5)] = value.split(",").filter(Boolean);
  });
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1)),
    sort: ((SORT_VALUES as readonly string[]).includes(sort ?? "") ? sort : "newest") as Sort,
    cat0: params.get("cat0") ?? null, cat0Id: params.get("cat0Id") ?? null,
    cat1: params.get("cat1") ?? null, cat1Id: params.get("cat1Id") ?? null,
    cat2: params.get("cat2") ?? null, cat2Id: params.get("cat2Id") ?? null,
    colorIds: params.get("color")?.split(",").filter(Boolean) ?? [],
    sizeIds:  params.get("size")?.split(",").filter(Boolean) ?? [],
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    attrFilters,
  };
}

function buildUrl(
  pathname: string,
  q: string,
  cat: CategorySelection,
  filters: SearchActiveFilters,
  page: number,
  sort: Sort,
): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  if (sort !== "newest") params.set("sort", sort);
  if (cat.l0Slug) { params.set("cat0", cat.l0Slug); params.set("cat0Id", cat.l0Id!); }
  if (cat.l1Slug) { params.set("cat1", cat.l1Slug); params.set("cat1Id", cat.l1Id!); }
  if (cat.l2Slug) { params.set("cat2", cat.l2Slug); params.set("cat2Id", cat.l2Id!); }
  if (filters.colorIds.length) params.set("color", filters.colorIds.join(","));
  if (filters.sizeIds.length)  params.set("size",  filters.sizeIds.join(","));
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  for (const [defId, optIds] of Object.entries(filters.attrFilters)) {
    if (optIds.length) params.set(`attr-${defId}`, optIds.join(","));
  }
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function BrandProductsClient({ brand }: { brand: BrandInfo }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const url = readUrl(searchParams);

  const [sort, setSort] = useState<Sort>(url.sort);
  const [page, setPage] = useState(url.page);
  const [searchInput, setSearchInput] = useState(url.q);

  const [categorySelection, setCategorySelection] = useState<CategorySelection>({
    l0Slug: url.cat0, l0Id: url.cat0Id,
    l1Slug: url.cat1, l1Id: url.cat1Id,
    l2Slug: url.cat2, l2Id: url.cat2Id,
  });

  const [activeFilters, setActiveFilters] = useState<SearchActiveFilters>({
    brandIds: [],
    colorIds: url.colorIds,
    sizeIds:  url.sizeIds,
    minPrice: url.minPrice,
    maxPrice: url.maxPrice,
    attrFilters: url.attrFilters,
  });

  useEffect(() => {
    const s = readUrl(searchParams);
    setSort(s.sort);
    setPage(s.page);
    setSearchInput(s.q);
    setCategorySelection({
      l0Slug: s.cat0, l0Id: s.cat0Id,
      l1Slug: s.cat1, l1Id: s.cat1Id,
      l2Slug: s.cat2, l2Id: s.cat2Id,
    });
    setActiveFilters({
      brandIds: [],
      colorIds: s.colorIds,
      sizeIds:  s.sizeIds,
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      attrFilters: s.attrFilters,
    });
  }, [searchParams]);

  const { data: categoryTree } = useCategoryTree();
  const { data: globalColors = [] } = useAllColors();

  const filterCategorySlug =
    categorySelection.l2Slug ?? categorySelection.l1Slug ?? categorySelection.l0Slug ?? null;
  const { data: categoryFilters } = useCategoryFilters(filterCategorySlug ?? "");

  const searchCategoryId =
    categorySelection.l2Id ?? categorySelection.l1Id ?? categorySelection.l0Id ?? undefined;

  const { data: searchData, isLoading, isFetching } = useSearch({
    q: url.q,
    brandIds: brand.id,
    page,
    perPage: PAGE_LIMIT,
    sort,
    categoryId: searchCategoryId,
    colorIds: activeFilters.colorIds.join(",") || undefined,
    sizeIds:  activeFilters.sizeIds.join(",")  || undefined,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    attrFilters: activeFilters.attrFilters,
  });

  const pushUrl = useCallback(
    (cat: CategorySelection, filters: SearchActiveFilters, newPage: number, newSort: Sort) => {
      const u = buildUrl(pathname, url.q, cat, filters, newPage, newSort);
      startTransition(() => router.push(u, { scroll: false }));
    },
    [pathname, router, url.q],
  );

  function handleCategoryChange(next: CategorySelection) {
    const nextFilters: SearchActiveFilters = { ...activeFilters, sizeIds: [], attrFilters: {} };
    setCategorySelection(next);
    setActiveFilters(nextFilters);
    setPage(1);
    pushUrl(next, nextFilters, 1, sort);
  }

  function handleResetAll() {
    const empty: SearchActiveFilters = { brandIds: [], colorIds: [], sizeIds: [], attrFilters: {} };
    setCategorySelection(EMPTY_CAT_SELECTION);
    setActiveFilters(empty);
    setPage(1);
    pushUrl(EMPTY_CAT_SELECTION, empty, 1, sort);
  }

  function handleFiltersChange(next: SearchActiveFilters) {
    setActiveFilters(next);
    setPage(1);
    pushUrl(categorySelection, next, 1, sort);
  }

  useEffect(() => {
    if (searchInput.trim() === url.q.trim()) return;
    const timer = setTimeout(() => {
      const u = buildUrl(pathname, searchInput.trim(), categorySelection, activeFilters, 1, sort);
      startTransition(() => router.push(u, { scroll: false }));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim() === url.q.trim()) return;
    const u = buildUrl(pathname, searchInput.trim(), categorySelection, activeFilters, 1, sort);
    startTransition(() => router.push(u, { scroll: false }));
  }

  function handleSort(newSort: Sort) {
    setSort(newSort);
    setPage(1);
    pushUrl(categorySelection, activeFilters, 1, newSort);
  }

  function handlePage(newPage: number) {
    setPage(newPage);
    pushUrl(categorySelection, activeFilters, newPage, sort);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const products = searchData?.hits.map((h) => h.document) ?? [];
  const total = searchData?.total ?? 0;
  const totalPages = searchData?.totalPages ?? 1;

  const hasActiveFilters =
    categorySelection.l0Slug !== null ||
    activeFilters.colorIds.length > 0 ||
    activeFilters.sizeIds.length > 0 ||
    activeFilters.minPrice !== undefined ||
    activeFilters.maxPrice !== undefined ||
    Object.values(activeFilters.attrFilters).some((v) => v.length > 0);

  const sharedSidebarProps = {
    categoryTree: categoryTree ?? [],
    categorySelection,
    onCategoryChange: handleCategoryChange,
    available: filterCategorySlug ? (categoryFilters ?? null) : null,
    globalBrands: [] as BrandOption[],
    globalColors,
    active: activeFilters,
    onChange: handleFiltersChange,
    onResetAll: handleResetAll,
    hideBrands: true,
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-inter font-medium text-2xl md:text-h2 text-black tracking-[0.02em] leading-none uppercase">
          {brand.name}
        </h1>
        <form onSubmit={handleSearchSubmit} className="w-56">
          <div className="flex items-center gap-2">
            <Search size={13} className="text-brand/35 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="O que procura?"
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent text-sm text-brand placeholder:text-brand/35 outline-none"
            />
          </div>
          <div className="h-px bg-brand/15 mt-1.5" />
        </form>
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
        {/* Desktop filter sidebar */}
        <div
          className={`hidden lg:block overflow-hidden transition-all duration-300 ease-in-out flex-none ${
            filtersOpen ? "w-65 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <SearchFilterSidebar {...sharedSidebarProps} isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />
        </div>

        {/* Mobile overlay */}
        <div className="lg:hidden">
          <SearchFilterSidebar {...sharedSidebarProps} isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />
        </div>

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
              {products.map((doc) => (
                <ProductCard key={doc.id} product={toCardItem(doc)} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={handlePage} />
        </div>
      </div>
    </div>
  );
}
