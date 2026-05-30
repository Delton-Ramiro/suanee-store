"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type {
  CategoryFilters,
  BrandOption,
  SizeOption,
  ColorOption,
  AttributeFilter,
  FilterOption,
} from "@/lib/hooks/useCategoryFilters";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export type ActiveFilters = {
  brand: string[];
  color: string[];
  size: string[];
  subcats: string[];
  minPrice?: number;
  maxPrice?: number;
  attrFilters: Record<string, string[]>;
};

export type SubCategory = { id: string; name: string; slug: string };

type Props = {
  available: CategoryFilters;
  active: ActiveFilters;
  onChange: (next: ActiveFilters) => void;
  isOpen: boolean;
  onClose: () => void;
  subCategories?: SubCategory[];
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shared sub-components                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mb-2">
      <Search
        size={13}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
      />
    </div>
  );
}

function FilterGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-light last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full py-3 text-sm font-semibold text-brand"
      >
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={`filter-${id}`}
      className="flex items-center gap-2.5 cursor-pointer py-1 group"
    >
      <div
        className={`w-4 h-4 rounded border flex-none flex items-center justify-center transition-colors ${
          checked
            ? "bg-brand border-brand"
            : "border-border group-hover:border-accent"
        }`}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path
              d="M1 3.5L3.5 6L8 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <input
        id={`filter-${id}`}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm text-brand">{label}</span>
    </label>
  );
}

function toggleInArray(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase().trim());
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FilterSidebar                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export function FilterSidebar({
  available,
  active,
  onChange,
  isOpen,
  onClose,
  subCategories,
}: Props) {
  // Local search queries — all filtering done client-side from the full dataset
  const [brandQuery, setBrandQuery] = useState("");
  const [sizeQuery, setSizeQuery] = useState("");
  const [colorQuery, setColorQuery] = useState("");
  const [attrQueries, setAttrQueries] = useState<Record<string, string>>({});

  const [minInput, setMinInput] = useState(active.minPrice?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(active.maxPrice?.toString() ?? "");

  // Sync price inputs with active filters (e.g. on reset)
  useEffect(() => {
    setMinInput(active.minPrice?.toString() ?? "");
    setMaxInput(active.maxPrice?.toString() ?? "");
  }, [active.minPrice, active.maxPrice]);

  function applyPriceRange() {
    const min = minInput ? Number(minInput) : undefined;
    const max = maxInput ? Number(maxInput) : undefined;
    onChange({ ...active, minPrice: min, maxPrice: max });
  }

  function resetAll() {
    onChange({ brand: [], color: [], size: [], subcats: [], attrFilters: {} });
    setBrandQuery("");
    setSizeQuery("");
    setColorQuery("");
    setAttrQueries({});
    setMinInput("");
    setMaxInput("");
  }

  const hasActive =
    active.brand.length > 0 ||
    active.color.length > 0 ||
    active.size.length > 0 ||
    active.subcats.length > 0 ||
    active.minPrice !== undefined ||
    active.maxPrice !== undefined ||
    Object.values(active.attrFilters).some((v) => v.length > 0);

  // Locally filtered lists
  const filteredBrands = brandQuery
    ? available.brands.filter((b: BrandOption) =>
        matchesQuery(b.name, brandQuery),
      )
    : available.brands;

  const filteredSizes = sizeQuery
    ? available.sizes.filter(
        (s: SizeOption) =>
          matchesQuery(s.name, sizeQuery) ||
          matchesQuery(s.label ?? "", sizeQuery),
      )
    : available.sizes;

  const filteredColors = colorQuery
    ? available.colors.filter((c: ColorOption) =>
        matchesQuery(c.name, colorQuery),
      )
    : available.colors;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-light">
        <span className="text-sm font-bold text-brand">Filtros</span>
        <div className="flex items-center gap-2">
          {hasActive && (
            <button
              type="button"
              onClick={resetAll}
              className="text-xs text-accent hover:underline"
            >
              Limpar tudo
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-brand lg:hidden"
            aria-label="Fechar filtros"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable filter groups */}
      <div className="flex-1 overflow-y-auto overscroll-contain -mr-1 pr-1">
        {/* Sub-categories (only shown when coming from a parent category with children) */}
        {subCategories && subCategories.length > 0 && (
          <FilterGroup title="Subcategoria">
            <div className="flex flex-col gap-0.5">
              {subCategories.map((sc) => (
                <CheckRow
                  key={sc.id}
                  id={`subcat-${sc.slug}`}
                  label={sc.name}
                  checked={active.subcats.includes(sc.slug)}
                  onChange={() =>
                    onChange({
                      ...active,
                      subcats: toggleInArray(active.subcats, sc.slug),
                    })
                  }
                />
              ))}
            </div>
          </FilterGroup>
        )}
        {/* Marca */}
        {available.brands.length > 0 && (
          <FilterGroup title="Marca">
            <SearchInput
              value={brandQuery}
              onChange={setBrandQuery}
              placeholder="Pesquisar marca…"
            />
            <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {filteredBrands.length > 0 ? (
                filteredBrands.map((b: BrandOption) => (
                  <CheckRow
                    key={b.id}
                    id={`brand-${b.id}`}
                    label={b.name}
                    checked={active.brand.includes(b.id)}
                    onChange={() =>
                      onChange({
                        ...active,
                        brand: toggleInArray(active.brand, b.id),
                      })
                    }
                  />
                ))
              ) : (
                <p className="text-xs text-text-muted py-1">Sem resultados</p>
              )}
            </div>
          </FilterGroup>
        )}

        {/* Tamanho */}
        {available.sizes.length > 0 && (
          <FilterGroup title="Tamanho" defaultOpen={false}>
            <SearchInput
              value={sizeQuery}
              onChange={setSizeQuery}
              placeholder="Pesquisar tamanho…"
            />
            {filteredSizes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredSizes.map((s: SizeOption) => {
                  const selected = active.size.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...active,
                          size: toggleInArray(active.size, s.id),
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-brand text-white border-brand"
                          : "border-border text-brand hover:border-accent"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Sem resultados</p>
            )}
          </FilterGroup>
        )}

        {/* Cor */}
        <FilterGroup title="Cor" defaultOpen={false}>
          <SearchInput
            value={colorQuery}
            onChange={setColorQuery}
            placeholder="Pesquisar cor…"
          />
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {filteredColors.length > 0 ? (
              filteredColors.map((c: ColorOption) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2.5 py-1 cursor-pointer group"
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-none ${
                      active.color.includes(c.id)
                        ? "border-brand ring-2 ring-brand ring-offset-1"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: c.hexCode }}
                  />
                  <input
                    type="checkbox"
                    checked={active.color.includes(c.id)}
                    onChange={() =>
                      onChange({
                        ...active,
                        color: toggleInArray(active.color, c.id),
                      })
                    }
                    className="sr-only"
                  />
                  <span className="text-sm text-brand">{c.name}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-text-muted py-1">Sem resultados</p>
            )}
          </div>
        </FilterGroup>

        {/* Preço */}
        <FilterGroup title="Preço" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">
                Mín.
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minInput}
                onChange={(e) =>
                  setMinInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                onBlur={applyPriceRange}
                onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
                placeholder="0"
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
              />
            </div>
            <span className="text-text-muted mt-4">–</span>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">
                Máx.
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={maxInput}
                onChange={(e) =>
                  setMaxInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                onBlur={applyPriceRange}
                onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
                placeholder="∞"
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </FilterGroup>

        {/* Dynamic attribute filters */}
        {available.filters.map((attr: AttributeFilter) => {
          const query = attrQueries[attr.id] ?? "";
          const filteredOpts = query
            ? attr.options.filter((o: FilterOption) =>
                matchesQuery(o.label, query),
              )
            : attr.options;

          return (
            <FilterGroup key={attr.id} title={attr.name} defaultOpen={false}>
              <SearchInput
                value={query}
                onChange={(v) =>
                  setAttrQueries((prev) => ({ ...prev, [attr.id]: v }))
                }
                placeholder={`Pesquisar ${attr.name.toLowerCase()}…`}
              />
              <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
                {filteredOpts.length > 0 ? (
                  filteredOpts.map((opt: FilterOption) => (
                    <CheckRow
                      key={opt.id}
                      id={`attr-${attr.id}-${opt.id}`}
                      label={opt.label}
                      checked={(active.attrFilters[attr.id] ?? []).includes(
                        opt.id,
                      )}
                      onChange={() => {
                        const current = active.attrFilters[attr.id] ?? [];
                        onChange({
                          ...active,
                          attrFilters: {
                            ...active.attrFilters,
                            [attr.id]: toggleInArray(current, opt.id),
                          },
                        });
                      }}
                    />
                  ))
                ) : (
                  <p className="text-xs text-text-muted py-1">Sem resultados</p>
                )}
              </div>
            </FilterGroup>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: rendered inline — parent wrapper handles animation/visibility */}
      <div className="hidden lg:flex flex-col h-full sticky top-[calc(var(--spacing-nav)+16px)] max-h-[calc(100vh-var(--spacing-nav)-32px)] overflow-hidden">
        {sidebarContent}
      </div>

      {/* Mobile overlay drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 w-[min(320px,90vw)] bg-card shadow-xl p-5 overflow-hidden flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
