"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { favoritesStore, useFavorites } from "@/lib/stores/favoritesStore";

function formatPrice(value: number): string {
  // Portuguese format: 6.500 (dot as thousands, no decimals for whole numbers)
  return `MZN ${Math.round(value).toLocaleString("pt-PT")}`;
}

function discountPercent(base: number, discounted: number): number {
  return Math.round(((base - discounted) / base) * 100);
}

const MAX_SWATCHES = 5;

export interface ProductCardItem {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isIndicativePrice: boolean;
  hasDiscount: boolean;
  discountPrice: number | null;
  brand: { id: string; name: string; slug: string };
  media: Array<{
    id?: string;
    url: string;
    mediaType: string;
    isPrimary?: boolean;
  }>;
  variants: Array<{
    colorId: string | null;
    color: { id: string; name: string; hexCode: string } | null;
  }>;
}

export function ProductCard({
  product,
  compact = false,
}: {
  product: ProductCardItem;
  compact?: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { items: favoriteItems } = useFavorites();
  const isFavorited = favoriteItems.some((i) => i.productId === product.id);

  const media = product.media;
  const hasMultiple = media.length > 1;

  const colorSwatches = product.variants
    .filter((v) => v.colorId && v.color)
    .slice(0, MAX_SWATCHES) as Array<{
    colorId: string;
    color: { id: string; name: string; hexCode: string };
  }>;
  const extraColors =
    product.variants.filter((v) => v.colorId && v.color).length > MAX_SWATCHES
      ? product.variants.filter((v) => v.colorId && v.color).length -
        MAX_SWATCHES
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
      className="group flex flex-col gap-[15px]"
      prefetch={false}
    >
      {/* Image area — overflow-hidden clips everything including hover effects */}
      <div className="relative rounded-[5px] overflow-hidden bg-muted-bg aspect-[3/4]">
        {/* Scrollable media strip */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
        >
          {media.length > 0 ? (
            media.map((item, i) => (
              <div
                key={item.id ?? i}
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
            <span className="text-[10px] font-normal text-primary bg-white px-[16px] py-[2px] leading-tight rounded-tl-[5px] tracking-[0.2px]">
              Preço indicativo
            </span>
          )}
          {product.hasDiscount && discountPrice !== null && (
            <span className="text-[10px] font-bold text-white bg-brand px-3 py-[2px] leading-tight tracking-[0.2px]">
              {discountPercent(basePrice, discountPrice)}% Off
            </span>
          )}
        </div>

        {/* Heart — top right */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            favoritesStore.toggle({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              brandName: product.brand.name,
              imageUrl: media[0]?.url ?? null,
              price: basePrice,
              hasDiscount: product.hasDiscount,
              discountPrice,
              isIndicativePrice: product.isIndicativePrice,
            });
          }}
          className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center transition-colors"
          aria-label={
            isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"
          }
        >
          <Heart
            size={20}
            strokeWidth={1.5}
            className={
              isFavorited
                ? "fill-danger text-danger"
                : "text-accent hover:text-primary"
            }
          />
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
      <div className="flex flex-col gap-3.75">
        <div className="flex flex-col gap-1">
          <p
            className={`font-bold text-text-dark leading-tight tracking-[0.38px] ${
              compact ? "text-h6" : "text-h5"
            }`}
          >
            {product.brand.name}
          </p>
          <p className="text-[13px] font-normal text-text-dark tracking-[0.26px] leading-snug line-clamp-2">
            {product.name}
          </p>
        </div>

        {compact ? (
          /* Compact (search) — price stacked, swatches below */
          <div className="flex items-center justify-between gap-2 pr-6">
            <span
              className={`text-h6 font-bold leading-none ${
                product.isIndicativePrice ? "text-accent" : "text-text-dark"
              }`}
            >
              {formatPrice(basePrice)}
            </span>

            {colorSwatches.length > 0 && (
              <div className="flex items-center gap-1.25 flex-none pt-1">
                {colorSwatches.map(({ colorId, color }) => (
                  <div
                    key={colorId}
                    title={color.name}
                    className="size-2.5 flex-none"
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
        ) : (
          /* Default — price + swatches inline */
          <div className="flex items-center justify-between gap-2 pr-6.25">
            <span
              className={`text-[16px] font-bold whitespace-nowrap tracking-[0.32px] ${
                product.isIndicativePrice ? "text-accent" : "text-text-dark"
              }`}
            >
              {formatPrice(basePrice)}
            </span>

            {colorSwatches.length > 0 && (
              <div className="flex items-center gap-1.25 flex-none">
                {colorSwatches.map(({ colorId, color }) => (
                  <div
                    key={colorId}
                    title={color.name}
                    className="size-3.5 flex-none"
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
        )}
      </div>
    </Link>
  );
}
