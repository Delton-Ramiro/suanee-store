import HomeCategories from "@/components/home/HomeCategories";
import { HomeStories } from "@/components/home/HomeStories";
import { HomeBrands } from "@/components/home/HomeBrands";
import { HomeTrend } from "@/components/home/HomeTrend";
import { apiFetch } from "@/lib/api";
import { Revalidate } from "@/lib/revalidate";
import type { Category } from "@/lib/hooks/useCategories";
import type { Story } from "@/lib/hooks/useStory";
import type { Brand } from "@/components/home/HomeBrands";
import type { Collection } from "@/components/home/HomeTrend";

async function getCategories(): Promise<Category[]> {
  try {
    const data = await apiFetch<Category[]>(
      "/catalog/categories?orderBy=position",
      {
        next: { revalidate: Revalidate.catalog },
      },
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getStories(): Promise<Story[]> {
  try {
    const data = await apiFetch<Story[]>("/stories", {
      next: { revalidate: Revalidate.stories },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getBrands(): Promise<Brand[]> {
  try {
    const data = await apiFetch<Brand[]>("/catalog/brands", {
      next: { revalidate: Revalidate.catalog },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getCollections(): Promise<Collection[]> {
  try {
    const data = await apiFetch<Collection[]>(
      "/catalog/collections?orderBy=position",
      {
        next: { revalidate: Revalidate.catalog },
      },
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [categories, stories, brands, collections] = await Promise.all([
    getCategories(),
    getStories(),
    getBrands(),
    getCollections(),
  ]);
  return (
    <div>
      <HomeStories stories={stories} />
      <HomeCategories categories={categories} />
      <HomeBrands brands={brands} />
      <HomeTrend collections={collections} />
    </div>
  );
}
