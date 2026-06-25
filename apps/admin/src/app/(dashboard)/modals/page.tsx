"use client";

import Image from "next/image";
import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  usePopupModals,
  useCreatePopupModal,
  useUpdatePopupModal,
  useDeletePopupModal,
  type PopupModal,
  type PopupModalPayload,
} from "@/lib/hooks/usePopupModals";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import CopyId from "@/components/ui/CopyId";
import TabPill from "@/components/ui/TabPill";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManagePopupModals } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";
import PopupModalFormModal from "@/components/modals/PopupModalFormModal";

const PAGE_SIZE = 20;

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; modal: PopupModal };

export default function ModalsPage() {
  const { user } = useAuth();
  const allowed = canManagePopupModals(user);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" });

  const { data, isLoading } = usePopupModals(
    { page, limit: PAGE_SIZE, search: search || undefined, sortOrder },
    { enabled: allowed },
  );

  const createModal = useCreatePopupModal();
  const updateModal = useUpdatePopupModal();
  const deleteModal = useDeletePopupModal();

  if (!allowed) {
    return <AccessDeniedState message="A sua role não pode gerir modais." />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

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

  async function handleSubmit(payload: PopupModalPayload) {
    if (modalState.mode === "create") {
      await createModal.mutateAsync(payload);
    } else if (modalState.mode === "edit") {
      await updateModal.mutateAsync({ id: modalState.modal.id, data: payload });
    }
    setModalState({ mode: "closed" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Tens a certeza que queres eliminar este modal?")) return;
    await deleteModal.mutateAsync(id);
    if (modalState.mode === "edit") setModalState({ mode: "closed" });
  }

  const columns: TableColumn<PopupModal>[] = [
    {
      key: "nr",
      header: "Nr. modal",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "imagem",
      header: "Imagem",
      headerClassName: "w-[80px]",
      render: (item) => (
        <div className="relative w-12 h-12 rounded-lg shrink-0 overflow-hidden bg-surface-hover border border-border-light">
          <Image
            fill
            src={item.imageUrl}
            alt={item.name}
            className="object-cover"
            sizes="48px"
          />
        </div>
      ),
    },
    {
      key: "nome",
      header: "Nome",
      render: (item) => (
        <span className="text-text-dark text-sm font-medium font-figtree">
          {item.name}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      headerClassName: "w-[100px]",
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-figtree ${
            item.isActive
              ? "bg-green-100 text-green-700"
              : "bg-surface-hover text-text-muted"
          }`}
        >
          {item.isActive ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <button
          onClick={() => setModalState({ mode: "edit", modal: item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </button>
      ),
    },
  ];

  const isSaving = createModal.isPending || updateModal.isPending;

  return (
    <>
      <PageHeader
        title="Gestão de modais"
        actionLabel="Criar modal"
        onAction={() => setModalState({ mode: "create" })}
      />

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <div className="w-max">
            <TabPill
              tabs={[{ id: "all", label: "Todos os modais", count: total }]}
              activeTab="all"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => setModalState({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar modal"
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

        <div className="px-6 pb-2 pt-4">
          <DataTable
            columns={columns}
            rows={items}
            keyExtractor={(item) => item.id}
            loading={isLoading}
            emptyMessage="Nenhum modal encontrado."
          />
        </div>

        {!isLoading && total > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
              de {total}
            </span>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />

      <PopupModalFormModal
        open={modalState.mode !== "closed"}
        onClose={() => setModalState({ mode: "closed" })}
        onSubmit={handleSubmit}
        onDelete={
          modalState.mode === "edit"
            ? () => handleDelete(modalState.modal.id)
            : undefined
        }
        initial={modalState.mode === "edit" ? modalState.modal : undefined}
        loading={isSaving}
      />
    </>
  );
}
