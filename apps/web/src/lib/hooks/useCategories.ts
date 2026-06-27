"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type Category = {
  id: string;
  name: string;
  slug: string;
  position: number;
  imageUrl?: string | null;
};

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useCategories(options: { enabled?: boolean } = {}) {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/catalog/categories"),
    enabled: options.enabled ?? true,
  });
}
