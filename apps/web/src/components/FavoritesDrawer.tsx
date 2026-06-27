"use client";

import { useFavorites, favoritesStore } from "@/lib/stores/favoritesStore";
import { DrawerPanel, DrawerItemRow } from "./DrawerPanel";

function fmt(v: number) {
  return `MZN ${Math.round(v).toLocaleString("pt-PT")}`;
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
        <p className="text-sm text-text-muted text-center py-16">
          Ainda não tens favoritos.
        </p>
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
            price={fmt(item.hasDiscount && item.discountPrice ? item.discountPrice : item.price)}
            originalPrice={item.hasDiscount && item.discountPrice ? fmt(item.price) : undefined}
            indicativePrice={item.isIndicativePrice}
            meta={[item.brandName]}
            actions={
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => favoritesStore.remove(item.productId)}
                  className="text-xs text-brand/50 hover:text-brand transition-colors underline underline-offset-2"
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
