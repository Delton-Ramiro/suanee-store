"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { ProductsPage } from "./useProducts";

export type BrandProductFilters = {
  page?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  cats?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Extra query params forwarded verbatim (e.g. attrg-* for merged attribute filters). */
  extra?: Record<string, string>;
};

function buildUrl(brandSlug: string, filters: BrandProductFilters): string {
  const params = new URLSearchParams();
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.cats) params.set("cat", filters.cats);
  if (filters.color) params.set("color", filters.color);
  if (filters.size) params.set("size", filters.size);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  for (const [key, value] of Object.entries(filters.extra ?? {})) {
    params.set(key, value);
  }
  const qs = params.toString();
  return `/catalog/brand/${brandSlug}/products${qs ? `?${qs}` : ""}`;
}

export function useBrandProducts(brandSlug: string, filters: BrandProductFilters = {}) {
  return useQuery<ProductsPage>({
    queryKey: ["brand-products", brandSlug, filters],
    queryFn: () => apiFetch<ProductsPage>(buildUrl(brandSlug, filters)),
    enabled: Boolean(brandSlug),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
