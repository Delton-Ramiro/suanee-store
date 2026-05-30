import { useSyncExternalStore } from "react";
import { authFetch } from "../api";

export type CartItem = {
  key: string; // `${productId}__${colorId ?? ""}__${sizeId ?? ""}`
  productId: string;
  variantId?: string | null;    // ProductVariant.id — needed for server sync
  serverItemId?: string | null; // CartItem.id on server — needed for PATCH/DELETE
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  categoryName: string | null;
  price: number;
  isIndicativePrice: boolean;
  stockQuantity: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
};

const STORAGE_KEY = "suanee_cart";

function loadItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

let state: CartState = { items: loadItems(), isOpen: false };
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

function setState(next: Partial<CartState>) {
  state = { ...state, ...next };
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): CartState {
  return state;
}

const SERVER_SNAPSHOT: CartState = { items: [], isOpen: false };

function getServerSnapshot(): CartState {
  return SERVER_SNAPSHOT;
}

export function cartItemKey(
  productId: string,
  colorId: string | null,
  sizeId: string | null,
): string {
  return `${productId}__${colorId ?? ""}__${sizeId ?? ""}`;
}

export const cartStore = {
  /** Read the current items array (used by sync utilities). */
  getItems(): CartItem[] {
    return state.items;
  },

  /** Replace all items — called when loading from server. */
  setItems(items: CartItem[]) {
    setState({ items });
    persist();
  },

  /** Store the server-assigned CartItem.id after a successful POST. */
  updateServerItemId(key: string, serverItemId: string) {
    setState({
      items: state.items.map((i) =>
        i.key === key ? { ...i, serverItemId } : i,
      ),
    });
    persist();
  },

  /** Add item — no-op if same variant already in cart. */
  add(item: Omit<CartItem, "quantity">) {
    const existing = state.items.find((i) => i.key === item.key);
    if (existing) {
      setState({ isOpen: true });
      return;
    }
    setState({
      items: [...state.items, { ...item, quantity: 1 }],
      isOpen: true,
    });
    persist();

    // Sync to server when a variantId is known and user is authenticated
    if (item.variantId) {
      authFetch<{ id: string }>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productVariantId: item.variantId, quantity: 1 }),
      })
        .then(({ id }) => cartStore.updateServerItemId(item.key, id))
        .catch(() => {}); // stays local-only; synced on next login
    }
  },

  /** Remove item by key. */
  remove(key: string) {
    const item = state.items.find((i) => i.key === key);
    setState({ items: state.items.filter((i) => i.key !== key) });
    persist();

    if (item?.serverItemId) {
      authFetch(`/cart/items/${item.serverItemId}`, { method: "DELETE" }).catch(
        () => {},
      );
    }
  },

  /** Increase or decrease quantity; capped at stockQuantity, min 1. */
  updateQty(key: string, delta: number) {
    let newQty = 0;
    setState({
      items: state.items.map((i) => {
        if (i.key !== key) return i;
        const next = Math.max(1, Math.min(i.stockQuantity, i.quantity + delta));
        newQty = next;
        return { ...i, quantity: next };
      }),
    });
    persist();

    const item = state.items.find((i) => i.key === key);
    if (item?.serverItemId && newQty > 0) {
      authFetch(`/cart/items/${item.serverItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: newQty }),
      }).catch(() => {});
    }
  },

  open() {
    setState({ isOpen: true });
  },

  close() {
    setState({ isOpen: false });
  },
};

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
