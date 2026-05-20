"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useCategories, type Category } from "@/lib/hooks/useCategories";
import type { MostSearchedItem } from "@/lib/hooks/useMostSearched";

interface MostSearchedFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (categoryId: string) => Promise<void>;
  /** IDs already in the list — to prevent duplicates */
  existingCategoryIds: string[];
  loading?: boolean;
}

function levelLabel(level: number) {
  return level === 1 ? "Categoria" : "Subcategoria";
}

export default function MostSearchedFormModal({
  open,
  onClose,
  onSubmit,
  existingCategoryIds,
  loading,
}: MostSearchedFormModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Category | null>(null);

  const { data: allCategories = [], isLoading: catsLoading } = useCategories();

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(null);
    }
  }, [open]);

  // Flatten to only level 1 and level 2 categories, excluding already-added ones
  const candidates = useMemo(() => {
    return allCategories
      .flatMap((cat) => {
        const result: Category[] = [];
        if (cat.level === 1 || cat.level === 2) result.push(cat);
        if (cat.children) {
          cat.children.forEach((child) => {
            if (child.level === 1 || child.level === 2) result.push(child);
            if (child.children) {
              child.children.forEach((grandchild) => {
                if (grandchild.level === 1 || grandchild.level === 2)
                  result.push(grandchild);
              });
            }
          });
        }
        return result;
      })
      .filter((c) => !existingCategoryIds.includes(c.id));
  }, [allCategories, existingCategoryIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await onSubmit(selected.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar mais procurado"
      maxWidth="max-w-[480px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Search input */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar categoria ou subcategoria..."
            autoFocus
            className="w-full bg-bg border border-border-light rounded-lg pl-9 pr-4 py-2.5 text-sm text-text-dark font-figtree placeholder:text-text-muted outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Category list */}
        <div className="border border-border-light rounded-lg overflow-hidden max-h-70 overflow-y-auto">
          {catsLoading ? (
            <div className="px-4 py-8 text-center text-s text-text-muted font-figtree">
              A carregar...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-s text-text-muted font-figtree">
              Nenhuma categoria disponível
            </div>
          ) : (
            filtered.map((cat) => {
              const isSelected = selected?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelected(cat)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-border-light last:border-b-0 transition-colors ${
                    isSelected
                      ? "bg-navy/5 border-l-2 border-l-navy"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-sm font-medium font-figtree truncate ${
                        isSelected ? "text-navy" : "text-text-dark"
                      }`}
                    >
                      {cat.name}
                    </span>
                    {cat.parent && (
                      <span className="text-[12px] text-text-muted font-figtree truncate">
                        {cat.parent.name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xxs font-medium font-figtree px-2 py-0.5 rounded-full ml-3 ${
                      cat.level === 1
                        ? "bg-accent/10 text-accent"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {levelLabel(cat.level)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Selected preview */}
        {selected && (
          <div className="flex items-center gap-2 px-3 py-2 bg-navy/5 rounded-lg border border-navy/20">
            <span className="text-s font-medium text-navy font-figtree truncate flex-1">
              {selected.name}
            </span>
            <span className="text-xxs text-text-muted font-figtree shrink-0">
              {levelLabel(selected.level)}
            </span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={!selected || loading}
            className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar..." : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
