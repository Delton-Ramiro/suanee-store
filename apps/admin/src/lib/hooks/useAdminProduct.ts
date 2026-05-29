"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiError } from "../api";

function toastApiError(err: Error) {
  if (err instanceof ApiError && err.details && err.details.length > 0) {
    toast.error([err.message, ...err.details.map((d) => `• ${d}`)].join("\n"));
  } else {
    toast.error(err.message);
  }
}

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type ProductMediaItem = {
  id: string;
  url: string;
  mediaType: "image" | "video";
  colorId: string | null;
  position: number;
  isPrimary: boolean;
  color?: { id: string; name: string; hexCode: string } | null;
};

export type ProductVariantItem = {
  id: string;
  colorId: string;
  sizeId: string;
  sku: string;
  stockQuantity: number;
  price: number | null;
  hasDiscount: boolean;
  discountPrice: number | null;
  isIndicativePrice: boolean;
  position: number;
  color?: { id: string; name: string; hexCode: string };
  size?: { id: string; name: string; label: string };
};

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brandId: string;
  brand: { id: string; name: string; slug: string } | null;
  sizeGuideId: string | null;
  sizeGuide: { id: string; name: string } | null;
  basePrice: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  stockStatus: "in_stock" | "by_importation";
  status: "draft" | "published" | "archived";
  isVisible: boolean;
  keyCharacteristics: string | null;
  productInfo: string | null;
  sendPolicy: string | null;
  returnPolicy: string | null;
  deliveryEstimate: string | null;
  mainColorId: string | null;
  collections: { collectionId: string }[];
  categories: { categoryId: string }[];
  variants: ProductVariantItem[];
  media: ProductMediaItem[];
  sizes: { sizeId: string }[];
  attributes: { attributeDefinitionId: string; attributeOptionId: string }[];
  createdAt: string;
  updatedAt: string;
};

export type CreateProductPayload = {
  name: string;
  slug: string;
  brandId: string;
  basePrice: number;
  stockStatus: "in_stock" | "by_importation";
  status?: "draft" | "published";
  description?: string;
  isIndicativePrice?: boolean;
  hasDiscount?: boolean;
  discountPrice?: number;
  isVisible?: boolean;
  keyCharacteristics?: string;
  productInfo?: string;
  sendPolicy?: string;
  returnPolicy?: string;
  deliveryEstimate?: string;
  sizeGuideId?: string;
  collectionIds?: string[];
  categoryIds?: string[];
  sizeIds?: string[];
  attributes?: {
    attributeDefinitionId: string;
    attributeOptionIds: string[];
  }[];
  variants?: {
    colorId: string;
    sizeId: string;
    stockQuantity: number;
    price?: number;
    hasDiscount?: boolean;
    discountPrice?: number;
    isIndicativePrice?: boolean;
    position?: number;
  }[];
  media?: {
    url: string;
    mediaType: "image" | "video";
    colorId?: string | null;
    isPrimary?: boolean;
    position?: number;
  }[];
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useAdminProduct(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<AdminProductDetail>({
    queryKey: ["admin-product", id],
    queryFn: () => apiFetch<AdminProductDetail>(`/admin/products/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useProductVariants(id: string | null) {
  return useQuery<ProductVariantItem[]>({
    queryKey: ["admin-product-variants", id],
    queryFn: () =>
      apiFetch<ProductVariantItem[]>(`/admin/products/${id}/variants`),
    enabled: !!id,
  });
}

export function useProductMedia(id: string | null) {
  return useQuery<ProductMediaItem[]>({
    queryKey: ["admin-product-media", id],
    queryFn: () => apiFetch<ProductMediaItem[]>(`/admin/products/${id}/media`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductPayload) =>
      apiFetch<AdminProductDetail>("/admin/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err: Error) => toastApiError(err),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProductPayload) =>
      apiFetch<AdminProductDetail>(`/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err: Error) => toastApiError(err),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Produto eliminado com sucesso");
    },
    onError: (err: Error) => toastApiError(err),
  });
}

export type RelatedProductItem = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  brand: { id: string; name: string };
  media: Array<{ url: string; mediaType: string }>;
};

export function useRelatedProducts(id: string | null) {
  return useQuery<RelatedProductItem[]>({
    queryKey: ["admin-product-related", id],
    queryFn: () =>
      apiFetch<RelatedProductItem[]>(`/admin/products/${id}/related`),
    enabled: !!id,
  });
}

export function useUpdateRelatedProducts(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relatedProductIds: string[]) =>
      apiFetch<{ count: number }>(`/admin/products/${id}/related`, {
        method: "PUT",
        body: JSON.stringify({ relatedProductIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product-related", id] });
      toast.success("Produtos relacionados guardados");
    },
    onError: (err: Error) => toastApiError(err),
  });
}
