"use client";

import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  usePickPoints,
  useCreatePickPoint,
  useUpdatePickPoint,
  useDeletePickPoint,
  type PickPoint,
} from "@/lib/hooks/usePickPoints";
import { MOZAMBIQUE_PROVINCES } from "@ecommerce/types";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import TabPill from "@/components/ui/TabPill";
import PickPointFormModal from "@/components/pick-points/PickPointFormModal";
import CopyId from "@/components/ui/CopyId";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManagePickPoints } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; point: PickPoint };

const ALL_PROVINCES = ["Todas", ...MOZAMBIQUE_PROVINCES] as const;

export default function PickPointsPage() {
  const { user } = useAuth();
  const canManage = canManagePickPoints(user);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [, startTransition] = useTransition();
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  const { data, isLoading } = usePickPoints({
    search: search || undefined,
    province: province || undefined,
    sortOrder,
    page,
    limit: PAGE_SIZE,
  });
  const createPoint = useCreatePickPoint();
  const updatePoint = useUpdatePickPoint();
  const deletePoint = useDeletePickPoint();

  const points = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  function handleProvinceFilter(tab: string) {
    startTransition(() => {
      setProvince(tab === "Todas" ? "" : tab);
      setPage(1);
    });
  }

  function toggleSort() {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  async function handleSubmit(
    provinceVal: string,
    name: string,
    address: string,
    isActive: boolean,
  ) {
    try {
      if (modal.mode === "create") {
        await createPoint.mutateAsync({
          province: provinceVal as (typeof MOZAMBIQUE_PROVINCES)[number],
          name,
          address,
          isActive,
        });
      } else if (modal.mode === "edit") {
        await updatePoint.mutateAsync({
          id: modal.point.id,
          data: {
            province: provinceVal as (typeof MOZAMBIQUE_PROVINCES)[number],
            name,
            address,
            isActive,
          },
        });
      }
      setModal({ mode: "closed" });
    } catch {
      // toast shown by hook
    }
  }

  async function handleDelete() {
    if (modal.mode !== "edit") return;
    try {
      await deletePoint.mutateAsync(modal.point.id);
      setModal({ mode: "closed" });
    } catch {
      // toast shown by hook
    }
  }

  const columns: TableColumn<PickPoint>[] = [
    {
      key: "id",
      header: "ID",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "province",
      header: "Província",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-navy/10 text-navy text-xs font-semibold font-figtree">
          {item.province}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nome do ponto",
      render: (item) => (
        <span className="font-medium text-text-dark font-figtree">{item.name}</span>
      ),
    },
    {
      key: "address",
      header: "Morada",
      render: (item) => (
        <span className="text-text-body font-figtree text-sm">{item.address}</span>
      ),
    },
    {
      key: "created",
      header: "Criado em",
      headerClassName: "w-[140px]",
      render: (item) => (
        <span className="text-text-body font-inter text-sm">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) =>
        canManage ? (
          <button
            onClick={() => setModal({ mode: "edit", point: item })}
            className="text-accent text-sm font-medium hover:underline"
          >
            Editar
          </button>
        ) : null,
    },
  ];

  if (!canManage) {
    return (
      <AccessDeniedState message="A sua role não pode gerir pontos de recolha." />
    );
  }

  return (
    <>
      <PageHeader
        title="Pontos de recolha"
        actionLabel="Novo ponto"
        onAction={() => setModal({ mode: "create" })}
      />

      {/* Province filter tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {ALL_PROVINCES.map((p) => (
            <button
              key={p}
              onClick={() => handleProvinceFilter(p)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-semibold font-figtree transition-colors whitespace-nowrap",
                (p === "Todas" ? province === "" : province === p)
                  ? "bg-navy text-white"
                  : "bg-surface-hover text-text-muted hover:bg-navy/10 hover:text-navy",
              ].join(" ")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <TabPill
            tabs={[
              {
                id: "all",
                label: "Todos os pontos",
                count: data?.total,
              },
            ]}
            activeTab="all"
          />
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Pesquisar nome ou morada"
              className="w-full sm:w-72"
            />
            <button
              onClick={() => setModal({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Novo ponto"
            >
              <CirclePlus size={18} />
            </button>
            <button
              onClick={toggleSort}
              title={sortOrder === "asc" ? "Ordem decrescente" : "Ordem crescente"}
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
            rows={points}
            keyExtractor={(p) => p.id}
            loading={isLoading}
            emptyMessage="Nenhum ponto de recolha encontrado."
          />
        </div>

        {!isLoading && (data?.total ?? 0) > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, data!.total)} de {data!.total}
            </span>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />

      <PickPointFormModal
        open={modal.mode !== "closed"}
        onClose={() => setModal({ mode: "closed" })}
        onSubmit={handleSubmit}
        onDelete={modal.mode === "edit" ? handleDelete : undefined}
        initial={modal.mode === "edit" ? modal.point : undefined}
        loading={createPoint.isPending || updatePoint.isPending}
        isDeleting={deletePoint.isPending}
      />
    </>
  );
}
