"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { ProductsPage } from "./useProducts";

export type CollectionProductFilters = {
  page?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  brand?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
};

function buildUrl(slug: string, filters: CollectionProductFilters): string {
  const params = new URLSearchParams();
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.color) params.set("color", filters.color);
  if (filters.size) params.set("size", filters.size);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  const qs = params.toString();
  return `/catalog/collections/${slug}/products${qs ? `?${qs}` : ""}`;
}

export function useCollectionProducts(slug: string, filters: CollectionProductFilters = {}) {
  return useQuery<ProductsPage>({
    queryKey: ["collection-products", slug, filters],
    queryFn: () => apiFetch<ProductsPage>(buildUrl(slug, filters)),
    enabled: Boolean(slug),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
