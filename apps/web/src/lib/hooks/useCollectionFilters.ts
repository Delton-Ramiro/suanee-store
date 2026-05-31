"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

export type CollectionFilters = {
  brands: Array<{ id: string; name: string; slug: string; logoUrl: string | null }>;
  colors: Array<{ id: string; name: string; hexCode: string; slug: string }>;
  sizes: Array<{ id: string; name: string; label: string; sizeSystem: string }>;
};

export function useCollectionFilters(collectionSlug: string) {
  return useQuery<CollectionFilters>({
    queryKey: ["collection-filters", collectionSlug],
    queryFn: () =>
      apiFetch<CollectionFilters>(`/catalog/collections/${collectionSlug}/filters`),
    enabled: Boolean(collectionSlug),
    staleTime: 120_000,
  });
}
