"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

export type CatNode = {
  id: string;
  name: string;
  slug: string;
  children: CatNode[];
};

export type AttrDefWithCats = {
  id: string;
  name: string;
  inputType: string;
  categoryIds: string[];
  options: Array<{ id: string; label: string; value: string; position: number }>;
};

export type BrandFilters = {
  categories: CatNode[];
  colors: Array<{ id: string; name: string; hexCode: string; slug: string }>;
  sizes: Array<{ id: string; name: string; label: string; sizeSystem: string }>;
  filters: AttrDefWithCats[];
};

export function useBrandFilters(brandSlug: string) {
  return useQuery<BrandFilters>({
    queryKey: ["brand-filters", brandSlug],
    queryFn: () => apiFetch<BrandFilters>(`/catalog/brand/${brandSlug}/filters`),
    enabled: Boolean(brandSlug),
    staleTime: 120_000,
  });
}
