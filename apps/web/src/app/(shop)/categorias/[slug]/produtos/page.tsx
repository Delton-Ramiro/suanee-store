import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { ProductsClient } from "@/components/products/ProductsClient";
import type { SubCategory } from "@/components/products/FilterSidebar";

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
  children?: SubCategory[];
};

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const category = await apiFetch<CategoryInfo>(`/catalog/categories/${slug}`, {
    next: { revalidate: Revalidate.catalog },
  }).catch(() => null);

  if (!category) notFound();

  // Level 1 (DB) = Level 2 (user) — show sub-category filter for its children
  const subCategories: SubCategory[] =
    category.level === 1 && category.children && category.children.length > 0
      ? category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
      : [];

  return (
    <div className="py-6">
      <ProductsClient
        category={category}
        subCategories={subCategories.length > 0 ? subCategories : undefined}
      />
    </div>
  );
}
