import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { BrandProductsClient } from "@/components/brands/BrandProductsClient";

type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  landingImage1Url: string | null;
  landingImage2Url: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await apiFetch<BrandDetail>(`/catalog/brand/${slug}`, {
    next: { revalidate: Revalidate.catalog },
  }).catch(() => null);
  return {
    title: brand?.name ?? "Marca",
    description: brand ? `Descubra todos os produtos da marca ${brand.name}.` : undefined,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const brand = await apiFetch<BrandDetail>(`/catalog/brand/${slug}`, {
    next: { revalidate: Revalidate.catalog },
  }).catch(() => null);

  if (!brand) notFound();

  return (
    <div className="py-6">
      <BrandProductsClient brand={brand} />
    </div>
  );
}
