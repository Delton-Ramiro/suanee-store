import HomeCategories from "@/components/home/HomeCategories";
import { HomeStories } from "@/components/home/HomeStories";
import { apiFetch } from "@/lib/api";
import type { Category } from "@/lib/hooks/useCategories";
import type { Story } from "@/lib/hooks/useStory";

async function getCategories(): Promise<Category[]> {
  try {
    const data = await apiFetch<Category[]>("/catalog/categories", {
      next: { revalidate: 300 },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getStories(): Promise<Story[]> {
  try {
    const data = await apiFetch<Story[]>("/stories", {
      next: { revalidate: 120 },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [categories, stories] = await Promise.all([
    getCategories(),
    getStories(),
  ]);
  return (
    <div>
      <HomeStories stories={stories} />
      <HomeCategories categories={categories} />
    </div>
  );
}
