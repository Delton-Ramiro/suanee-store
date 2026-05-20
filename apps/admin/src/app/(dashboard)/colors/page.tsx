"use client";

import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus, SquarePlus } from "lucide-react";
import {
  useColors,
  useCreateColor,
  useUpdateColor,
  type Color,
} from "@/lib/hooks/useColors";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import ColorFormModal from "@/components/colors/ColorFormModal";
import CopyId from "@/components/ui/CopyId";
import TabPill from "@/components/ui/TabPill";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageColors } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Page ─────────────────────────────────────────────────────────────────── */
type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; color: Color };

export default function ColorsPage() {
  const { user } = useAuth();
  const allowColorManagement = canManageColors(user);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [, startTransition] = useTransition();
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const { data, isLoading } = useColors({
    search: search || undefined,
    sortOrder,
    page,
    limit: PAGE_SIZE,
  });
  const createColor = useCreateColor();
  const updateColor = useUpdateColor();

  const colors = data?.items ?? [];
  const allColors = data?.total;
  const totalPages = data?.totalPages ?? 1;

  /* Reset to page 1 whenever search or sort changes */
  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  function toggleSort() {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  async function handleSubmit(name: string, hexCode: string) {
    try {
      if (modal.mode === "create") {
        await createColor.mutateAsync({ name, hexCode });
      } else if (modal.mode === "edit") {
        await updateColor.mutateAsync({
          id: modal.color.id,
          data: { name, hexCode },
        });
      }
      setModal({ mode: "closed" });
    } catch {
      // onError in the mutation already shows the toast — keep modal open
    }
  }

  /* ── Table columns ────────────────────────────────────────────────────── */
  const columns: TableColumn<Color>[] = [
    {
      key: "nr",
      header: "Nr. cor",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "cor",
      header: "Cor",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded shrink-0 border border-border-light"
            style={{ backgroundColor: item.hexCode }}
            aria-hidden="true"
          />
          <span className="text-text-dark">{item.name}</span>
        </div>
      ),
    },
    {
      key: "codigo",
      header: "Código",
      headerClassName: "w-[140px]",
      render: (item) => (
        <span className="font-inter text-text-body uppercase">
          {item.hexCode.replace("#", "")}
        </span>
      ),
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <button
          onClick={() => setModal({ mode: "edit", color: item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </button>
      ),
    },
  ];

  const isMutating = createColor.isPending || updateColor.isPending;

  if (!allowColorManagement) {
    return <AccessDeniedState message="A sua role não pode gerir cores." />;
  }

  return (
    <>
      <PageHeader
        title="Gestão de cores"
        actionLabel="Criar cor"
        onAction={() => setModal({ mode: "create" })}
      />

      {/* Card */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-border-light">
          {/* Tab pill */}
          <div className="w-max">
            <TabPill
              tabs={[{ id: "all", label: "Todas as cores", count: allColors }]}
              activeTab="all"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome ou número"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => setModal({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar cor"
            >
              <CirclePlus size={18} />
            </button>
            <button
              onClick={toggleSort}
              title={
                sortOrder === "asc" ? "Ordem decrescente" : "Ordem crescente"
              }
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
            >
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-2 pt-4">
          <DataTable
            columns={columns}
            rows={colors}
            keyExtractor={(c) => c.id}
            loading={isLoading}
            emptyMessage="Nenhuma cor encontrada."
          />
        </div>

        {/* Range indicator */}
        {!isLoading && (data?.total ?? 0) > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, data!.total)} de {data!.total}
            </span>
          </div>
        )}
      </div>

      {/* Pagination — centered below card, matches Figma */}
      <Pagination page={page} total={totalPages} onPageChange={setPage} />

      {/* Create / Edit modal */}
      <ColorFormModal
        open={modal.mode !== "closed"}
        onClose={() => setModal({ mode: "closed" })}
        onSubmit={handleSubmit}
        initial={modal.mode === "edit" ? modal.color : undefined}
        loading={isMutating}
      />
    </>
  );
}
