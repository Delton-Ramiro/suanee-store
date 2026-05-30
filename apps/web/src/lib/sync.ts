import { apiFetch } from "./api";
import { cartStore, CartItem } from "./stores/cartStore";
import { favoritesStore, FavoriteItem } from "./stores/favoritesStore";

// ── Types matching the GET /cart and GET /favorites API responses ──

interface ServerCartItem {
  id: string;
  quantity: number;
  variant: {
    id: string;
    stockQuantity: number;
    color: { id: string; name: string; hexCode: string } | null;
    size: { id: string; name: string; label: string } | null;
    product: {
      id: string;
      name: string;
      slug: string;
      basePrice: number;
      hasDiscount: boolean;
      discountPrice: number | null;
      brand: { id: string; name: string };
      media: Array<{ url: string; colorId: string | null }>;
    };
  };
}

interface ServerFavoriteItem {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    hasDiscount: boolean;
    discountPrice: number | null;
    brand: { id: string; name: string };
    media: Array<{ url: string }>;
  };
}

// ── Transforms ────────────────────────────────────────────────────

function pickVariantImage(
  media: Array<{ url: string; colorId: string | null }>,
  colorId: string | null,
): string | null {
  // 1. Exact color match
  const exact = media.find((m) => m.colorId === colorId);
  if (exact) return exact.url;
  // 2. Fall back to a color-neutral (shared) image
  const neutral = media.find((m) => m.colorId === null);
  if (neutral) return neutral.url;
  // 3. Any image
  return media[0]?.url ?? null;
}

function toLocalCartItem(item: ServerCartItem): CartItem {
  const { variant } = item;
  const { product } = variant;
  const colorId = variant.color?.id ?? null;
  const sizeId = variant.size?.id ?? null;
  return {
    key: `${product.id}__${colorId ?? ""}__${sizeId ?? ""}`,
    productId: product.id,
    variantId: variant.id,
    serverItemId: item.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brand.name,
    imageUrl: pickVariantImage(product.media, colorId),
    colorId,
    colorName: variant.color?.name ?? null,
    sizeId,
    sizeName: variant.size?.label ?? variant.size?.name ?? null,
    categoryName: null,
    price: Number(product.discountPrice ?? product.basePrice),
    isIndicativePrice: false,
    stockQuantity: variant.stockQuantity,
    quantity: item.quantity,
  };
}

function toLocalFavItem(item: ServerFavoriteItem): FavoriteItem {
  const { product } = item;
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brand.name,
    imageUrl: product.media[0]?.url ?? null,
    price: Number(product.discountPrice ?? product.basePrice),
    hasDiscount: product.hasDiscount,
    discountPrice: product.discountPrice != null ? Number(product.discountPrice) : null,
    isIndicativePrice: false,
  };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Fetch server cart and favorites, replace local store state.
 * Called on every session restore (app reload while logged in).
 */
export async function loadFromServer(token: string): Promise<void> {
  const [cartRes, favsRes] = await Promise.all([
    apiFetch<{ items: ServerCartItem[] }>("/cart", {
      headers: authHeaders(token),
    }),
    apiFetch<{ items: ServerFavoriteItem[] }>("/favorites?limit=100", {
      headers: authHeaders(token),
    }),
  ]);

  cartStore.setItems(cartRes.items.map(toLocalCartItem));
  favoritesStore.setItems(favsRes.items.map(toLocalFavItem));
}

/**
 * Merge anonymous local state into the user's account, then load the
 * resulting server state into local stores.
 *
 * Conflict rule: if the server already has a variant (cart) or product (fav),
 * the server version wins — the local item is discarded.
 *
 * Called once, right after a successful login/signup.
 */
export async function syncWithServer(token: string): Promise<void> {
  // Snapshot anonymous local state BEFORE touching anything
  const localCart = cartStore.getItems();
  const localFavs = favoritesStore.getItems();

  // Fetch current server state to detect which local items are new
  const [cartRes, favsRes] = await Promise.all([
    apiFetch<{ items: ServerCartItem[] }>("/cart", {
      headers: authHeaders(token),
    }),
    apiFetch<{ items: ServerFavoriteItem[] }>("/favorites?limit=100", {
      headers: authHeaders(token),
    }),
  ]);

  const serverVariantIds = new Set(cartRes.items.map((i) => i.variant.id));
  const serverProductIds = new Set(favsRes.items.map((i) => i.product.id));

  // Push local-only items to the server in parallel; ignore individual errors
  // (409 = already there or out of stock, 404 = product removed — both are fine)
  await Promise.allSettled([
    ...localCart
      .filter((i) => i.variantId && !serverVariantIds.has(i.variantId))
      .map((i) =>
        apiFetch("/cart/items", {
          method: "POST",
          body: JSON.stringify({
            productVariantId: i.variantId,
            quantity: i.quantity,
          }),
          headers: authHeaders(token),
        }),
      ),
    ...localFavs
      .filter((i) => !serverProductIds.has(i.productId))
      .map((i) =>
        apiFetch("/favorites", {
          method: "POST",
          body: JSON.stringify({ productId: i.productId }),
          headers: authHeaders(token),
        }),
      ),
  ]);

  // Reload the now-merged authoritative server state into local stores
  await loadFromServer(token);
}
