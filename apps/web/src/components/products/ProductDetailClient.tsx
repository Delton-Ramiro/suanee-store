"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Heart, Ruler } from "lucide-react";
import type {
  ProductDetail,
  ProductMedia,
} from "@/app/(shop)/produtos/[slug]/page";
import { ProductCard } from "@/components/products/ProductCard";
import { cartStore, cartItemKey, useCart } from "@/lib/stores/cartStore";
import { favoritesStore, useFavorites } from "@/lib/stores/favoritesStore";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function formatPrice(n: number) {
  return n.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Build an ordered breadcrumb from a flat categories array. */
function buildBreadcrumb(
  cats: ProductDetail["categories"],
): Array<{ id: string; name: string; slug: string }> {
  const flat = cats.map((c) => c.category);
  const byLevel = (level: number) => flat.filter((c) => c.level === level);
  const l0 = byLevel(0)[0];
  const l1 = byLevel(1)[0];
  const l2 = byLevel(2)[0];
  return [l0, l1, l2].filter(Boolean) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function MediaItem({ item, name }: { item: ProductMedia; name: string }) {
  if (item.mediaType === "video") {
    return (
      <div className="relative w-full aspect-3/4 bg-black">
        <video
          src={item.url}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <img
      src={item.url}
      alt={name}
      className="w-full block object-cover"
      loading="lazy"
    />
  );
}

function AccordionItem({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-light last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-start justify-between w-full py-3.5 text-left gap-3"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[19px] font-medium text-brand leading-snug">
            {title}
          </span>
          {subtitle && !open && (
            <span className="text-[13px] text-brand/70">{subtitle}</span>
          )}
        </div>
        <ChevronDown
          size={24}
          className={`text-brand shrink-0 mt-0.5 transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>
      {/* Content expands downward — grid-rows trick for silky animation */}
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pb-4 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Custom dropdown for size selection */
function SizeDropdown({
  sizes,
  selectedSizeId,
  onSelect,
}: {
  sizes: Array<{ id: string; name: string; label?: string | null }>;
  selectedSizeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedSize = sizes.find((s) => s.id === selectedSizeId);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-brand rounded-xs px-4 py-3.5 text-sm bg-card focus:outline-none cursor-pointer"
      >
        <span
          className={
            selectedSize ? "text-brand font-medium" : "text-text-muted"
          }
        >
          {selectedSize
            ? (selectedSize.label ?? selectedSize.name)
            : "Seu tamanho"}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Options panel */}
      <div
        className="absolute left-0 right-0 top-full z-20 overflow-hidden transition-all duration-200 ease-in-out bg-card border border-border rounded-xs shadow-md"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", display: "grid" }}
      >
        <div className="overflow-hidden">
          {sizes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              Sem tamanhos disponíveis
            </div>
          ) : (
            sizes.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => {
                  onSelect(size.id === selectedSizeId ? null : size.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm border-b border-border-light last:border-0 transition-colors hover:bg-surface-hover ${
                  selectedSizeId === size.id
                    ? "text-brand font-semibold bg-surface-hover"
                    : "text-brand"
                }`}
              >
                {size.label ?? size.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Main component                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export function ProductDetailClient({ product }: { product: ProductDetail }) {
  /* ── Stores ──────────────────────────────────────────────────────────── */
  const { items: cartItems } = useCart();
  const { items: favoriteItems } = useFavorites();

  /* ── Unique colors from variants ─────────────────────────────────────── */
  const colors = useMemo(() => {
    const seen = new Set<string>();
    return product.variants
      .filter((v) => v.color)
      .filter((v) => {
        if (seen.has(v.color!.id)) return false;
        seen.add(v.color!.id);
        return true;
      })
      .map((v) => v.color!);
  }, [product.variants]);

  /* ── First image per color (for color thumbnails) ────────────────────── */
  const colorThumbnails = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const color of colors) {
      const img = product.media.find(
        (m) => m.colorId === color.id && m.mediaType === "image",
      );
      map[color.id] = img?.url ?? null;
    }
    return map;
  }, [colors, product.media]);

  /* ── State ───────────────────────────────────────────────────────────── */
  const [selectedColorId, setSelectedColorId] = useState<string | null>(
    colors[0]?.id ?? null,
  );
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);

  /* ── Media for selected color ────────────────────────────────────────── */
  const displayMedia = useMemo(() => {
    const sorted = [...product.media].sort((a, b) => a.position - b.position);
    if (selectedColorId) {
      const colorMedia = sorted.filter((m) => m.colorId === selectedColorId);
      if (colorMedia.length > 0) return colorMedia;
    }
    return sorted.filter((m) => m.colorId === null);
  }, [selectedColorId, product.media]);

  /* ── Sizes for selected color ────────────────────────────────────────── */
  const availableSizes = useMemo(() => {
    if (selectedColorId) {
      const seen = new Set<string>();
      return product.variants
        .filter((v) => v.color?.id === selectedColorId && v.size)
        .filter((v) => {
          if (seen.has(v.size!.id)) return false;
          seen.add(v.size!.id);
          return true;
        })
        .map((v) => v.size!);
    }
    return product.sizes.map((s) => s.size);
  }, [selectedColorId, product.variants, product.sizes]);

  /* ── Price resolution ────────────────────────────────────────────────── */
  const selectedVariant = useMemo(() => {
    if (!selectedColorId || !selectedSizeId) return null;
    return (
      product.variants.find(
        (v) => v.color?.id === selectedColorId && v.size?.id === selectedSizeId,
      ) ?? null
    );
  }, [selectedColorId, selectedSizeId, product.variants]);

  const basePrice = selectedVariant?.price ?? product.basePrice;
  const hasDiscount = selectedVariant?.hasDiscount ?? product.hasDiscount;
  const discountPrice = selectedVariant?.discountPrice ?? product.discountPrice;
  const isIndicativePrice =
    selectedVariant?.isIndicativePrice ?? product.isIndicativePrice;

  const discountPercent =
    hasDiscount && discountPrice && basePrice
      ? Math.round((1 - discountPrice / basePrice) * 100)
      : null;

  /* ── Cart / favorites helpers ────────────────────────────────────────── */
  const isFavorited = favoriteItems.some((i) => i.productId === product.id);

  const cartKey = cartItemKey(product.id, selectedColorId, selectedSizeId);
  const isInCart = cartItems.some((i) => i.key === cartKey);

  const selectedColor = colors.find((c) => c.id === selectedColorId) ?? null;
  const selectedSize =
    availableSizes.find((s) => s.id === selectedSizeId) ?? null;

  function handleAddToCart() {
    if (!selectedSizeId) return;
    const displayPrice =
      hasDiscount && discountPrice ? Number(discountPrice) : Number(basePrice);
    const thumb =
      displayMedia.find((m) => m.mediaType === "image")?.url ?? null;
    const categoryName = product.categories[0]?.category?.name ?? null;

    cartStore.add({
      key: cartKey,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      imageUrl: thumb,
      colorId: selectedColorId,
      colorName: selectedColor?.name ?? null,
      sizeId: selectedSizeId,
      sizeName: selectedSize?.label ?? selectedSize?.name ?? null,
      categoryName,
      price: displayPrice,
      isIndicativePrice,
      stockQuantity: selectedVariant?.stockQuantity ?? 999,
    });
  }

  function handleToggleFavorite() {
    const thumb =
      displayMedia.find((m) => m.mediaType === "image")?.url ?? null;
    const categoryName = product.categories[0]?.category?.name ?? null;

    favoritesStore.toggle({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      imageUrl: thumb,
      price: Number(basePrice),
      isIndicativePrice,
      hasDiscount,
      discountPrice: discountPrice ? Number(discountPrice) : null,
      categoryName,
      colorName: selectedColor?.name ?? null,
      sizeName: selectedSize?.label ?? selectedSize?.name ?? null,
    });
  }

  /* ── Breadcrumb ──────────────────────────────────────────────────────── */
  const breadcrumb = buildBreadcrumb(product.categories);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="py-5 md:py-8">
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-border">/</span>}
              <Link
                href={`/categorias/${crumb.slug}`}
                className="hover:text-brand transition-colors capitalize"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      {/* Main 2-col layout */}
      <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start">
        {/* ── Left: Image gallery ─────────────────────────────────────── */}
        <div className="w-full md:flex-1 relative">
          {/* Tags — top-left of image area, no margin */}
          {(discountPercent !== null || isIndicativePrice) && (
            <div className="absolute top-0 left-0 z-10 flex flex-col gap-1">
              {discountPercent !== null && (
                <span className="px-2.5 py-1 text-xxs font-bold text-white bg-brand leading-none">
                  -{discountPercent}%
                </span>
              )}
              {isIndicativePrice && (
                <span className="px-2.5 py-1 text-xxs font-bold text-white bg-accent leading-none">
                  Preço indicativo
                </span>
              )}
            </div>
          )}

          {/* 2-column masonry grid */}
          {displayMedia.length > 0 ? (
            <div
              key={selectedColorId ?? "base"}
              className="columns-2 gap-[5px] animate-product-media"
            >
              {displayMedia.map((item) => (
                <div
                  key={item.id}
                  className="mb-[5px] break-inside-avoid overflow-hidden"
                >
                  <MediaItem item={item} name={product.name} />
                </div>
              ))}
            </div>
          ) : (
            <div className="aspect-3/4 bg-muted-bg rounded-[10px]" />
          )}
        </div>

        {/* ── Right: Product info panel ───────────────────────────────── */}
        <div className="w-full md:w-87.5 lg:w-100 shrink-0 md:sticky md:top-[calc(var(--spacing-nav)+24px)]">
          {/* Brand + Heart row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-md font-bold text-brand">{product.brand.name}</p>
            <button
              type="button"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              aria-label={
                isFavorited
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"
              }
              onClick={handleToggleFavorite}
            >
              <Heart
                size={17}
                className={
                  isFavorited
                    ? "fill-danger text-danger"
                    : "text-text-muted hover:text-danger"
                }
              />
            </button>
          </div>

          {/* Product name */}
          <h1 className="text-base md:text-lg font-medium text-muted-bg leading-snug mb-4">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-2.5 flex-wrap mb-5">
            {hasDiscount && discountPrice ? (
              <>
                <span className="text-md font-bold text-brand">
                  {formatPrice(discountPrice)} MZN
                </span>
                <span className="text-sm text-text-muted line-through">
                  {formatPrice(basePrice)} MZN
                </span>
              </>
            ) : (
              <span
                className={`text-md font-bold ${isIndicativePrice ? "text-accent" : "text-brand"}`}
              >
                {formatPrice(basePrice)} MZN
              </span>
            )}
            {isIndicativePrice && (
              <span className="text-xs text-brand font-medium">
                Preço indicativo
              </span>
            )}
          </div>

          {/* Color thumbnails — first image of each color variant */}
          {colors.length > 0 && (
            <div className="mt-10 mb-5">
              <div className="flex flex-wrap gap-3">
                {colors.map((color) => {
                  const thumb = colorThumbnails[color.id];
                  const isSelected = selectedColorId === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        setSelectedColorId(color.id);
                        setSelectedSizeId(null);
                      }}
                      className="flex flex-col items-center gap-1.5 shrink-0"
                    >
                      <span
                        className={`block w-[72px] h-[72px] rounded overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border ring-brand/30"
                            : "border-transparent hover:border-brand/40"
                        }`}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={color.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className="block w-full h-full"
                            style={{ backgroundColor: color.hexCode }}
                          />
                        )}
                      </span>
                      {isSelected && (
                        <span className="text-[13px] text-text-muted lowercase leading-none">
                          {color.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          <div className="mb-8">
            <SizeDropdown
              sizes={availableSizes}
              selectedSizeId={selectedSizeId}
              onSelect={setSelectedSizeId}
            />
          </div>

          {/* Size guide link */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-brand underline underline-offset-2 mb-6 hover:opacity-70 transition-opacity"
          >
            <Ruler size={13} />
            Guia de tamanho
          </button>

          {/* Add to cart */}
          <button
            type="button"
            disabled={!selectedSizeId}
            onClick={handleAddToCart}
            className={`w-full py-4 rounded-xs font-bold text-sm tracking-[0.12em] uppercase mb-8 transition-colors ${
              selectedSizeId
                ? isInCart
                  ? "bg-success text-white cursor-pointer hover:bg-success/90"
                  : "bg-brand text-white hover:bg-primary cursor-pointer"
                : "bg-border text-text-muted cursor-not-allowed"
            }`}
          >
            {isInCart ? "No carrinho" : "Adicionar"}
          </button>

          {/* Info accordions */}
          <div className="mt-5 border-t flex flex-col gap-3 border-border-light">
            <AccordionItem title="Características-chave do produto">
              {product.keyCharacteristics ?? "Informação não disponível."}
            </AccordionItem>

            <AccordionItem title="Informação do produto">
              {product.productInfo ?? "Informação não disponível."}
            </AccordionItem>

            <AccordionItem title="Política de envio" subtitle="">
              {product.sendPolicy ?? "Informação não disponível."}
            </AccordionItem>

            {product.sizeAndFit && (
              <AccordionItem title="Tamanho e ajustes">
                {product.sizeAndFit}
              </AccordionItem>
            )}

            <AccordionItem title="Política de devolução">
              {product.returnPolicy ??
                "Para mais informações sobre devoluções, contacte o nosso apoio ao cliente."}
            </AccordionItem>

            <AccordionItem
              title="Métodos de pagamento"
              subtitle="Pagamento seguro fora da aplicação"
            >
              <p>Pagamento seguro fora da aplicação.</p>
            </AccordionItem>
          </div>
        </div>
      </div>

      {/* ── Também pode gostar ──────────────────────────────────────────── */}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <section className="mt-20">
          <h2 className="text-h4 font-bold text-brand mb-6">
            Também pode gostar
          </h2>
          <div className="border-[0.5px] border-accent mb-5" />
          <div className="flex gap-[5px] overflow-x-auto pb-3 no-scrollbar">
            {product.relatedProducts.map((rp) => (
              <div
                key={rp.id}
                className="shrink-0 w-[220px] sm:w-[260px] md:w-[300px]"
              >
                <ProductCard product={rp} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
