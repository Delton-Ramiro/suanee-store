"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SlideProduct } from "@/lib/hooks/useStory";

/**
 * Scrollable product list for the "Ver produtos" panel.
 * Does NOT include the header trigger — that's managed by StoryViewer.
 */
export function ProductsPanel({
  products,
  onClose,
}: {
  products: SlideProduct[];
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col bg-white">
      {products.map(({ product }) => (
        <Link
          key={product.id}
          href={`/produtos/${product.slug}`}
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors border-b border-border-light last:border-b-0"
        >
          <span className="w-14 h-14 rounded-lg overflow-hidden bg-muted-bg shrink-0">
            {product.media[0] && (
              <img
                src={product.media[0].url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-brand truncate">
              {product.name}
            </p>
            {product.brand && (
              <p className="text-[12px] text-text-muted truncate mt-0.5">
                {product.brand.name}
              </p>
            )}
            {product.basePrice != null && (
              <p className="text-[13px] font-bold text-accent mt-0.5">
                {(
                  product.hasDiscount && product.discountPrice != null
                    ? product.discountPrice
                    : product.basePrice
                ).toLocaleString("pt-MZ")}{" "}
                MZN
              </p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
        </Link>
      ))}
    </div>
  );
}
