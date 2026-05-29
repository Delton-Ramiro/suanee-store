import { useSyncExternalStore } from "react";

export type FavoriteItem = {
  productId: string;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  price: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  categoryName: string | null;
  colorName: string | null;
  sizeName: string | null;
};

type FavoritesState = {
  items: FavoriteItem[];
  isOpen: boolean;
};

const STORAGE_KEY = "suanee_favorites";

function loadItems(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

let state: FavoritesState = { items: loadItems(), isOpen: false };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  } catch {}
}

function setState(next: Partial<FavoritesState>) {
  state = { ...state, ...next };
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): FavoritesState {
  return state;
}

function getServerSnapshot(): FavoritesState {
  return SERVER_SNAPSHOT;
}

const SERVER_SNAPSHOT: FavoritesState = { items: [], isOpen: false };

export const favoritesStore = {
  /** Toggle a product in favorites */
  toggle(item: FavoriteItem) {
    const exists = state.items.some((i) => i.productId === item.productId);
    if (exists) {
      setState({
        items: state.items.filter((i) => i.productId !== item.productId),
      });
    } else {
      setState({ items: [...state.items, item] });
    }
    persist();
  },

  remove(productId: string) {
    setState({ items: state.items.filter((i) => i.productId !== productId) });
    persist();
  },

  isFavorited(productId: string) {
    return state.items.some((i) => i.productId === productId);
  },

  open() {
    setState({ isOpen: true });
  },

  close() {
    setState({ isOpen: false });
  },
};

export function useFavorites() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
