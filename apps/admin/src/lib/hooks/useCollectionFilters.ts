"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type CollectionFilterOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

export type CollectionFilterCollection = {
  collectionId: string;
};

export type CollectionFilter = {
  id: string;
  name: string;
  slug: string;
  inputType: "select" | "multi_select" | "boolean";
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  options: CollectionFilterOption[];
  collections: CollectionFilterCollection[];
  _count?: { options: number };
};

type CollectionFiltersParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type CollectionFiltersResponse = {
  items: CollectionFilter[];
  total: number;
  page: number;
  totalPages: number;
};

export type CollectionFilterPayload = {
  name: string;
  inputType: "multi_select" | "single_select" | "range" | "boolean";
  isActive?: boolean;
  collectionIds: string[];
  options: { label: string; value: string; position?: number }[];
};

export type CollectionFilterUpdatePayload = {
  name?: string;
  slug?: string;
  inputType?: "multi_select" | "single_select" | "range" | "boolean";
  isActive?: boolean;
  collectionIds?: string[];
  options?: { id?: string; label: string; value: string; position?: number }[];
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useCollectionFilters(params: CollectionFiltersParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<CollectionFiltersResponse>({
    queryKey: ["collection-filters", params],
    queryFn: () =>
      apiFetch<CollectionFiltersResponse>(
        `/admin/collection-filters?${qs.toString()}`,
      ),
  });
}

export function useCreateCollectionFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CollectionFilterPayload) =>
      apiFetch<CollectionFilter>("/admin/collection-filters", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-filters"] });
      toast.success("Filtro de coleção criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCollectionFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CollectionFilterUpdatePayload;
    }) =>
      apiFetch<CollectionFilter>(`/admin/collection-filters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-filters"] });
      toast.success("Filtro de coleção atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCollectionFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/collection-filters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-filters"] });
      toast.success("Filtro de coleção eliminado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCollectionFilterOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionId: string) =>
      apiFetch<void>(`/admin/collection-filters/options/${optionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-filters"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
