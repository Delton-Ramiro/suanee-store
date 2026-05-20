"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type AdminProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
  stockStatus: string;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string } | null;
  media: { url: string; mediaType: string }[];
  _count: { variants: number };
};

type AdminProductsResponse = {
  items: AdminProduct[];
  total: number;
  page: number;
  totalPages: number;
};

type AdminProductsParams = {
  page?: number;
  limit?: number;
  search?: string;
  view?: "all" | "available" | "importation" | "draft" | "hidden";
  sortBy?: "createdAt" | "name" | "basePrice";
  sortOrder?: "asc" | "desc";
  brandId?: string;
  categoryId?: string;
  hasCollection?: boolean;
};

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useAdminProducts(
  params: AdminProductsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("limit", String(params.limit ?? 10));
  if (params.search) qs.set("search", params.search);
  if (params.view && params.view !== "all") qs.set("view", params.view);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.brandId) qs.set("brandId", params.brandId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.hasCollection !== undefined)
    qs.set("hasCollection", String(params.hasCollection));

  return useQuery<AdminProductsResponse>({
    queryKey: ["admin-products", params],
    queryFn: () => apiFetch<AdminProductsResponse>(`/admin/products?${qs}`),
    enabled: options.enabled ?? true,
  });
}
