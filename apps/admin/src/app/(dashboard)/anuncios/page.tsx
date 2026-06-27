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
import {
  useTopBars,
  useCreateTopBar,
  useUpdateTopBar,
  useDeleteTopBar,
  type TopBar,
  type TopBarPayload,
} from "@/lib/hooks/useTopBars";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import CopyId from "@/components/ui/CopyId";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManagePopupModals } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";
import PopupModalFormModal from "@/components/modals/PopupModalFormModal";
import TopBarFormModal from "@/components/modals/TopBarFormModal";

const PAGE_SIZE = 20;

type Tab = "modais" | "barra";

type ModalFormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: PopupModal };

type BarFormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: TopBar };

/* ── Modais tab ─────────────────────────────────────────────────────────────── */

function ModaisTab({ allowed }: { allowed: boolean }) {
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState<ModalFormState>({ mode: "closed" });

  const { data, isLoading } = usePopupModals(
    { page, limit: PAGE_SIZE, search: search || undefined, sortOrder },
    { enabled: allowed },
  );
  const createModal = useCreatePopupModal();
  const updateModal = useUpdatePopupModal();
  const deleteModal = useDeletePopupModal();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  async function handleSubmit(payload: PopupModalPayload) {
    if (formState.mode === "create") {
      await createModal.mutateAsync(payload);
    } else if (formState.mode === "edit") {
      await updateModal.mutateAsync({ id: formState.item.id, data: payload });
    }
    setFormState({ mode: "closed" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este modal?")) return;
    await deleteModal.mutateAsync(id);
    setFormState({ mode: "closed" });
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
      header: "Criado em",
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
          onClick={() => setFormState({ mode: "edit", item })}
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
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <span className="text-sm font-semibold font-figtree text-text-body">
            {total} {total === 1 ? "modal" : "modais"}
          </span>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procurar pelo nome"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => setFormState({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar modal"
            >
              <CirclePlus size={18} />
            </button>
            <button
              onClick={() => {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                setPage(1);
              }}
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
        open={formState.mode !== "closed"}
        onClose={() => setFormState({ mode: "closed" })}
        onSubmit={handleSubmit}
        onDelete={
          formState.mode === "edit"
            ? () => handleDelete(formState.item.id)
            : undefined
        }
        initial={formState.mode === "edit" ? formState.item : undefined}
        loading={isSaving}
      />
    </>
  );
}

/* ── Barra tab ──────────────────────────────────────────────────────────────── */

function BarraTab({ allowed }: { allowed: boolean }) {
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState<BarFormState>({ mode: "closed" });

  const { data, isLoading } = useTopBars(
    { page, limit: PAGE_SIZE, search: search || undefined, sortOrder },
    { enabled: allowed },
  );
  const createBar = useCreateTopBar();
  const updateBar = useUpdateTopBar();
  const deleteBar = useDeleteTopBar();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  async function handleSubmit(payload: TopBarPayload) {
    if (formState.mode === "create") {
      await createBar.mutateAsync(payload);
    } else if (formState.mode === "edit") {
      await updateBar.mutateAsync({ id: formState.item.id, data: payload });
    }
    setFormState({ mode: "closed" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta barra?")) return;
    await deleteBar.mutateAsync(id);
    setFormState({ mode: "closed" });
  }

  const columns: TableColumn<TopBar>[] = [
    {
      key: "nr",
      header: "Nr. barra",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "texto",
      header: "Texto",
      render: (item) => (
        <span className="text-text-dark text-sm font-medium font-figtree line-clamp-1">
          {item.text}
        </span>
      ),
    },
    {
      key: "timer",
      header: "Temporizador",
      headerClassName: "w-[130px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {item.timerMode === "duration" && item.timerSeconds
            ? `${item.timerSeconds}s`
            : item.timerMode === "deadline" && item.timerDeadline
              ? new Date(item.timerDeadline).toLocaleString("pt-MZ", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
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
          {item.isActive ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Criado em",
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
          onClick={() => setFormState({ mode: "edit", item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </button>
      ),
    },
  ];

  const isSaving = createBar.isPending || updateBar.isPending;

  return (
    <>
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <span className="text-sm font-semibold font-figtree text-text-body">
            {total} {total === 1 ? "barra" : "barras"}
          </span>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procurar pelo texto"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => setFormState({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar barra"
            >
              <CirclePlus size={18} />
            </button>
            <button
              onClick={() => {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                setPage(1);
              }}
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
            emptyMessage="Nenhuma barra de anúncio encontrada."
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

      <TopBarFormModal
        open={formState.mode !== "closed"}
        onClose={() => setFormState({ mode: "closed" })}
        onSubmit={handleSubmit}
        onDelete={
          formState.mode === "edit"
            ? () => handleDelete(formState.item.id)
            : undefined
        }
        initial={formState.mode === "edit" ? formState.item : undefined}
        loading={isSaving}
      />
    </>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function AnunciosPage() {
  const { user } = useAuth();
  const allowed = canManagePopupModals(user);
  const [activeTab, setActiveTab] = useState<Tab>("modais");

  if (!allowed) {
    return <AccessDeniedState message="A sua role não pode gerir anúncios." />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "modais", label: "Modais" },
    { id: "barra", label: "Barra superior" },
  ];

  return (
    <>
      <PageHeader title="Anúncios" />

      {/* Tab nav */}
      <div className="flex gap-1 mb-5 border-b border-border-light">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold font-figtree border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-navy text-navy"
                : "border-transparent text-text-muted hover:text-text-body"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "modais" && <ModaisTab allowed={allowed} />}
      {activeTab === "barra" && <BarraTab allowed={allowed} />}
    </>
  );
}
