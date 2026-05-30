"use client";

import { X } from "lucide-react";
import { useFavorites, favoritesStore } from "@/lib/stores/favoritesStore";

function formatPrice(v: number): string {
  return `MZN ${Math.round(v).toLocaleString("pt-PT")}`;
}

export function FavoritesDrawer() {
  const { items, isOpen } = useFavorites();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={favoritesStore.close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[540px] bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-modal="true"
        role="dialog"
        aria-label="Favoritos"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[25px] py-[45px] pb-0 shrink-0">
          <h2 className="text-[24px] font-medium text-black">Favoritos</h2>
          <button
            onClick={favoritesStore.close}
            aria-label="Fechar favoritos"
            className="w-[24px] h-[24px] flex items-center justify-center text-black hover:opacity-70 transition-opacity"
          >
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

      {/* Items */}
        <div className="flex-1 overflow-y-auto px-[25px] py-[30px] flex flex-col gap-[5px]">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-muted text-sm">
                Ainda não tens favoritos.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <FavoriteItemRow key={item.productId} item={item} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function FavoriteItemRow({
  item,
}: {
  item: import("@/lib/stores/favoritesStore").FavoriteItem;
}) {
  return (
    <div className="flex gap-[10px] items-stretch">
      {/* Image */}
      <a href={`/produtos/${item.slug}`} onClick={favoritesStore.close}>
        <div className="w-25 h-37.5 shrink-0 rounded-sm bg-muted-bg overflow-hidden hover:opacity-90 transition-opacity">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted-bg" />
          )}
        </div>
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-[9px]">
        {/* Name + brand */}
        <div>
          <a
            href={`/produtos/${item.slug}`}
            onClick={favoritesStore.close}
            className="hover:opacity-70 transition-opacity"
          >
            <p className="text-[15px] font-light text-black leading-tight">
              {item.name}
            </p>
          </a>
          <p className="text-sm text-text-muted mt-1">{item.brandName}</p>
        </div>

        {/* Price */}
        <div>
          {item.hasDiscount && item.discountPrice ? (
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-black">
                {formatPrice(item.discountPrice)}
              </p>
              <p className="text-sm text-text-muted line-through">
                {formatPrice(item.price)}
              </p>
            </div>
          ) : (
            <p className="text-[15px] font-bold text-black">
              {item.isIndicativePrice ? "~ " : ""}
              {formatPrice(item.price)}
            </p>
          )}
        </div>

        {/* Remove */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => favoritesStore.remove(item.productId)}
            className="border border-black text-black text-[13px] rounded-[20px] px-[19px] py-[3px] hover:bg-black hover:text-white transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
