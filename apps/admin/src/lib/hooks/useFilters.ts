"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type FilterOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

export type FilterCategory = {
  categoryId: string;
};

export type Filter = {
  id: string;
  name: string;
  slug: string;
  inputType: "select" | "multi_select" | "boolean";
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  options: FilterOption[];
  categories: FilterCategory[];
  _count?: { options: number };
};

type FiltersParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type FiltersResponse = {
  items: Filter[];
  total: number;
  page: number;
  totalPages: number;
};

export type FilterPayload = {
  name: string;
  inputType: "multi_select" | "single_select" | "range" | "boolean";
  isActive?: boolean;
  categoryIds: string[];
  options: { label: string; value: string; position?: number }[];
};

export type FilterUpdatePayload = {
  name?: string;
  slug?: string;
  inputType?: "multi_select" | "single_select" | "range" | "boolean";
  isActive?: boolean;
  categoryIds?: string[];
  options?: { id?: string; label: string; value: string; position?: number }[];
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useFilters(params: FiltersParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<FiltersResponse>({
    queryKey: ["filters", params],
    queryFn: () => apiFetch<FiltersResponse>(`/admin/filters?${qs.toString()}`),
  });
}

export function useCreateFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FilterPayload) =>
      apiFetch<Filter>("/admin/filters", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filters"] });
      toast.success("Filtro criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FilterUpdatePayload }) =>
      apiFetch<Filter>(`/admin/filters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filters"] });
      toast.success("Filtro atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/filters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filters"] });
      toast.success("Filtro eliminado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteFilterOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionId: string) =>
      apiFetch<void>(`/admin/filters/options/${optionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filters"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
