"use client";

import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  useFilters,
  useCreateFilter,
  useUpdateFilter,
  type Filter,
  type FilterPayload,
  type FilterUpdatePayload,
} from "@/lib/hooks/useFilters";
import { useCategories } from "@/lib/hooks/useCategories";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import TabPill from "@/components/ui/TabPill";
import CopyId from "@/components/ui/CopyId";
import FilterFormModal from "@/components/filters/FilterFormModal";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageFilters } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Category display helper ──────────────────────────────────────────────── */

type CatLookup = Map<
  string,
  { name: string; level: number; parentId: string | null }
>;

const MAX_VISIBLE_CATS = 6;

function CategoryCell({
  categoryIds,
  lookup,
}: {
  categoryIds: string[];
  lookup: CatLookup;
}) {
  if (categoryIds.length === 0)
    return <span className="text-text-label text-s font-figtree">—</span>;

  const visible = categoryIds.slice(0, MAX_VISIBLE_CATS);
  const overflow = categoryIds.length - MAX_VISIBLE_CATS;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((id) => {
        const cat = lookup.get(id);
        if (!cat) return null;
        const parent = cat.parentId ? lookup.get(cat.parentId) : null;
        const label = parent ? `${cat.name} (${parent.name})` : cat.name;
        const bg =
          cat.level === 0
            ? "bg-navy/10 text-navy"
            : cat.level === 1
              ? "bg-accent/10 text-accent"
              : "bg-primary/10 text-primary";
        return (
          <span
            key={id}
            className={`text-xxs font-medium font-figtree px-2 py-0.5 rounded-full ${bg}`}
          >
            {label}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-xxs font-medium text-text-muted font-figtree px-1">
          +{overflow} mais
        </span>
      )}
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────────── */

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[12px] font-semibold font-figtree px-2.5 py-1 rounded-full ${
        active
          ? "bg-success/10 text-success"
          : "bg-text-label/10 text-text-label"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; filter: Filter };

const PAGE_SIZE = 10;

export default function FiltersPage() {
  const { user } = useAuth();
  const allowFilterManagement = canManageFilters(user);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [, startTransition] = useTransition();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFilters({
    search: search || undefined,
    sortOrder,
    page,
    limit: PAGE_SIZE,
  });
  const createFilter = useCreateFilter();
  const updateFilter = useUpdateFilter();

  // Load all category levels separately to build a complete lookup
  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { data: l2Cats } = useCategories({ level: 2 });

  const catLookup: CatLookup = new Map(
    [...(l0Cats ?? []), ...(l1Cats ?? []), ...(l2Cats ?? [])].map((c) => [
      c.id,
      { name: c.name, level: c.level, parentId: c.parentId },
    ]),
  );

  const filters = data?.items ?? [];
  const totalItems = data?.total ?? 0;
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

  async function handleSubmit(payload: FilterPayload | FilterUpdatePayload) {
    try {
      if (modal.mode === "create") {
        await createFilter.mutateAsync(payload as FilterPayload);
      } else if (modal.mode === "edit") {
        await updateFilter.mutateAsync({
          id: modal.filter.id,
          data: payload as FilterUpdatePayload,
        });
      }
      setModal({ mode: "closed" });
    } catch {
      // toast shown in hook
    }
  }

  /* ── Columns ────────────────────────────────────────────────────────────── */

  const columns: TableColumn<Filter>[] = [
    {
      key: "nr",
      header: "Nr.",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "filtro",
      header: "Filtro",
      render: (item) => (
        <span className="text-text-dark font-medium font-figtree text-sm">
          {item.name}
        </span>
      ),
    },
    {
      key: "categorias",
      header: "Categorias",
      render: (item) => (
        <CategoryCell
          categoryIds={item.categories.map((c) => c.categoryId)}
          lookup={catLookup}
        />
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
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      headerClassName: "w-[100px]",
      render: (item) => <StatusBadge active={item.isActive} />,
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <button
          onClick={() => setModal({ mode: "edit", filter: item })}
          className="text-accent text-s font-medium hover:underline font-figtree"
        >
          Editar
        </button>
      ),
    },
  ];

  const isMutating = createFilter.isPending || updateFilter.isPending;

  if (!allowFilterManagement) {
    return <AccessDeniedState message="A sua role não pode gerir filtros." />;
  }

  return (
    <>
      <PageHeader
        title="Filtros"
        actionLabel="Criar filtro"
        onAction={() => setModal({ mode: "create" })}
      />

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <div className="w-max">
            <TabPill
              tabs={[
                { id: "all", label: "Todos os filtros", count: totalItems },
              ]}
              activeTab="all"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome ou slug"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => setModal({ mode: "create" })}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar filtro"
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
            rows={filters}
            keyExtractor={(f) => f.id}
            loading={isLoading}
            emptyMessage="Nenhum filtro encontrado."
          />
        </div>

        {/* Range */}
        {!isLoading && totalItems > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, totalItems)} de {totalItems}
            </span>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />

      <FilterFormModal
        open={modal.mode !== "closed"}
        onClose={() => setModal({ mode: "closed" })}
        onSubmit={handleSubmit}
        initial={modal.mode === "edit" ? modal.filter : undefined}
        loading={isMutating}
      />
    </>
  );
}
