import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { BrandsClient, type BrandItem } from "@/components/brands/BrandsClient";

export const metadata: Metadata = {
  title: "Marcas",
  description: "Todas as melhores marcas numa só loja.",
};

export default async function MarcasPage() {
  const brands = await apiFetch<BrandItem[]>("/catalog/brands", {
    next: { revalidate: Revalidate.catalog },
  }).catch(() => [] as BrandItem[]);

  return <BrandsClient brands={brands} />;
}
