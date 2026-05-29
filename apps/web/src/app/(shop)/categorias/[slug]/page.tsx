import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import type { Brand } from "@/components/home/HomeBrands";
import type { Collection } from "@/components/home/HomeTrend";
import {
  CategorySubcategories,
  type CategoryChild,
} from "@/components/category/CategorySubcategories";
import { CategoryBrands } from "@/components/category/CategoryBrands";
import { CategoryCollections } from "@/components/category/CategoryCollections";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type CategoryDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  level: number;
  children: CategoryChild[];
};

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [category, brands, collections] = await Promise.all([
    apiFetch<CategoryDetail>(`/catalog/categories/${slug}`, {
      next: { revalidate: Revalidate.catalog },
    }).catch(() => null),
    apiFetch<Brand[]>("/catalog/brands", {
      next: { revalidate: Revalidate.catalog },
    }).catch(() => []),
    apiFetch<Collection[]>(`/catalog/collections?categorySlug=${slug}&orderBy=position`, {
      next: { revalidate: Revalidate.catalog },
    }).catch(() => []),
  ]);

  if (!category) notFound();

  const l1Children = (category.children ?? []).sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="py-8 md:pt-10">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="font-inter font-medium text-2xl md:text-h2 text-black tracking-[0.02em] leading-none mt-0.5">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-2 text-text-muted text-sm md:text-base leading-normal max-w-xl">
            {category.description}
          </p>
        ) : (
          <p className="mt-2 text-text-muted text-sm md:text-base leading-normal">
            {`As roupas e acessórios de ${category.name.toLowerCase()} que vai adorar...`}
          </p>
        )}
      </div>

      {/* ── L1 Subcategories strip ───────────────────────────────── */}
      <CategorySubcategories children={l1Children} />

      {/* ── Brands ──────────────────────────────────────────────── */}
      <CategoryBrands brands={brands} />

      {/* ── Collections (Momentos especiais) ────────────────────── */}
      <CategoryCollections collections={collections} />
    </div>
  );
}
