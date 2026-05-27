import HomeCategories, { type HomeCategory } from "@/components/home/HomeCategories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function getCategories(): Promise<HomeCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/catalog/categories`, {
      next: { revalidate: 300 },
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as HomeCategory[]) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const categories = await getCategories();
  return (
    <div>
      <HomeCategories categories={categories} />
    </div>
  );
}
