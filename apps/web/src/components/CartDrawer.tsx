"use client";

import { Minus, Plus } from "lucide-react";
import { useCart, cartStore } from "@/lib/stores/cartStore";
import { DrawerPanel, DrawerItemRow } from "./DrawerPanel";

function fmt(v: number) {
  return `MZN ${Math.round(v).toLocaleString("pt-PT")}`;
}

export function CartDrawer() {
  const { items, isOpen } = useCart();

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const footer = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-brand">{fmt(total)}</p>
        <p className="text-xs text-brand/50 mt-0.5">* Preço indicativo</p>
      </div>
      <button
        type="button"
        className="bg-brand text-white text-sm font-semibold px-6 h-11 hover:bg-primary transition-colors"
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
        <p className="text-sm text-text-muted text-center py-16">
          O teu carrinho está vazio.
        </p>
      ) : (
        items.map((item) => (
          <DrawerItemRow
            key={item.key}
            imageUrl={item.imageUrl}
            name={item.name}
            price={fmt(item.price)}
            meta={[
              item.brandName,
              item.colorName,
              item.sizeName,
              item.categoryName,
            ]}
            actions={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 h-7 border border-border rounded px-2">
                  <button
                    type="button"
                    onClick={() => cartStore.updateQty(item.key, -1)}
                    disabled={item.quantity <= 1}
                    aria-label="Diminuir"
                    className="text-brand/50 hover:text-brand disabled:opacity-30 transition-colors"
                  >
                    <Minus size={12} strokeWidth={2} />
                  </button>
                  <span className="text-xs font-semibold text-brand min-w-[14px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => cartStore.updateQty(item.key, 1)}
                    disabled={item.quantity >= item.stockQuantity}
                    aria-label="Aumentar"
                    className="text-brand/50 hover:text-brand disabled:opacity-30 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => cartStore.remove(item.key)}
                  className="text-xs border border-brand rounded-lg px-3 py-1 text-brand/50 hover:text-brand transition-colors "
                >
                  Eliminar
                </button>
              </div>
            }
          />
        ))
      )}
    </DrawerPanel>
  );
}
