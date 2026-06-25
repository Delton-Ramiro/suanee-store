"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

export type FilterOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

export type AttributeFilter = {
  id: string;
  name: string;
  slug: string;
  inputType: "multi_select" | "single_select" | "range" | "boolean";
  options: FilterOption[];
};

export type ColorOption = {
  id: string;
  name: string;
  hexCode: string;
  slug: string;
};

export type SizeOption = {
  id: string;
  name: string;
  label: string;
  sizeSystem: string;
};

export type BrandOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type CategoryFilters = {
  filters: AttributeFilter[];
  colors: ColorOption[];
  sizes: SizeOption[];
  brands: BrandOption[];
};

export function useAllColors() {
  return useQuery<ColorOption[]>({
    queryKey: ["all-colors"],
    queryFn: () => apiFetch<ColorOption[]>("/catalog/colors"),
    staleTime: 5 * 60_000,
  });
}

export function useAllBrands() {
  return useQuery<BrandOption[]>({
    queryKey: ["all-brands"],
    queryFn: () =>
      apiFetch<{ id: string; name: string; slug: string; logoUrl: string | null }[]>(
        "/catalog/brands",
      ).then((rows) =>
        rows.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          logoUrl: b.logoUrl,
        })),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useCategoryFilters(slug: string, colorSearch?: string) {
  const qs = colorSearch
    ? `?colorSearch=${encodeURIComponent(colorSearch)}`
    : "";
  return useQuery<CategoryFilters>({
    queryKey: ["category-filters", slug, colorSearch ?? ""],
    queryFn: () =>
      apiFetch<CategoryFilters>(`/catalog/categories/${slug}/filters${qs}`),
    enabled: Boolean(slug),
    staleTime: 120_000,
  });
}
