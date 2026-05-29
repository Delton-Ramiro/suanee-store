import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { ProductDetailClient } from "@/components/products/ProductDetailClient";

export type ProductVariant = {
  id: string;
  sku: string;
  stockQuantity: number;
  price: number | null;
  hasDiscount: boolean;
  discountPrice: number | null;
  isIndicativePrice: boolean;
  color: { id: string; name: string; hexCode: string; slug: string } | null;
  size: {
    id: string;
    name: string;
    label: string | null;
    sizeSystem: string;
  } | null;
};

export type ProductMedia = {
  id: string;
  url: string;
  mediaType: string;
  colorId: string | null;
  position: number;
  isPrimary: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  stockStatus: string;
  genderScope: string | null;
  keyCharacteristics: string | null;
  productInfo: string | null;
  sendPolicy: string | null;
  sizeAndFit: string | null;
  returnPolicy: string | null;
  createdAt: string;
  brand: { id: string; name: string; slug: string; logoUrl: string | null };
  categories: Array<{
    category: {
      id: string;
      name: string;
      slug: string;
      level: number;
      parentId: string | null;
    };
  }>;
  media: ProductMedia[];
  variants: ProductVariant[];
  sizes: Array<{
    size: {
      id: string;
      name: string;
      label: string | null;
      sizeSystem: string;
    };
  }>;
  attributes: Array<{
    definition: { id: string; name: string; inputType: string };
    option: { id: string; label: string; value: string };
  }>;
  sizeGuide: {
    id: string;
    name: string;
    description: string | null;
    images: string[];
  } | null;
  relatedProducts: Array<{
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    isIndicativePrice: boolean;
    hasDiscount: boolean;
    discountPrice: number | null;
    brand: { id: string; name: string; slug: string };
    media: Array<{ id: string; url: string; mediaType: string; isPrimary: boolean }>;
    variants: Array<{ colorId: string | null; color: { id: string; name: string; hexCode: string } | null }>;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await apiFetch<ProductDetail>(`/catalog/products/${slug}`, {
    next: { revalidate: Revalidate.products },
  }).catch(() => null);

  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await apiFetch<ProductDetail>(`/catalog/products/${slug}`, {
    next: { revalidate: Revalidate.products },
  }).catch(() => null);

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
