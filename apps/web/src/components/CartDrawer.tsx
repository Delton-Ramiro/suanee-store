"use client";

import { X, Minus, Plus } from "lucide-react";
import { useCart, cartStore } from "@/lib/stores/cartStore";

function formatPrice(v: number): string {
  return `MZN ${Math.round(v).toLocaleString("pt-PT")}`;
}

export function CartDrawer() {
  const { items, isOpen } = useCart();

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const hasIndicative = items.some((i) => i.isIndicativePrice);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={cartStore.close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[540px] bg-white flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
        aria-modal="true"
        role="dialog"
        aria-label="Carrinho"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[25px] py-[45px] pb-0 shrink-0">
          <h2 className="text-[24px] font-medium text-black">Carrinho</h2>
          <button
            onClick={cartStore.close}
            aria-label="Fechar carrinho"
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
                O teu carrinho está vazio.
              </p>
            </div>
          ) : (
            items.map((item) => <CartItemRow key={item.key} item={item} />)
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="shrink-0 bg-white shadow-[0px_-2px_4px_0px_rgba(16,87,142,0.31)] px-[32px] py-[27px]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-px">
                <p className="text-[19px] font-medium text-brand">
                  {formatPrice(total)}
                </p>

                <p className="text-[10px] text-brand font-medium">
                  *Preço indicativo
                </p>
              </div>
              <button
                type="button"
                className="bg-black text-white text-[16px] font-bold w-[208px] h-[50px] hover:bg-brand transition-colors"
              >
                Conversar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function CartItemRow({
  item,
}: {
  item: import("@/lib/stores/cartStore").CartItem;
}) {
  return (
    <div className="flex gap-[10px] items-stretch">
      {/* Image */}
      <div className="w-25 h-37.5 shrink-0 rounded-sm bg-muted-bg overflow-hidden">
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

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-[9px]">
        {/* Top: name + price */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-light text-black leading-tight">
            {item.name}
          </p>
          <p className="text-[16px] font-bold text-muted-bg whitespace-nowrap shrink-0">
            {formatPrice(item.price)}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-2 my-2">
          {item.categoryName && (
            <p className="text-sm text-black leading-none">
              <span className="font-bold">Categoria</span>
              <span className="font-light">: {item.categoryName}</span>
            </p>
          )}
          {item.colorName && (
            <p className="text-sm text-black leading-none">
              <span className="font-bold">Cor</span>
              <span className="font-light">: {item.colorName}</span>
            </p>
          )}
          {item.sizeName && (
            <p className="text-sm text-black leading-none">
              <span className="font-bold">Tamanho</span>
              <span className="font-light">: {item.sizeName}</span>
            </p>
          )}
        </div>

        {/* Bottom: qty + eliminar */}
        <div className="flex items-center justify-between">
          {/* Qty control */}
          <div className="flex items-center gap-[10px] h-[30px] rounded-[8px] w-[79px] justify-center border border-border">
            <button
              type="button"
              onClick={() => cartStore.updateQty(item.key, -1)}
              disabled={item.quantity <= 1}
              className="text-muted-bg hover:text-black disabled:opacity-30 transition-colors flex items-center justify-center"
              aria-label="Diminuir quantidade"
            >
              <Minus size={14} strokeWidth={2} />
            </button>
            <span className="text-[13px] font-semibold text-muted-bg min-w-[14px] text-center">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => cartStore.updateQty(item.key, 1)}
              disabled={item.quantity >= item.stockQuantity}
              className="text-muted-bg hover:text-black disabled:opacity-30 transition-colors flex items-center justify-center"
              aria-label="Aumentar quantidade"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Eliminar */}
          <button
            type="button"
            onClick={() => cartStore.remove(item.key)}
            className="border border-black text-black text-[13px] rounded-[20px] px-[19px] py-[3px] hover:bg-black hover:text-white transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
