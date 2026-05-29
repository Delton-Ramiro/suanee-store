import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { ProductsClient } from "@/components/products/ProductsClient";

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
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

  return (
    <div className="py-6">
      <ProductsClient category={category} />
    </div>
  );
}
