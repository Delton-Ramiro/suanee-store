"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

export type ProductMediaItem = {
  id: string;
  url: string;
  mediaType: "image" | "video";
  isPrimary: boolean;
};

export type ProductColorSwatch = {
  colorId: string;
  color: { id: string; name: string; hexCode: string };
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  stockStatus: "in_stock" | "by_importation";
  brand: { id: string; name: string; slug: string };
  media: ProductMediaItem[];
  variants: ProductColorSwatch[];
};

export type ProductsPage = {
  items: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type ProductFilters = {
  page?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  /** Comma-separated brand IDs */
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Comma-separated color IDs */
  color?: string;
  /** Comma-separated size IDs */
  size?: string;
  /** Map of attrDefId → selected optionIds */
  attrFilters?: Record<string, string[]>;
};

function buildProductsUrl(slug: string, filters: ProductFilters): string {
  const params = new URLSearchParams();

  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.sort && filters.sort !== "newest")
    params.set("sort", filters.sort);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.minPrice !== undefined)
    params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined)
    params.set("maxPrice", String(filters.maxPrice));
  if (filters.color) params.set("color", filters.color);
  if (filters.size) params.set("size", filters.size);

  for (const [defId, optIds] of Object.entries(filters.attrFilters ?? {})) {
    if (optIds.length > 0) params.set(`attr-${defId}`, optIds.join(","));
  }

  const qs = params.toString();
  return `/catalog/categories/${slug}/products${qs ? `?${qs}` : ""}`;
}

export function useProducts(slug: string, filters: ProductFilters = {}) {
  return useQuery<ProductsPage>({
    queryKey: ["products", slug, filters],
    queryFn: () => apiFetch<ProductsPage>(buildProductsUrl(slug, filters)),
    enabled: Boolean(slug),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
