"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type Category = {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
  children?: Category[];
  parent?: Category | null;
};

export type CategoryDetail = Category & {
  parent: (Category & { parent: Category | null }) | null;
  children: (Category & {
    _count: { products: number };
    children: Category[];
  })[];
  _count: { products: number };
};

type CategoryProductsParams = {
  page?: number;
  limit?: number;
  view?: "all" | "available" | "importation" | "draft" | "subcategories";
  search?: string;
  sortBy?: "createdAt" | "name";
  sortOrder?: "asc" | "desc";
};

type CategoryProductsResponse = {
  items?: AdminProductListItem[];
  subcategories?: Category[];
  total?: number;
  page?: number;
  totalPages?: number;
};

export type AdminProductListItem = {
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

type CreateCategoryPayload = {
  name: string;
  slug: string;
  level: number;
  parentId?: string;
  imageUrl?: string | null;
  position?: number;
  isActive?: boolean;
};

type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

/** Returns the full category tree (root categories + nested children). */
export function useCategories(
  params?: { search?: string; level?: number },
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.level !== undefined) qs.set("level", String(params.level));
  const query = qs.toString();
  return useQuery<Category[]>({
    queryKey: ["categories", params],
    queryFn: () =>
      apiFetch<Category[]>(`/admin/categories${query ? `?${query}` : ""}`),
    enabled: options.enabled ?? true,
  });
}

/** Returns a single category with parent chain and children. */
export function useCategory(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<CategoryDetail>({
    queryKey: ["category", id],
    queryFn: () => apiFetch<CategoryDetail>(`/admin/categories/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}

/** Paginated products (or subcategories) belonging to a category. */
export function useCategoryProducts(
  id: string | null,
  params: CategoryProductsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.view) qs.set("view", params.view);
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);

  return useQuery<CategoryProductsResponse>({
    queryKey: ["category-products", id, params],
    queryFn: () =>
      apiFetch<CategoryProductsResponse>(
        `/admin/categories/${id}/products?${qs}`,
      ),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryPayload) =>
      apiFetch<Category>("/admin/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryPayload }) =>
      apiFetch<Category>(`/admin/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["category", id] });
      toast.success("Categoria atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCategoryNextPosition(
  level: number | null,
  parentId?: string | null,
) {
  const qs = new URLSearchParams();
  if (level !== null) qs.set("level", String(level));
  if (parentId) qs.set("parentId", parentId);

  return useQuery<{ nextPosition: number; occupiedPositions: number[] }>({
    queryKey: ["category-next-position", level, parentId ?? null],
    queryFn: () =>
      apiFetch<{ nextPosition: number; occupiedPositions: number[] }>(
        `/admin/categories/next-position?${qs}`,
      ),
    enabled: level !== null,
  });
}
