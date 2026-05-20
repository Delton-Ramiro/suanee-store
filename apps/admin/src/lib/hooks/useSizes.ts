"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SizeCategory = {
  category: {
    id: string;
    name: string;
    level: number;
    parentId: string | null;
  };
};

export type Size = {
  id: string;
  name: string;
  slug: string;
  label: string;
  sizeSystem: "EU" | "US" | "UK" | "IT" | "universal";
  position: number;
  createdAt: string;
  updatedAt: string;
  sizeCategories: SizeCategory[];
  _count?: { productVariants: number };
};

type SizesParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
  categoryIds?: string[]; // filter by category associations
};

type SizesResponse = {
  items: Size[];
  total: number;
  page: number;
  totalPages: number;
};

type SizePayload = {
  name: string;
  label: string;
  sizeSystem?: "EU" | "US" | "UK" | "IT" | "universal";
  categoryIds?: string[];
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useSizes(params: SizesParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.categoryIds?.length)
    qs.set("categoryIds", params.categoryIds.join(","));
  return useQuery<SizesResponse>({
    queryKey: ["sizes", params],
    queryFn: () => apiFetch<SizesResponse>(`/admin/sizes?${qs.toString()}`),
  });
}

export function useSize(id: string | null) {
  return useQuery<Size>({
    queryKey: ["size", id],
    queryFn: () => apiFetch<Size>(`/admin/sizes/${id}`),
    enabled: !!id,
  });
}

export function useCreateSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SizePayload) =>
      apiFetch<Size>("/admin/sizes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sizes"] });
      toast.success("Tamanho criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SizePayload> }) =>
      apiFetch<Size>(`/admin/sizes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["sizes"] });
      qc.invalidateQueries({ queryKey: ["size", id] });
      toast.success("Tamanho atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/sizes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sizes"] });
      toast.success("Tamanho eliminado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/* ── Size Guide Types ────────────────────────────────────────────────────── */

export type SizeGuideImage = { url: string; position: number };

export type SizeGuide = {
  id: string;
  name: string;
  description?: string | null;
  images: SizeGuideImage[];
  createdAt: string;
  updatedAt: string;
};

type SizeGuidesParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type SizeGuidesResponse = {
  items: SizeGuide[];
  total: number;
  page: number;
  totalPages: number;
};

type SizeGuidePayload = {
  name: string;
  description?: string;
  images: SizeGuideImage[];
};

/* ── Size Guide Hooks ────────────────────────────────────────────────────── */

export function useSizeGuides(params: SizeGuidesParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<SizeGuidesResponse>({
    queryKey: ["size-guides", params],
    queryFn: () =>
      apiFetch<SizeGuidesResponse>(`/admin/sizes/guides?${qs.toString()}`),
  });
}

export function useSizeGuide(id: string | null) {
  return useQuery<SizeGuide>({
    queryKey: ["size-guide", id],
    queryFn: () => apiFetch<SizeGuide>(`/admin/sizes/guides/${id}`),
    enabled: !!id,
  });
}

export function useCreateSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SizeGuidePayload) =>
      apiFetch<SizeGuide>("/admin/sizes/guides", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["size-guides"] });
      toast.success("Guia de tamanhos criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SizeGuidePayload>;
    }) =>
      apiFetch<SizeGuide>(`/admin/sizes/guides/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["size-guides"] });
      qc.invalidateQueries({ queryKey: ["size-guide", id] });
      toast.success("Guia de tamanhos atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/sizes/guides/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["size-guides"] });
      toast.success("Guia de tamanhos eliminado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
