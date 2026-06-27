"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type CategoryLeaf = {
  id: string;
  name: string;
  slug: string;
  position: number;
  imageUrl?: string | null;
};

/** Level-3 category — leaf node */
export type CategoryL3 = CategoryLeaf;

/** Level-2 category — may have level-3 children */
export type CategoryL2 = CategoryLeaf & {
  children: CategoryL3[];
};

/** Level-1 category — has level-2 children */
export type CategoryL1 = CategoryLeaf & {
  children: CategoryL2[];
};

/** Level-0 category — top-level, has level-1 children */
export type CategoryL0 = CategoryLeaf & {
  children: CategoryL1[];
};

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useCategoryTree() {
  return useQuery<CategoryL0[]>({
    queryKey: ["category-tree"],
    queryFn: () => apiFetch<CategoryL0[]>("/catalog/categories"),
    staleTime: 5 * 60 * 1000,
  });
}
