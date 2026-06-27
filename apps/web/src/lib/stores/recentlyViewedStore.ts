const KEY = "recently_viewed_products";
const MAX = 6;

export type RecentlyViewedProduct = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  basePrice: number;
  hasDiscount: boolean;
  discountPrice: number | null;
  isIndicativePrice: boolean;
};

function read(): RecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentlyViewedProduct[];
  } catch {
    return [];
  }
}

function write(items: RecentlyViewedProduct[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const recentlyViewedStore = {
  /** Add a product to the front of the list. Deduplicates and trims to MAX. */
  add(product: RecentlyViewedProduct) {
    const current = read().filter((p) => p.id !== product.id);
    write([product, ...current].slice(0, MAX));
  },

  /** Return all stored products (most recent first). */
  getAll(): RecentlyViewedProduct[] {
    return read();
  },

  /** Return all stored products excluding a given product id. */
  getExcluding(excludeId: string): RecentlyViewedProduct[] {
    return read().filter((p) => p.id !== excludeId);
  },
};
