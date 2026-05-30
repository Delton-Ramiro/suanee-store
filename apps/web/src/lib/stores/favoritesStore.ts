import { useSyncExternalStore } from "react";
import { authFetch } from "../api";

export type FavoriteItem = {
  productId: string;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  price: number;
  hasDiscount: boolean;
  discountPrice: number | null;
  isIndicativePrice: boolean;
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

const SERVER_SNAPSHOT: FavoritesState = { items: [], isOpen: false };

function getServerSnapshot(): FavoritesState {
  return SERVER_SNAPSHOT;
}

export const favoritesStore = {
  /** Read the current items array (used by sync utilities). */
  getItems(): FavoriteItem[] {
    return state.items;
  },

  /** Replace all items — called when loading from server. */
  setItems(items: FavoriteItem[]) {
    setState({ items });
    persist();
  },

  toggle(item: FavoriteItem) {
    const exists = state.items.some((i) => i.productId === item.productId);
    if (exists) {
      setState({ items: state.items.filter((i) => i.productId !== item.productId) });
      authFetch(`/favorites/${item.productId}`, { method: "DELETE" }).catch(() => {});
    } else {
      setState({ items: [...state.items, item] });
      authFetch("/favorites", {
        method: "POST",
        body: JSON.stringify({ productId: item.productId }),
      }).catch(() => {});
    }
    persist();
  },

  remove(productId: string) {
    setState({ items: state.items.filter((i) => i.productId !== productId) });
    persist();
    authFetch(`/favorites/${productId}`, { method: "DELETE" }).catch(() => {});
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
