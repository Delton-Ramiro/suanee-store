"use client";

import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";

type Sort = "newest" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

type Props = {
  total: number;
  page: number;
  limit: number;
  sort: Sort;
  /** true = sidebar panel open; false = closed but may still have active filters */
  filtersOpen: boolean;
  hasActiveFilters: boolean;
  onSortChange: (sort: Sort) => void;
  onToggleFilters: () => void;
};

export function SortBar({
  total,
  page,
  limit,
  sort,
  filtersOpen,
  hasActiveFilters,
  onSortChange,
  onToggleFilters,
}: Props) {
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Ordenar";

  // Button is blue when open OR when filters are active (closed but applied)
  const filterBtnActive = filtersOpen || hasActiveFilters;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleFilters}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
            filterBtnActive
              ? "border-brand bg-brand text-white"
              : "border-border text-brand hover:bg-surface-hover"
          }`}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {hasActiveFilters && !filtersOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 flex-none" />
          )}
        </button>

        <p className="text-sm text-text-muted hidden sm:block">
          {total === 0
            ? "0 resultados"
            : `${from}–${to} de ${total} resultado${total === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Custom sort dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted hidden sm:block">
          Ordenar por
        </span>

        <div ref={sortRef} className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-card text-brand hover:bg-surface-hover transition-colors"
          >
            {currentLabel}
            <ChevronDown
              size={13}
              className={`flex-none text-text-muted transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
            />
          </button>

          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[160px] overflow-hidden">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onSortChange(o.value);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    o.value === sort
                      ? "text-brand font-medium bg-surface-hover"
                      : "text-brand hover:bg-surface-hover"
                  }`}
                >
                  {o.label}
                  {o.value === sort && (
                    <Check size={13} className="text-accent flex-none" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
