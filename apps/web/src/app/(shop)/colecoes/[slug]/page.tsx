import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import { CollectionProductsClient } from "@/components/collections/CollectionProductsClient";

type CollectionDetail = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await apiFetch<CollectionDetail>(
    `/catalog/collections/${slug}`,
    { next: { revalidate: Revalidate.catalog } },
  ).catch(() => null);
  return {
    title: collection?.name ?? "Coleção",
    description: collection
      ? `Descubra todos os produtos da coleção ${collection.name}.`
      : undefined,
  };
}

export default async function ColecaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const collection = await apiFetch<CollectionDetail>(
    `/catalog/collections/${slug}`,
    { next: { revalidate: Revalidate.catalog } },
  ).catch(() => null);

  if (!collection) notFound();

  return (
    <div className="py-6">
      <CollectionProductsClient collection={collection} />
    </div>
  );
}
