"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type BrandCategory = {
  category: { id: string; name: string; level?: number };
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  brandCategories: BrandCategory[];
  _count?: { products: number };
};

type BrandsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type BrandsResponse = {
  items: Brand[];
  total: number;
  page: number;
  totalPages: number;
};

type BrandPayload = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  status?: "draft" | "published";
  categoryIds?: string[];
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useBrands(
  params: BrandsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<BrandsResponse>({
    queryKey: ["brands", params],
    queryFn: () => apiFetch<BrandsResponse>(`/admin/brands?${qs.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export function useBrand(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<Brand>({
    queryKey: ["brand", id],
    queryFn: () => apiFetch<Brand>(`/admin/brands/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BrandPayload) =>
      apiFetch<Brand>("/admin/brands", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BrandPayload> }) =>
      apiFetch<Brand>(`/admin/brands/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["brand", id] });
      toast.success("Marca atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
