import { useSyncExternalStore } from "react";

export type CartItem = {
  key: string; // `${productId}__${colorId ?? ""}__${sizeId ?? ""}`
  productId: string;
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

function getServerSnapshot(): CartState {
  return SERVER_SNAPSHOT;
}

const SERVER_SNAPSHOT: CartState = { items: [], isOpen: false };

export function cartItemKey(
  productId: string,
  colorId: string | null,
  sizeId: string | null,
): string {
  return `${productId}__${colorId ?? ""}__${sizeId ?? ""}`;
}

export const cartStore = {
  /** Add item — no-op if same variant already in cart */
  add(item: Omit<CartItem, "quantity">) {
    const existing = state.items.find((i) => i.key === item.key);
    if (existing) {
      // Already in cart — just open drawer
      setState({ isOpen: true });
      return;
    }
    setState({
      items: [...state.items, { ...item, quantity: 1 }],
      isOpen: true,
    });
    persist();
  },

  /** Remove item by key */
  remove(key: string) {
    setState({ items: state.items.filter((i) => i.key !== key) });
    persist();
  },

  /** Increase or decrease quantity; capped at stockQuantity, min 1 */
  updateQty(key: string, delta: number) {
    setState({
      items: state.items.map((i) => {
        if (i.key !== key) return i;
        const next = Math.max(1, Math.min(i.stockQuantity, i.quantity + delta));
        return { ...i, quantity: next };
      }),
    });
    persist();
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
