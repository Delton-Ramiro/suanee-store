"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { CategoryL0, CategoryL1, CategoryL2 } from "@/lib/hooks/useCategoryTree";
import type {
  CategoryFilters,
  BrandOption,
  SizeOption,
  ColorOption,
  AttributeFilter,
  FilterOption,
} from "@/lib/hooks/useCategoryFilters";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SearchActiveFilters = {
  brandIds: string[];
  colorIds: string[];
  sizeIds: string[];
  minPrice?: number;
  maxPrice?: number;
  attrFilters: Record<string, string[]>;
};

export type CategorySelection = {
  l0Slug: string | null;
  l0Id: string | null;
  l1Slug: string | null;
  l1Id: string | null;
  l2Slug: string | null;
  l2Id: string | null;
};

export const EMPTY_CAT_SELECTION: CategorySelection = {
  l0Slug: null, l0Id: null,
  l1Slug: null, l1Id: null,
  l2Slug: null, l2Id: null,
};

type Props = {
  categoryTree: CategoryL0[];
  categorySelection: CategorySelection;
  onCategoryChange: (next: CategorySelection) => void;
  /** Available filter options — null means loading or no category selected */
  available: CategoryFilters | null;
  /** Global brands used when no category is selected */
  globalBrands: BrandOption[];
  /** Global colors always shown */
  globalColors: ColorOption[];
  active: SearchActiveFilters;
  onChange: (next: SearchActiveFilters) => void;
  onResetAll: () => void;
  isOpen: boolean;
  onClose: () => void;
};

/* ── Shared atoms ───────────────────────────────────────────────────────────── */

function FilterSearch({
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
  label,
  checked,
  onChange,
  dimmed,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  dimmed?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 py-1 group transition-opacity ${
        dimmed ? "opacity-30 pointer-events-none select-none" : "cursor-pointer"
      }`}
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
        type="checkbox"
        checked={checked}
        onChange={(e) => !dimmed && onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm text-brand">{label}</span>
    </label>
  );
}

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function match(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase().trim());
}

/* ── Category selector ──────────────────────────────────────────────────────── */

function CategorySelector({
  tree,
  selection,
  onChange,
}: {
  tree: CategoryL0[];
  selection: CategorySelection;
  onChange: (next: CategorySelection) => void;
}) {
  /* Resolve visible subcategory / microcategory lists */
  const selectedL0 = tree.find((c) => c.slug === selection.l0Slug) ?? null;
  const l1List: CategoryL1[] = selectedL0?.children ?? [];
  const selectedL1 = l1List.find((c) => c.slug === selection.l1Slug) ?? null;
  const l2List: CategoryL2[] = selectedL1?.children ?? [];

  function selectL0(cat: CategoryL0) {
    if (selection.l0Slug === cat.slug) {
      // deselect
      onChange(EMPTY_CAT_SELECTION);
    } else {
      onChange({ l0Slug: cat.slug, l0Id: cat.id, l1Slug: null, l1Id: null, l2Slug: null, l2Id: null });
    }
  }

  function selectL1(cat: CategoryL1) {
    if (selection.l1Slug === cat.slug) {
      onChange({ ...selection, l1Slug: null, l1Id: null, l2Slug: null, l2Id: null });
    } else {
      onChange({ ...selection, l1Slug: cat.slug, l1Id: cat.id, l2Slug: null, l2Id: null });
    }
  }

  function selectL2(cat: CategoryL2) {
    if (selection.l2Slug === cat.slug) {
      onChange({ ...selection, l2Slug: null, l2Id: null });
    } else {
      onChange({ ...selection, l2Slug: cat.slug, l2Id: cat.id });
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Level 0 — Categoria */}
      <FilterGroup title="Categoria">
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar">
          {tree.map((cat) => {
            const isSelected = selection.l0Slug === cat.slug;
            return (
              <label
                key={cat.id}
                className="flex items-center gap-2.5 py-1 cursor-pointer group"
                onClick={() => selectL0(cat)}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-none transition-colors ${
                    isSelected
                      ? "bg-brand border-brand"
                      : "border-border group-hover:border-accent"
                  }`}
                />
                <span className="text-sm text-brand">{cat.name}</span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      {/* Level 1 — Subcategoria (only when L0 selected) */}
      {selectedL0 && l1List.length > 0 && (
        <FilterGroup title="Subcategoria">
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar">
            {l1List.map((cat) => {
              const isSelected = selection.l1Slug === cat.slug;
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2.5 py-1 cursor-pointer group"
                  onClick={() => selectL1(cat)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-none transition-colors ${
                      isSelected
                        ? "bg-brand border-brand"
                        : "border-border group-hover:border-accent"
                    }`}
                  />
                  <span className="text-sm text-brand">{cat.name}</span>
                </label>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {/* Level 2 — Microcategoria (only when L1 selected) */}
      {selectedL1 && l2List.length > 0 && (
        <FilterGroup title="Microcategoria">
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar">
            {l2List.map((cat) => {
              const isSelected = selection.l2Slug === cat.slug;
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2.5 py-1 cursor-pointer group"
                  onClick={() => selectL2(cat)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-none transition-colors ${
                      isSelected
                        ? "bg-brand border-brand"
                        : "border-border group-hover:border-accent"
                    }`}
                  />
                  <span className="text-sm text-brand">{cat.name}</span>
                </label>
              );
            })}
          </div>
        </FilterGroup>
      )}
    </div>
  );
}

/* ── SearchFilterSidebar ────────────────────────────────────────────────────── */

export function SearchFilterSidebar({
  categoryTree,
  categorySelection,
  onCategoryChange,
  available,
  globalBrands,
  globalColors,
  active,
  onChange,
  onResetAll,
  isOpen,
  onClose,
}: Props) {
  const [brandQuery, setBrandQuery] = useState("");
  const [sizeQuery, setSizeQuery] = useState("");
  const [colorQuery, setColorQuery] = useState("");
  const [attrQueries, setAttrQueries] = useState<Record<string, string>>({});
  const [minInput, setMinInput] = useState(active.minPrice?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(active.maxPrice?.toString() ?? "");

  useEffect(() => {
    setMinInput(active.minPrice?.toString() ?? "");
    setMaxInput(active.maxPrice?.toString() ?? "");
  }, [active.minPrice, active.maxPrice]);

  const brands: BrandOption[] = available?.brands ?? globalBrands;
  const sizes: SizeOption[] = available?.sizes ?? [];
  // Colors are always shown: use category-specific colors when available, otherwise all colors
  const colors: ColorOption[] = available?.colors ?? globalColors;
  const attrDefs: AttributeFilter[] = available?.filters ?? [];

  const filteredBrands = brandQuery
    ? brands.filter((b) => match(b.name, brandQuery))
    : brands;

  const filteredSizes = sizeQuery
    ? sizes.filter((s) => match(s.name, sizeQuery) || match(s.label ?? "", sizeQuery))
    : sizes;

  const filteredColors = colorQuery
    ? colors.filter((c) => match(c.name, colorQuery))
    : colors;

  function applyPriceRange() {
    const min = minInput ? Number(minInput) : undefined;
    const max = maxInput ? Number(maxInput) : undefined;
    onChange({ ...active, minPrice: min, maxPrice: max });
  }

  function resetAll() {
    onResetAll();
    setBrandQuery("");
    setSizeQuery("");
    setColorQuery("");
    setAttrQueries({});
    setMinInput("");
    setMaxInput("");
  }

  const hasActive =
    categorySelection.l0Slug !== null ||
    active.brandIds.length > 0 ||
    active.colorIds.length > 0 ||
    active.sizeIds.length > 0 ||
    active.minPrice !== undefined ||
    active.maxPrice !== undefined ||
    Object.values(active.attrFilters).some((v) => v.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border-light">
        <span className="text-sm font-bold text-brand">Filtros</span>
        <div className="ml-auto flex items-center gap-2">
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

      <div className="flex-1 overflow-y-auto no-scrollbar -mr-1 pr-1">
        {/* Categories — 3 levels */}
        {categoryTree.length > 0 && (
          <CategorySelector
            tree={categoryTree}
            selection={categorySelection}
            onChange={onCategoryChange}
          />
        )}

        {/* Marca — always shown */}
        {brands.length > 0 && (
          <FilterGroup title="Marca">
            <FilterSearch
              value={brandQuery}
              onChange={setBrandQuery}
              placeholder="Pesquisar marca…"
            />
            <div className="max-h-44 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
              {filteredBrands.length > 0 ? (
                filteredBrands.map((b) => (
                  <CheckRow
                    key={b.id}
                    label={b.name}
                    checked={active.brandIds.includes(b.id)}
                    onChange={() =>
                      onChange({ ...active, brandIds: toggleArr(active.brandIds, b.id) })
                    }
                  />
                ))
              ) : (
                <p className="text-xs text-text-muted py-1">Sem resultados</p>
              )}
            </div>
          </FilterGroup>
        )}

        {/* Preço — always shown */}
        <FilterGroup title="Preço" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">Mín.</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={applyPriceRange}
                onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
                placeholder="0"
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
              />
            </div>
            <span className="text-text-muted mt-4">–</span>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">Máx.</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={applyPriceRange}
                onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
                placeholder="∞"
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </FilterGroup>

        {/* Tamanho — only after any category is selected */}
        {categorySelection.l0Slug && sizes.length > 0 && (
          <FilterGroup title="Tamanho" defaultOpen={false}>
            <FilterSearch
              value={sizeQuery}
              onChange={setSizeQuery}
              placeholder="Pesquisar tamanho…"
            />
            {filteredSizes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredSizes.map((s) => {
                  const selected = active.sizeIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        onChange({ ...active, sizeIds: toggleArr(active.sizeIds, s.id) })
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

        {/* Cor — always shown */}
        <FilterGroup title="Cor" defaultOpen={false}>
            <FilterSearch
              value={colorQuery}
              onChange={setColorQuery}
              placeholder="Pesquisar cor…"
            />
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar pl-1">
              {filteredColors.length > 0 ? (
                filteredColors.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-none ${
                        active.colorIds.includes(c.id)
                          ? "border-brand ring-2 ring-brand ring-offset-1"
                          : "border-border"
                      }`}
                      style={{ backgroundColor: c.hexCode }}
                    />
                    <input
                      type="checkbox"
                      checked={active.colorIds.includes(c.id)}
                      onChange={() =>
                        onChange({ ...active, colorIds: toggleArr(active.colorIds, c.id) })
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

        {/* Custom attribute filters — only when category is selected */}
        {attrDefs.map((attr: AttributeFilter) => {
          const q = attrQueries[attr.id] ?? "";
          const filteredOpts = q
            ? attr.options.filter((o: FilterOption) => match(o.label, q))
            : attr.options;
          return (
            <FilterGroup key={attr.id} title={attr.name} defaultOpen={false}>
              <FilterSearch
                value={q}
                onChange={(v) => setAttrQueries((prev) => ({ ...prev, [attr.id]: v }))}
                placeholder={`Pesquisar ${attr.name.toLowerCase()}…`}
              />
              <div className="max-h-44 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
                {filteredOpts.length > 0 ? (
                  filteredOpts.map((opt: FilterOption) => (
                    <CheckRow
                      key={opt.id}
                      label={opt.label}
                      checked={(active.attrFilters[attr.id] ?? []).includes(opt.id)}
                      onChange={() => {
                        const current = active.attrFilters[attr.id] ?? [];
                        onChange({
                          ...active,
                          attrFilters: {
                            ...active.attrFilters,
                            [attr.id]: toggleArr(current, opt.id),
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
      {/* Desktop: sticky inline panel */}
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
