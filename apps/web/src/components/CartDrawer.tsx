"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, ChevronDown } from "lucide-react";
import { useCart, cartStore, cartItemKey, type CartItem } from "@/lib/stores/cartStore";
import { chatStore } from "@/lib/stores/chatStore";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { DrawerPanel, DrawerItemRow } from "./DrawerPanel";

function fmtMoney(v: number) {
  return `${Math.round(v).toLocaleString("pt-MZ")} MZN`;
}

// ── Types ──────────────────────────────────────────────────────────────────

type SizeOption = {
  variantId: string;
  sizeId: string;
  label: string;
  stockQuantity: number;
  price: number;
  isIndicativePrice: boolean;
};

type ProductVariantsResponse = {
  basePrice: number;
  isIndicativePrice: boolean;
  variants: Array<{
    id: string;
    stockQuantity: number;
    price: string | number | null;
    isIndicativePrice: boolean;
    color: { id: string } | null;
    size: { id: string; name: string; label: string | null } | null;
  }>;
};

// ── Size selector ──────────────────────────────────────────────────────────

function SizeSelector({ item }: { item: CartItem }) {
  const [options, setOptions] = useState<SizeOption[] | null>(null);

  useEffect(() => {
    apiFetch<ProductVariantsResponse>(`/catalog/products/${item.slug}`)
      .then((p) => {
        const opts = p.variants
          .filter((v) => {
            if (!v.size) return false;
            const colorMatch = item.colorId ? v.color?.id === item.colorId : !v.color;
            return colorMatch && v.stockQuantity > 0;
          })
          .map((v) => ({
            variantId: v.id,
            sizeId: v.size!.id,
            label: v.size!.label ?? v.size!.name,
            stockQuantity: v.stockQuantity,
            price: Number(v.price ?? p.basePrice),
            isIndicativePrice: v.isIndicativePrice ?? p.isIndicativePrice,
          }));
        setOptions(opts);
      })
      .catch(() => setOptions([]));
  }, [item.slug, item.colorId]);

  function handleChange(variantId: string) {
    const opt = options?.find((o) => o.variantId === variantId);
    if (!opt || opt.sizeId === item.sizeId) return;

    // If that size is already in the cart, don't duplicate
    const key = cartItemKey(item.productId, item.colorId, opt.sizeId);
    if (cartStore.getItems().some((i) => i.key === key)) return;

    cartStore.remove(item.key);
    cartStore.add({
      key,
      productId: item.productId,
      variantId: opt.variantId,
      serverItemId: null,
      slug: item.slug,
      name: item.name,
      brandName: item.brandName,
      imageUrl: item.imageUrl,
      colorId: item.colorId,
      colorName: item.colorName,
      sizeId: opt.sizeId,
      sizeName: opt.label,
      categoryName: item.categoryName,
      price: opt.price,
      isIndicativePrice: opt.isIndicativePrice,
      stockQuantity: opt.stockQuantity,
    });
  }

  const currentVariantId = options?.find((o) => o.sizeId === item.sizeId)?.variantId ?? "";
  const hasChoice = options !== null && options.length > 1;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] tracking-[0.1em] uppercase text-text-muted">Tamanho</span>

      {hasChoice ? (
        <div className="relative flex items-center">
          <select
            value={currentVariantId}
            onChange={(e) => handleChange(e.target.value)}
            className="appearance-none bg-transparent text-[11px] font-semibold text-brand pr-3.5 cursor-pointer focus:outline-none"
          >
            {options!.map((o) => (
              <option key={o.variantId} value={o.variantId}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={9}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-brand/50 pointer-events-none"
          />
        </div>
      ) : (
        <span className="text-[11px] font-semibold text-brand">{item.sizeName ?? "–"}</span>
      )}
    </div>
  );
}

// ── Cart drawer ────────────────────────────────────────────────────────────

export function CartDrawer() {
  const { items, isOpen } = useCart();
  const { user } = useAuth();

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function handleConversar() {
    cartStore.close();
    if (user) {
      chatStore.open();
    } else {
      window.location.href = "/login";
    }
  }

  const footer = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-brand">Total</span>
        <span className="text-base font-bold text-brand">{fmtMoney(total)}</span>
      </div>
      <p className="text-[11px] text-text-muted -mt-2">* Preço indicativo, sujeito a confirmação</p>
      <button
        type="button"
        onClick={handleConversar}
        className="w-full h-11 bg-brand text-white text-[11px] tracking-[0.2em] uppercase font-semibold hover:bg-primary transition-colors"
      >
        Conversar
      </button>
    </div>
  );

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={cartStore.close}
      title="Carrinho"
      ariaLabel="Carrinho de compras"
      footer={items.length > 0 ? footer : undefined}
    >
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-text-muted text-center">O teu carrinho está vazio.</p>
        </div>
      ) : (
        items.map((item) => (
          <DrawerItemRow
            key={item.key}
            imageUrl={item.imageUrl}
            name={item.name}
            brandName={item.brandName}
            price={fmtMoney(item.price * item.quantity)}
            indicativePrice={item.isIndicativePrice}
            meta={[item.colorName].filter(Boolean) as string[]}
            actions={
              <div className="flex flex-col gap-2">
                {item.sizeId && <SizeSelector item={item} />}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => cartStore.updateQty(item.key, -1)}
                    disabled={item.quantity <= 1}
                    aria-label="Diminuir"
                    className="text-brand/40 hover:text-brand disabled:opacity-20 transition-colors"
                  >
                    <Minus size={11} strokeWidth={2} />
                  </button>
                  <span className="text-xs font-semibold text-brand min-w-3.5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => cartStore.updateQty(item.key, 1)}
                    disabled={item.quantity >= item.stockQuantity}
                    aria-label="Aumentar"
                    className="text-brand/40 hover:text-brand disabled:opacity-20 transition-colors"
                  >
                    <Plus size={11} strokeWidth={2} />
                  </button>
                  <span className="w-px h-3 bg-border-light mx-1" />
                  <button
                    type="button"
                    onClick={() => cartStore.remove(item.key)}
                    className="text-[11px] text-text-muted hover:text-brand transition-colors underline underline-offset-2"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            }
          />
        ))
      )}
    </DrawerPanel>
  );
}
