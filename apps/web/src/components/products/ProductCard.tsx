"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { ProductListItem } from "@/lib/hooks/useProducts";

function formatPrice(value: number): string {
  // Portuguese format: 6.500 (dot as thousands, no decimals for whole numbers)
  return `MZN ${Math.round(value).toLocaleString("pt-PT")}`;
}

function discountPercent(base: number, discounted: number): number {
  return Math.round(((base - discounted) / base) * 100);
}

const MAX_SWATCHES = 5;

export function ProductCard({ product }: { product: ProductListItem }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const media = product.media;
  const hasMultiple = media.length > 1;

  const colorSwatches = product.variants.slice(0, MAX_SWATCHES);
  const extraColors =
    product.variants.length > MAX_SWATCHES
      ? product.variants.length - MAX_SWATCHES
      : 0;

  const basePrice = Number(product.basePrice);
  const discountPrice = product.discountPrice
    ? Number(product.discountPrice)
    : null;

  function handleScroll() {
    if (!scrollRef.current || !hasMultiple) return;
    const el = scrollRef.current;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(Math.min(idx, media.length - 1));
  }

  return (
    <Link
      href={`/produtos/${product.slug}`}
      className="group flex flex-col gap-2"
      prefetch={false}
    >
      {/* Image area — overflow-hidden clips everything including hover effects */}
      <div className="relative rounded-[10px] overflow-hidden bg-muted-bg aspect-[3/4]">
        {/* Scrollable media strip */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
        >
          {media.length > 0 ? (
            media.map((item, i) => (
              <div
                key={item.id}
                className="flex-none w-full h-full snap-center relative overflow-hidden"
              >
                {item.mediaType === "video" ? (
                  <video
                    src={item.url}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={`${product.name} ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
              </div>
            ))
          ) : (
            <div className="w-full h-full bg-muted-bg flex items-center justify-center flex-none">
              <span className="text-text-light text-xs">Sem imagem</span>
            </div>
          )}
        </div>

        {/* Tags — flush to top-left corner, stacked vertically */}
        <div className="absolute top-0 left-0 flex flex-col pointer-events-none">
          {product.isIndicativePrice && (
            <span className="text-[11px] font-bold text-white bg-brand px-3 py-1 leading-tight">
              Preço indicativo
            </span>
          )}
          {product.hasDiscount && discountPrice !== null && (
            <span className="text-[11px] font-bold text-white bg-brand px-3 py-1 leading-tight">
              {discountPercent(basePrice, discountPrice)}% Off
            </span>
          )}
        </div>

        {/* Like — top right, blue */}
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="absolute top-0 right-0 w-[30px] h-[30px] flex items-center justify-center text-accent hover:text-primary transition-colors"
          aria-label="Adicionar aos favoritos"
        >
          <Heart size={16} strokeWidth={1.5} />
        </button>

        {/* Segmented progress bar — bottom of image */}
        {hasMultiple && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] flex gap-[1px] pointer-events-none">
            {media.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-full transition-colors duration-300 ${
                  i <= activeIdx ? "bg-brand" : "bg-accent/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-[3px]">
        <p className="text-[11px] font-bold text-brand uppercase tracking-[0.38px]">
          {product.brand.name}
        </p>
        <p className="text-sm text-brand leading-snug line-clamp-2 tracking-[0.02em]">
          {product.name}
        </p>

        {/* Price + color swatches on same row */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {/* Price */}
          <div className="flex items-baseline gap-2 min-w-0">
            {product.hasDiscount && discountPrice !== null ? (
              <>
                <span className="text-sm font-bold text-brand whitespace-nowrap">
                  {formatPrice(discountPrice)}
                </span>
                <span className="text-[11px] font-bold text-text-light line-through whitespace-nowrap">
                  {formatPrice(basePrice)}
                </span>
              </>
            ) : (
              <span
                className={`text-sm font-bold whitespace-nowrap ${
                  product.isIndicativePrice ? "text-accent" : "text-brand"
                }`}
              >
                {formatPrice(basePrice)}
              </span>
            )}
          </div>

          {/* Color swatches — square, right side */}
          {colorSwatches.length > 0 && (
            <div className="flex items-center gap-[5px] flex-none">
              {colorSwatches.map(({ colorId, color }) => (
                <div
                  key={colorId}
                  title={color.name}
                  className="w-3.5 h-3.5 flex-none"
                  style={{ backgroundColor: color.hexCode }}
                />
              ))}
              {extraColors > 0 && (
                <span className="text-[10px] text-text-muted font-medium">
                  +{extraColors}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
