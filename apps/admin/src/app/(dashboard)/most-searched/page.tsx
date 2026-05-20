"use client";

import { useState } from "react";
import { CirclePlus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import {
  useMostSearched,
  useCreateMostSearched,
  useDeleteMostSearched,
  useReorderMostSearched,
  type MostSearchedItem,
} from "@/lib/hooks/useMostSearched";
import MostSearchedFormModal from "@/components/most-searched/MostSearchedFormModal";
import TabPill from "@/components/ui/TabPill";
import { useAuth } from "@/lib/auth";
import { canManageMostSearched } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Level badge ─────────────────────────────────────────────────────────── */
function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className={`text-xxs font-medium font-figtree px-2 py-0.5 rounded-full shrink-0 ${
        level === 1 ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
      }`}
    >
      {level === 1 ? "Categoria" : "Subcategoria"}
    </span>
  );
}

/* ── Row ─────────────────────────────────────────────────────────────────── */
function MostSearchedRow({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
  isMoving,
}: {
  item: MostSearchedItem;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  isMoving: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border-light last:border-b-0 bg-card hover:bg-surface-hover/50 transition-colors">
      {/* Position number */}
      <span className="w-6 text-center text-s font-bold font-inter text-text-muted shrink-0">
        {index + 1}
      </span>

      {/* Category info */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-text-dark font-figtree truncate">
            {item.category.name}
          </span>
          {item.category.parent && (
            <span className="text-[12px] text-text-muted font-figtree truncate">
              {item.category.parent.name}
            </span>
          )}
        </div>
        <LevelBadge level={item.category.level} />
      </div>

      {/* Reorder + delete controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0 || isMoving}
          className="flex items-center justify-center w-8 h-8 rounded text-text-muted hover:bg-surface-hover hover:text-text-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Mover para cima"
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1 || isMoving}
          className="flex items-center justify-center w-8 h-8 rounded text-text-muted hover:bg-surface-hover hover:text-text-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Mover para baixo"
        >
          <ChevronDown size={16} />
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={onDelete}
              className="text-danger text-s font-medium hover:underline font-figtree"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-text-muted text-s hover:underline font-figtree"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center w-8 h-8 rounded text-text-muted hover:bg-danger/10 hover:text-danger transition-colors ml-1"
            aria-label="Remover"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function MostSearchedPage() {
  const { user } = useAuth();
  const allowMostSearchedManagement = canManageMostSearched(user);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: items = [], isLoading } = useMostSearched();
  const createItem = useCreateMostSearched();
  const deleteItem = useDeleteMostSearched();
  const reorder = useReorderMostSearched();

  const existingCategoryIds = items.map((i) => i.categoryId);

  async function handleAdd(categoryId: string) {
    await createItem.mutateAsync({
      categoryId,
      position: items.length,
    });
    setModalOpen(false);
  }

  function move(index: number, direction: "up" | "down") {
    const next = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    reorder.mutate(next.map((i) => i.id));
  }

  if (!allowMostSearchedManagement) {
    return (
      <AccessDeniedState message="A sua role não pode gerir mais procurados." />
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          Gestão de mais procurados
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="self-start sm:self-auto flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree pl-3 pr-5 py-3 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity"
        >
          <CirclePlus size={20} />
          Adicionar
        </button>
      </div>

      {/* Card */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border-light">
          <div className="w-max">
            <TabPill
              tabs={[
                {
                  id: "all",
                  label: "Todos os itens",
                  count: items.length,
                },
              ]}
              activeTab="all"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
            aria-label="Adicionar"
          >
            <CirclePlus size={18} />
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted font-figtree">
            A carregar...
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted font-figtree">
            Nenhum item adicionado ainda.
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <MostSearchedRow
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                onMoveUp={() => move(index, "up")}
                onMoveDown={() => move(index, "down")}
                onDelete={() => deleteItem.mutate(item.id)}
                isMoving={reorder.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <MostSearchedFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAdd}
        existingCategoryIds={existingCategoryIds}
        loading={createItem.isPending}
      />
    </>
  );
}
