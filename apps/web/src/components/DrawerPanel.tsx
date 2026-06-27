"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import Link from "next/link";

/* ── Shared panel wrapper ─────────────────────────────────────────────────── */

type DrawerPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
};

export function DrawerPanel({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  maxWidth = "max-w-[540px]",
}: DrawerPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`fixed top-0 right-0 z-[61] h-full w-full ${maxWidth} bg-white flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-8 pb-4 shrink-0 border-b border-border-light">
          <h2 className="text-base font-semibold text-brand">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-brand hover:opacity-60 transition-opacity"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Optional footer */}
        {footer && (
          <div className="shrink-0 border-t border-border-light px-6 py-4 bg-white">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Shared item row ──────────────────────────────────────────────────────── */

type DrawerItemRowProps = {
  imageUrl?: string | null;
  /** Wraps the thumbnail in an anchor if provided */
  imageHref?: string;
  onImageClick?: () => void;
  name: string;
  /** Wraps the name in an anchor if provided */
  nameHref?: string;
  onNameClick?: () => void;
  price: string;
  /** Shown struck-through next to price (discount scenario) */
  originalPrice?: string;
  /** Renders "~ " prefix on price */
  indicativePrice?: boolean;
  /**
   * Short descriptive chips joined by " · "
   * e.g. ["Lacoste", "Azul", "M", "× 2"]
   */
  meta?: (string | null | undefined)[];
  /** Slot rendered below meta (qty stepper, delete, etc.) */
  actions?: ReactNode;
};

export function DrawerItemRow({
  imageUrl,
  imageHref,
  onImageClick,
  name,
  nameHref,
  onNameClick,
  price,
  originalPrice,
  indicativePrice,
  meta,
  actions,
}: DrawerItemRowProps) {
  const filteredMeta = (meta ?? []).filter(Boolean) as string[];

  const thumb = (
    <div className="w-[64px] h-[80px] shrink-0 rounded-sm bg-muted-bg overflow-hidden">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted-bg" />
      )}
    </div>
  );

  const nameEl = nameHref ? (
    <Link
      href={nameHref}
      onClick={onNameClick}
      className="text-sm font-medium text-brand leading-snug hover:text-primary transition-colors line-clamp-2"
    >
      {name}
    </Link>
  ) : (
    <p className="text-sm font-medium text-brand leading-snug line-clamp-2">
      {name}
    </p>
  );

  return (
    <div className="flex gap-3 py-3 border-b border-border-light last:border-0">
      {/* Thumbnail */}
      {imageHref ? (
        <Link
          href={imageHref}
          onClick={onImageClick}
          className="shrink-0 hover:opacity-80 transition-opacity"
        >
          {thumb}
        </Link>
      ) : (
        <div className="shrink-0">{thumb}</div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">{nameEl}</div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-brand">
              {indicativePrice ? "~ " : ""}
              {price}
            </p>
            {originalPrice && (
              <p className="text-xs text-text-muted line-through">
                {originalPrice}
              </p>
            )}
          </div>
        </div>

        {/* Meta chips */}
        {filteredMeta.length > 0 && (
          <p className="text-xs font-bold text-brand/60 leading-relaxed">
            {filteredMeta.join(" · ")}
          </p>
        )}

        {/* Actions slot */}
        {actions && <div className="mt-1">{actions}</div>}
      </div>
    </div>
  );
}
