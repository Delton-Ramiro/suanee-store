"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SearchDocument = {
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
  media: Array<{ id: string; url: string; mediaType: string; isPrimary: boolean }>;
  colors: Array<{ id: string; name: string; hexCode: string }>;
};

export type SearchResponse = {
  hits: Array<{ document: SearchDocument }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type SearchParams = {
  q: string;
  page?: number;
  perPage?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  categoryId?: string;
  /** Comma-separated brand IDs */
  brandIds?: string;
  /** Comma-separated color IDs */
  colorIds?: string;
  /** Comma-separated size IDs */
  sizeIds?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Map of attrDefId → selected optionIds */
  attrFilters?: Record<string, string[]>;
};

function buildSearchUrl(params: SearchParams): string {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  if (params.perPage) qs.set("perPage", String(params.perPage));
  if (params.sort && params.sort !== "newest") qs.set("sort", params.sort);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.brandIds) qs.set("brandIds", params.brandIds);
  if (params.colorIds) qs.set("colorIds", params.colorIds);
  if (params.sizeIds) qs.set("sizeIds", params.sizeIds);
  if (params.minPrice !== undefined) qs.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) qs.set("maxPrice", String(params.maxPrice));
  for (const [defId, optIds] of Object.entries(params.attrFilters ?? {})) {
    if (optIds.length > 0) qs.set(`attr-${defId}`, optIds.join(","));
  }
  return `/search?${qs.toString()}`;
}

export function useSearch(params: SearchParams) {
  return useQuery<SearchResponse>({
    queryKey: ["search", params],
    queryFn: () => apiFetch<SearchResponse>(buildSearchUrl(params)),
    enabled: true,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
