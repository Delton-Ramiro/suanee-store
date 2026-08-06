"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Heart, Ruler, X } from "lucide-react";
import type {
  ProductDetail,
  ProductMedia,
} from "@/app/(shop)/produtos/[slug]/page";
import { ProductCard } from "@/components/products/ProductCard";
import { cartStore, cartItemKey, useCart } from "@/lib/stores/cartStore";
import { favoritesStore, useFavorites } from "@/lib/stores/favoritesStore";
import { recentlyViewedStore, type RecentlyViewedProduct } from "@/lib/stores/recentlyViewedStore";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";

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
  sizes: Array<{
    id: string;
    name: string;
    label?: string | null;
    stockQuantity?: number;
  }>;
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
            sizes.map((size) => {
              const outOfStock = size.stockQuantity === 0;
              return (
                <button
                  key={size.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    if (outOfStock) return;
                    onSelect(size.id === selectedSizeId ? null : size.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-border-light last:border-0 transition-colors ${
                    outOfStock
                      ? "text-text-muted cursor-not-allowed"
                      : selectedSizeId === size.id
                        ? "text-brand font-semibold bg-surface-hover"
                        : "text-brand hover:bg-surface-hover"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{size.label ?? size.name}</span>
                    {outOfStock && (
                      <span className="text-[11px] font-normal shrink-0">
                        Indisponível
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Size guide drawer                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

type SizeGuideData = {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string; position?: number }>;
} | null;

function SizeGuideDrawer({
  sizeGuide,
  onClose,
}: {
  sizeGuide: SizeGuideData;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const inner = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-7 pt-8 pb-5 shrink-0">
        <h2 className="flex-1 text-xl font-bold text-brand leading-tight">
          Guia de tamanho
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-brand hover:opacity-60 transition-opacity"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Blue bar — notes overlaid as white text */}
      <div className="bg-brand shrink-0 min-h-[65px] flex items-center px-7 py-4">
        {sizeGuide?.description && (
          <p className="text-white text-sm font-medium leading-snug">
            {sizeGuide.description}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-7">
        {!sizeGuide ? (
          <div className="flex flex-col items-center justify-center h-full min-h-48 text-center gap-3 py-12">
            <Ruler size={36} className="text-border" />
            <p className="font-medium text-brand">
              Guia de tamanho não disponível
            </p>
            <p className="text-sm text-text-muted">
              Este produto não tem um guia de tamanho associado.
            </p>
          </div>
        ) : sizeGuide.images.length === 0 ? (
          <p className="text-sm text-text-muted mt-4">
            Sem imagens disponíveis para este guia.
          </p>
        ) : (
          <div className="w-full max-w-md mx-auto flex flex-col gap-3 mt-4">
            {[...sizeGuide.images]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={`${sizeGuide.name} ${i + 1}`}
                  className="w-full h-auto rounded object-contain"
                />
              ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Desktop: right panel */}
      <div className="hidden md:flex fixed inset-y-0 right-0 z-50 w-[520px] flex-col bg-white rounded-tl-lg rounded-bl-lg shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] overflow-hidden">
        {inner}
      </div>

      {/* Mobile: centered card */}
      <div
        className="md:hidden fixed inset-0 z-50 flex items-center justify-center px-5"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full bg-white rounded-xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[80vh]">
          {inner}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shown Here With                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

type ShownWithProduct = ProductDetail["shownWith"][number];

function ShownHereWith({ items }: { items: ShownWithProduct[] }) {
  return (
    <div className="py-4">
      {/* Label */}
      <p className="text-[10px] tracking-[0.2em] uppercase text-text-muted font-medium mb-3">
        Modelo está vestindo
      </p>

      {/* Cards row */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        {items.map((item) => {
          const thumb =
            item.media.find((m) => m.isPrimary)?.url ??
            item.media[0]?.url ??
            null;
          const displayPrice =
            item.hasDiscount && item.discountPrice
              ? item.discountPrice
              : item.basePrice;
          return (
            <Link
              key={item.id}
              href={`/produtos/${item.slug}`}
              className="group shrink-0 w-[120px] flex flex-col gap-1.5"
            >
              {/* Image */}
              <div className="relative w-[120px] h-[150px] overflow-hidden bg-muted-bg">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-border" />
                )}
                {item.hasDiscount && item.discountPrice && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white bg-brand leading-none">
                    -
                    {Math.round(
                      (1 - item.discountPrice / item.basePrice) * 100,
                    )}
                    %
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-bold text-brand uppercase tracking-wide leading-none truncate">
                  {item.brand.name}
                </p>
                <p className="text-[11px] text-text-muted leading-snug line-clamp-2">
                  {item.name}
                </p>
                <p
                  className={`text-[11px] font-semibold leading-none ${item.isIndicativePrice ? "text-accent" : "text-brand"}`}
                >
                  {formatPrice(displayPrice)} MZN
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Main component                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────── */
/* Recently Viewed section                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

function RecentlyViewedSection({ items }: { items: RecentlyViewedProduct[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10 py-4">
      <p className="text-[10px] tracking-[0.2em] uppercase text-text-muted font-medium mb-3">
        Vistos recentemente
      </p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        {items.map((item) => {
          const displayPrice =
            item.hasDiscount && item.discountPrice
              ? item.discountPrice
              : item.basePrice;
          return (
            <Link
              key={item.id}
              href={`/produtos/${item.slug}`}
              className="group shrink-0 w-30 flex flex-col gap-1.5"
            >
              <div className="relative w-30 h-37.5 overflow-hidden bg-muted-bg">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-border" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-bold text-brand uppercase tracking-wide leading-none truncate">
                  {item.brandName}
                </p>
                <p className="text-[11px] text-text-muted leading-snug line-clamp-2">
                  {item.name}
                </p>
                <p
                  className={`text-[11px] font-semibold leading-none ${item.isIndicativePrice ? "text-accent" : "text-brand"}`}
                >
                  {displayPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MZN
                </p>
              </div>
            </Link>
          );
        })}
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
  const { user } = useAuth();

  /* ── Recently viewed ────────────────────────────────────────────────── */
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    const thumb =
      product.media.find((m) => m.isPrimary && m.mediaType === "image")?.url ??
      product.media.find((m) => m.mediaType === "image")?.url ??
      null;

    const entry: RecentlyViewedProduct = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      imageUrl: thumb,
      basePrice: Number(product.basePrice),
      hasDiscount: product.hasDiscount,
      discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
      isIndicativePrice: product.isIndicativePrice,
    };

    recentlyViewedStore.add(entry);
    setRecentlyViewed(recentlyViewedStore.getExcluding(product.id));

    if (user) {
      authFetch("/recently-viewed", {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

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

  /* ── Colors with all-zero stock (diagonal line + disabled thumbnail) ─── */
  const outOfStockColors = useMemo(() => {
    const set = new Set<string>();
    for (const color of colors) {
      const colorVariants = product.variants.filter(
        (v) => v.color?.id === color.id,
      );
      if (
        colorVariants.length > 0 &&
        colorVariants.every((v) => v.stockQuantity === 0)
      ) {
        set.add(color.id);
      }
    }
    return set;
  }, [colors, product.variants]);

  /* ── State — default to first in-stock color ─────────────────────────── */
  const [selectedColorId, setSelectedColorId] = useState<string | null>(() => {
    const first = colors.find((c) => !outOfStockColors.has(c.id));
    return first?.id ?? colors[0]?.id ?? null;
  });
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  /* ── Media for selected color ────────────────────────────────────────── */
  const displayMedia = useMemo(() => {
    const sorted = [...product.media].sort((a, b) => a.position - b.position);
    if (selectedColorId) {
      const colorMedia = sorted.filter((m) => m.colorId === selectedColorId);
      if (colorMedia.length > 0) return colorMedia;
    }
    return sorted.filter((m) => m.colorId === null);
  }, [selectedColorId, product.media]);

  /* ── Sizes for selected color (with stock info) ──────────────────────── */
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
        .map((v) => ({ ...v.size!, stockQuantity: v.stockQuantity }));
    }
    // Fallback when no color is resolved — no stock info available
    return product.sizes.map((s) => ({ ...s.size, stockQuantity: undefined }));
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
      variantId: selectedVariant?.id ?? null,
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
    favoritesStore.toggle({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      imageUrl: thumb,
      price: Number(basePrice),
      hasDiscount,
      discountPrice: discountPrice ? Number(discountPrice) : null,
      isIndicativePrice,
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

          <RecentlyViewedSection items={recentlyViewed} />
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
                  const isOos = outOfStockColors.has(color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      disabled={isOos}
                      onClick={() => {
                        if (isOos) return;
                        setSelectedColorId(color.id);
                        setSelectedSizeId(null);
                      }}
                      className={`flex flex-col items-center gap-1.5 shrink-0 ${isOos ? "cursor-not-allowed" : ""}`}
                    >
                      <span
                        className={`relative block w-14 h-14 sm:w-18 sm:h-18 rounded overflow-hidden border-2 transition-all ${
                          isOos ? "opacity-40" : ""
                        } ${
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
                        {isOos && (
                          <span className="absolute inset-0 pointer-events-none">
                            <svg
                              width="100%"
                              height="100%"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <line
                                x1="0"
                                y1="100%"
                                x2="100%"
                                y2="0"
                                stroke="rgba(0,0,0,0.55)"
                                strokeWidth="1.5"
                              />
                            </svg>
                          </span>
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
            onClick={() => setSizeGuideOpen(true)}
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

            {product.shownWith && product.shownWith.length > 0 && (
              <ShownHereWith items={product.shownWith} />
            )}

            {product.safetyInfo && (
              <AccordionItem title="Informação de segurança do produto">
                {product.safetyInfo}
              </AccordionItem>
            )}

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

      {/* ── Size guide drawer ───────────────────────────────────────────── */}
      {sizeGuideOpen && (
        <SizeGuideDrawer
          sizeGuide={product.sizeGuide}
          onClose={() => setSizeGuideOpen(false)}
        />
      )}
    </div>
  );
}
