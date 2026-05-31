"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, X, Search } from "lucide-react";
import type { CatNode, AttrDefWithCats } from "@/lib/hooks/useBrandFilters";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type BrandActiveFilters = {
  cats: string[];
  color: string[];
  size: string[];
  minPrice?: number;
  maxPrice?: number;
  /** Key = URL-safe group name (e.g. "cor"). Value = all (defId, optId) pairs selected for this group. */
  mergedAttrs: Record<string, { defId: string; optId: string }[]>;
};

type ColorOption = { id: string; name: string; hexCode: string };
type SizeOption = { id: string; name: string; label: string };

type MergedOption = {
  displayLabel: string;
  pairs: { defId: string; optId: string }[];
};

type MergedFilter = {
  urlKey: string;
  displayName: string;
  options: MergedOption[];
};

type Props = {
  categories: CatNode[];
  colors: ColorOption[];
  sizes: SizeOption[];
  attrDefs: AttrDefWithCats[];
  active: BrandActiveFilters;
  onChange: (next: BrandActiveFilters) => void;
  isOpen: boolean;
  onClose: () => void;
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */

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
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={`bf-${id}`} className="flex items-center gap-2.5 cursor-pointer py-1 group">
      <div
        className={`w-4 h-4 rounded border flex-none flex items-center justify-center transition-colors ${
          checked ? "bg-brand border-brand" : "border-border group-hover:border-accent"
        }`}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <input id={`bf-${id}`} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-sm text-brand">{label}</span>
    </label>
  );
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function toUrlKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

/**
 * For a set of selected cat slugs, returns the union of:
 *   - each selected cat's own ID
 *   - all ancestor IDs of each selected cat (walked up the tree)
 * This mirrors how the backend scopes attribute definitions (self + ancestors).
 */
function getRelevantCatIds(selectedSlugs: string[], categories: CatNode[]): Set<string> {
  const relevant = new Set<string>();
  function walk(node: CatNode, ancestorIds: string[]) {
    if (selectedSlugs.includes(node.slug)) {
      relevant.add(node.id);
      ancestorIds.forEach((id) => relevant.add(id));
    }
    (node.children ?? []).forEach((child) => walk(child, [...ancestorIds, node.id]));
  }
  categories.forEach((cat) => walk(cat, []));
  return relevant;
}

/**
 * Groups attr defs by normalised name and merges options by normalised label.
 * Each merged option tracks ALL (defId, optId) pairs that share the same label —
 * selecting it will add ALL pairs to the filter (OR semantics in the query).
 */
function buildMergedFilters(defs: AttrDefWithCats[]): MergedFilter[] {
  // Group defs by name (case-insensitive)
  const groups = new Map<string, { displayName: string; defs: AttrDefWithCats[] }>();
  for (const def of defs) {
    const key = def.name.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, { displayName: def.name, defs: [] });
    groups.get(key)!.defs.push(def);
  }

  const result: MergedFilter[] = [];
  for (const [nameKey, { displayName, defs: groupDefs }] of groups) {
    // Merge options across all defs in this group by label
    const optionMap = new Map<string, { displayLabel: string; pairs: { defId: string; optId: string }[] }>();
    for (const def of groupDefs) {
      for (const opt of def.options) {
        const optKey = opt.label.toLowerCase().trim();
        if (!optionMap.has(optKey)) {
          optionMap.set(optKey, { displayLabel: opt.label, pairs: [] });
        }
        optionMap.get(optKey)!.pairs.push({ defId: def.id, optId: opt.id });
      }
    }

    result.push({
      urlKey: toUrlKey(displayName),
      displayName,
      options: Array.from(optionMap.values()).sort((a, b) =>
        a.displayLabel.localeCompare(b.displayLabel),
      ),
    });
  }
  return result;
}

/* ── BrandFilterSidebar ──────────────────────────────────────────────────────── */

export function BrandFilterSidebar({
  categories,
  colors,
  sizes,
  attrDefs,
  active,
  onChange,
  isOpen,
  onClose,
}: Props) {
  const [minInput, setMinInput] = useState(active.minPrice?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(active.maxPrice?.toString() ?? "");
  const [colorQuery, setColorQuery] = useState("");

  useEffect(() => {
    setMinInput(active.minPrice?.toString() ?? "");
    setMaxInput(active.maxPrice?.toString() ?? "");
  }, [active.minPrice, active.maxPrice]);

  // ── Derive subcategory and deep-category lists ──────────────────────────────

  const allLevel1 = useMemo(() => categories.flatMap((c) => c.children ?? []), [categories]);
  const allLevel2 = useMemo(() => allLevel1.flatMap((c) => c.children ?? []), [allLevel1]);

  const selectedLevel0 = useMemo(
    () => categories.filter((c) => active.cats.includes(c.slug)),
    [categories, active.cats],
  );
  const level1ToShow = useMemo(
    () => (selectedLevel0.length > 0 ? selectedLevel0.flatMap((c) => c.children ?? []) : allLevel1),
    [selectedLevel0, allLevel1],
  );

  const selectedLevel1 = useMemo(
    () => allLevel1.filter((c) => active.cats.includes(c.slug)),
    [allLevel1, active.cats],
  );
  const level2ToShow = useMemo(
    () => (selectedLevel1.length > 0 ? selectedLevel1.flatMap((c) => c.children ?? []) : allLevel2),
    [selectedLevel1, allLevel2],
  );

  // ── Dynamic attribute filters ───────────────────────────────────────────────

  const relevantCatIds = useMemo(
    () => getRelevantCatIds(active.cats, categories),
    [active.cats, categories],
  );

  // Only show attr filters when at least one category is selected
  const relevantAttrDefs = useMemo(() => {
    if (relevantCatIds.size === 0) return [];
    return attrDefs.filter((def) => def.categoryIds.some((id) => relevantCatIds.has(id)));
  }, [attrDefs, relevantCatIds]);

  const mergedFilters = useMemo(
    () => buildMergedFilters(relevantAttrDefs),
    [relevantAttrDefs],
  );

  // ── Merged attr helpers ─────────────────────────────────────────────────────

  function isOptionSelected(urlKey: string, pairs: { defId: string; optId: string }[]): boolean {
    const current = active.mergedAttrs[urlKey] ?? [];
    return (
      pairs.length > 0 &&
      pairs.every((p) => current.some((cp) => cp.defId === p.defId && cp.optId === p.optId))
    );
  }

  function toggleMergedOption(urlKey: string, pairs: { defId: string; optId: string }[]) {
    const current = active.mergedAttrs[urlKey] ?? [];
    const selected = isOptionSelected(urlKey, pairs);
    const newPairs = selected
      ? current.filter((cp) => !pairs.some((p) => p.defId === cp.defId && p.optId === cp.optId))
      : [...current, ...pairs.filter((p) => !current.some((cp) => cp.defId === p.defId && cp.optId === p.optId))];

    const newMergedAttrs = { ...active.mergedAttrs };
    if (newPairs.length === 0) delete newMergedAttrs[urlKey];
    else newMergedAttrs[urlKey] = newPairs;

    onChange({ ...active, mergedAttrs: newMergedAttrs });
  }

  // ── Misc ───────────────────────────────────────────────────────────────────

  function applyPrice() {
    const min = minInput ? Number(minInput) : undefined;
    const max = maxInput ? Number(maxInput) : undefined;
    onChange({ ...active, minPrice: min, maxPrice: max });
  }

  function resetAll() {
    onChange({ cats: [], color: [], size: [], mergedAttrs: {} });
    setMinInput("");
    setMaxInput("");
    setColorQuery("");
  }

  const hasActive =
    active.cats.length > 0 ||
    active.color.length > 0 ||
    active.size.length > 0 ||
    active.minPrice !== undefined ||
    active.maxPrice !== undefined ||
    Object.values(active.mergedAttrs).some((p) => p.length > 0);

  const filteredColors = colorQuery.trim()
    ? colors.filter((c) => c.name.toLowerCase().includes(colorQuery.toLowerCase()))
    : colors;

  /* ── Sidebar content ─────────────────────────────────────────────────────── */

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-light">
        <span className="text-sm font-bold text-brand">Filtros</span>
        <div className="flex items-center gap-2">
          {hasActive && (
            <button type="button" onClick={resetAll} className="text-xs text-accent hover:underline">
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

      <div className="flex-1 overflow-y-auto overscroll-contain -mr-1 pr-1">
        {/* Categoria (level 0) */}
        {categories.length > 0 && (
          <FilterGroup title="Categoria">
            <div className="flex flex-col gap-0.5">
              {categories.map((cat) => (
                <CheckRow
                  key={cat.id}
                  id={`cat0-${cat.slug}`}
                  label={cat.name}
                  checked={active.cats.includes(cat.slug)}
                  onChange={() => onChange({ ...active, cats: toggle(active.cats, cat.slug) })}
                />
              ))}
            </div>
          </FilterGroup>
        )}

        {/* Subcategoria (level 1) */}
        {level1ToShow.length > 0 && (
          <FilterGroup title="Subcategoria" defaultOpen={false}>
            <div className="flex flex-col gap-0.5">
              {level1ToShow.map((cat) => (
                <CheckRow
                  key={cat.id}
                  id={`cat1-${cat.slug}`}
                  label={cat.name}
                  checked={active.cats.includes(cat.slug)}
                  onChange={() => onChange({ ...active, cats: toggle(active.cats, cat.slug) })}
                />
              ))}
            </div>
          </FilterGroup>
        )}

        {/* Sub-subcategoria (level 2) */}
        {level2ToShow.length > 0 && (
          <FilterGroup title="Sub-subcategoria" defaultOpen={false}>
            <div className="flex flex-col gap-0.5">
              {level2ToShow.map((cat) => (
                <CheckRow
                  key={cat.id}
                  id={`cat2-${cat.slug}`}
                  label={cat.name}
                  checked={active.cats.includes(cat.slug)}
                  onChange={() => onChange({ ...active, cats: toggle(active.cats, cat.slug) })}
                />
              ))}
            </div>
          </FilterGroup>
        )}

        {/* Dynamic merged attribute filters (only shown when a category is selected) */}
        {mergedFilters.map((filter) => (
          <FilterGroup key={filter.urlKey} title={filter.displayName} defaultOpen={false}>
            <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {filter.options.map((opt) => (
                <CheckRow
                  key={opt.displayLabel}
                  id={`attr-${filter.urlKey}-${opt.displayLabel}`}
                  label={opt.displayLabel}
                  checked={isOptionSelected(filter.urlKey, opt.pairs)}
                  onChange={() => toggleMergedOption(filter.urlKey, opt.pairs)}
                />
              ))}
            </div>
          </FilterGroup>
        ))}

        {/* Tamanho */}
        {sizes.length > 0 && (
          <FilterGroup title="Tamanho" defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const sel = active.size.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChange({ ...active, size: toggle(active.size, s.id) })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      sel ? "bg-brand text-white border-brand" : "border-border text-brand hover:border-accent"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </FilterGroup>
        )}

        {/* Cor — searchable, all system colors */}
        <FilterGroup title="Cor" defaultOpen={false}>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={colorQuery}
              onChange={(e) => setColorQuery(e.target.value)}
              placeholder="Pesquisar cor…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {filteredColors.length > 0 ? (
              filteredColors.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 py-1 cursor-pointer group">
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
                    onChange={() => onChange({ ...active, color: toggle(active.color, c.id) })}
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
              <label className="text-[10px] text-text-muted mb-1 block">Mín.</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
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
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                placeholder="∞"
                className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </FilterGroup>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex flex-col h-full sticky top-[calc(var(--spacing-nav)+16px)] max-h-[calc(100vh-var(--spacing-nav)-32px)] overflow-hidden">
        {sidebarContent}
      </div>
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
