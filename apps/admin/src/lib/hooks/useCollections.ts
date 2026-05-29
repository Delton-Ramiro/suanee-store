"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type Collection = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  position: number;
  isActive: boolean;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
};

type CollectionsResponse = {
  items: Collection[];
  total: number;
  page: number;
  totalPages: number;
};

type CollectionProductsResponse = {
  items: CollectionProduct[];
  total: number;
  page: number;
  totalPages: number;
};

export type CollectionProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
  stockStatus: string;
  createdAt: string;
  brand: { id: string; name: string } | null;
  media: { url: string; mediaType: string }[];
};

type CollectionsParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortOrder?: "asc" | "desc";
};

type CollectionProductsParams = {
  page?: number;
  limit?: number;
  view?: "all" | "available" | "importation" | "draft";
  search?: string;
  sortBy?: "createdAt" | "name";
  sortOrder?: "asc" | "desc";
};

type CreateCollectionPayload = {
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  position?: number;
  isActive?: boolean;
  categoryId?: string | null;
};

type UpdateCollectionPayload = Partial<CreateCollectionPayload>;

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useCollections(
  params: CollectionsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.isActive !== undefined)
    qs.set("isActive", String(params.isActive));
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);

  return useQuery<CollectionsResponse>({
    queryKey: ["collections", params],
    queryFn: () => apiFetch<CollectionsResponse>(`/admin/collections?${qs}`),
    enabled: options.enabled ?? true,
  });
}

export function useCollection(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<Collection>({
    queryKey: ["collection", id],
    queryFn: () => apiFetch<Collection>(`/admin/collections/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCollectionProducts(
  id: string | null,
  params: CollectionProductsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.view && params.view !== "all") qs.set("view", params.view);
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);

  return useQuery<CollectionProductsResponse>({
    queryKey: ["collection-products", id, params],
    queryFn: () =>
      apiFetch<CollectionProductsResponse>(
        `/admin/collections/${id}/products?${qs}`,
      ),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCollectionPayload) =>
      apiFetch<Collection>("/admin/collections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Coleção criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCollectionPayload }) =>
      apiFetch<Collection>(`/admin/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collection", id] });
      toast.success("Coleção actualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Coleção eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddProductsToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      productIds,
    }: {
      collectionId: string;
      productIds: string[];
    }) =>
      apiFetch<{ count: number }>(
        `/admin/collections/${collectionId}/products`,
        { method: "POST", body: JSON.stringify({ productIds }) },
      ),
    onSuccess: (_data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: ["collection-products", collectionId] });
      qc.invalidateQueries({ queryKey: ["collection", collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Produto(s) adicionado(s) à coleção");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveProductFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      productId,
    }: {
      collectionId: string;
      productId: string;
    }) =>
      apiFetch<void>(
        `/admin/collections/${collectionId}/products/${productId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: ["collection-products", collectionId] });
      qc.invalidateQueries({ queryKey: ["collection", collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Produto removido da coleção");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCollectionNextPosition(categoryId?: string | null) {
  const qs = categoryId ? `?categoryId=${categoryId}` : "";
  return useQuery<{ nextPosition: number; occupiedPositions: number[] }>({
    queryKey: ["collection-next-position", categoryId ?? null],
    queryFn: () =>
      apiFetch<{ nextPosition: number; occupiedPositions: number[] }>(
        `/admin/collections/next-position${qs}`,
      ),
  });
}
