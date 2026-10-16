"use client";

import { Heart } from "lucide-react";
import { useFavorites, favoritesStore } from "@/lib/stores/favoritesStore";
import { DrawerPanel, DrawerItemRow } from "./DrawerPanel";

function fmtMoney(v: number) {
  return `${Math.round(v).toLocaleString("pt-MZ")} MZN`;
}

export function FavoritesDrawer() {
  const { items, isOpen } = useFavorites();

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={favoritesStore.close}
      title="Favoritos"
      ariaLabel="Favoritos"
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Heart size={24} strokeWidth={1} className="text-border" />
          <p className="text-sm text-text-muted text-center">Ainda não tens favoritos.</p>
        </div>
      ) : (
        items.map((item) => (
          <DrawerItemRow
            key={item.productId}
            imageUrl={item.imageUrl}
            imageHref={`/produtos/${item.slug}`}
            onImageClick={favoritesStore.close}
            name={item.name}
            nameHref={`/produtos/${item.slug}`}
            onNameClick={favoritesStore.close}
            brandName={item.brandName}
            price={fmtMoney(item.hasDiscount && item.discountPrice ? item.discountPrice : item.price)}
            originalPrice={item.hasDiscount && item.discountPrice ? fmtMoney(item.price) : undefined}
            indicativePrice={item.isIndicativePrice}
            actions={
              <button
                type="button"
                onClick={() => favoritesStore.remove(item.productId)}
                className="text-[11px] text-text-muted hover:text-brand transition-colors underline underline-offset-2"
              >
                Eliminar
              </button>
            }
          />
        ))
      )}
    </DrawerPanel>
  );
}
