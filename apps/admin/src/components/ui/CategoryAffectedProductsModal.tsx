"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type AffectedProduct = {
  id: string;
  name: string;
  slug: string;
  media: { url: string; mediaType: string }[];
};

export type CategoryAffectedProductsModalProps = {
  categoryLabel: string;
  total: number;
  products: AffectedProduct[];
  onClose: () => void;
};

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function CategoryAffectedProductsModal({
  categoryLabel,
  total,
  products,
  onClose,
}: CategoryAffectedProductsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-card w-full max-w-lg rounded-xl border border-border-light shadow-xl p-6 flex flex-col gap-5 mx-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-warning/15 flex items-center justify-center">
            <AlertTriangle size={18} className="text-warning" />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-primary font-lato">
              Não é possível remover a categoria
            </h2>
            <p className="text-sm text-text-body font-figtree mt-1">
              A categoria{" "}
              <span className="font-semibold text-navy">
                &ldquo;{categoryLabel}&rdquo;
              </span>{" "}
              está associada a{" "}
              <span className="font-semibold text-danger">
                {total} produto{total !== 1 ? "s" : ""}
              </span>{" "}
              desta marca. Desassocie ou mova esses produtos primeiro.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-text-muted hover:text-text-dark transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Product list */}
        {products.length > 0 && (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border-light p-2.5 hover:bg-surface-hover transition-colors group"
              >
                {p.media[0] ? (
                  <img
                    src={p.media[0].url}
                    alt={p.name}
                    className="w-10 h-10 rounded-md object-cover shrink-0 border border-border-light"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-surface-hover shrink-0 border border-border-light" />
                )}
                <span className="text-sm text-text-dark font-figtree group-hover:text-navy transition-colors truncate">
                  {p.name}
                </span>
              </Link>
            ))}
            {total > 10 && (
              <p className="text-xs text-text-muted font-figtree text-center pt-1">
                … e mais {total - 10} produto{total - 10 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Action */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:opacity-90 transition-opacity"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
