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
import {
  useCollectionFilters,
  useCreateCollectionFilter,
  useUpdateCollectionFilter,
  type CollectionFilter,
  type CollectionFilterPayload,
  type CollectionFilterUpdatePayload,
} from "@/lib/hooks/useCollectionFilters";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCollections } from "@/lib/hooks/useCollections";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import TabPill from "@/components/ui/TabPill";
import CopyId from "@/components/ui/CopyId";
import FilterFormModal from "@/components/filters/FilterFormModal";
import CollectionFilterFormModal from "@/components/filters/CollectionFilterFormModal";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageFilters } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Category display helper ──────────────────────────────────────────────── */

type CatLookup = Map<
  string,
  { name: string; level: number; parentId: string | null }
>;

const MAX_VISIBLE = 6;

function CategoryCell({
  categoryIds,
  lookup,
}: {
  categoryIds: string[];
  lookup: CatLookup;
}) {
  if (categoryIds.length === 0)
    return <span className="text-text-label text-s font-figtree">—</span>;

  const visible = categoryIds.slice(0, MAX_VISIBLE);
  const overflow = categoryIds.length - MAX_VISIBLE;

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

/* ── Collection display helper ────────────────────────────────────────────── */

type CollectionLookup = Map<string, string>;

function CollectionCell({
  collectionIds,
  lookup,
}: {
  collectionIds: string[];
  lookup: CollectionLookup;
}) {
  if (collectionIds.length === 0)
    return <span className="text-text-label text-s font-figtree">—</span>;

  const visible = collectionIds.slice(0, MAX_VISIBLE);
  const overflow = collectionIds.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((id) => {
        const name = lookup.get(id);
        if (!name) return null;
        return (
          <span
            key={id}
            className="text-xxs font-medium font-figtree px-2 py-0.5 rounded-full bg-navy/10 text-navy"
          >
            {name}
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

type Tab = "categories" | "collections";

type CatModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; filter: Filter };

type ColModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; filter: CollectionFilter };

const PAGE_SIZE = 10;

export default function FiltersPage() {
  const { user } = useAuth();
  const allowFilterManagement = canManageFilters(user);
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [, startTransition] = useTransition();

  /* ── Category filters state ─────────────────────────────────────────────── */
  const [catSearch, setCatSearch] = useState("");
  const [catSortOrder, setCatSortOrder] = useState<"asc" | "desc">("desc");
  const [catPage, setCatPage] = useState(1);
  const [catModal, setCatModal] = useState<CatModalState>({ mode: "closed" });

  /* ── Collection filters state ───────────────────────────────────────────── */
  const [colSearch, setColSearch] = useState("");
  const [colSortOrder, setColSortOrder] = useState<"asc" | "desc">("desc");
  const [colPage, setColPage] = useState(1);
  const [colModal, setColModal] = useState<ColModalState>({ mode: "closed" });

  /* ── Data fetching ──────────────────────────────────────────────────────── */
  const { data: catData, isLoading: catLoading } = useFilters({
    search: catSearch || undefined,
    sortOrder: catSortOrder,
    page: catPage,
    limit: PAGE_SIZE,
  });
  const { data: colData, isLoading: colLoading } = useCollectionFilters({
    search: colSearch || undefined,
    sortOrder: colSortOrder,
    page: colPage,
    limit: PAGE_SIZE,
  });

  /* ── Mutations ──────────────────────────────────────────────────────────── */
  const createFilter = useCreateFilter();
  const updateFilter = useUpdateFilter();
  const createColFilter = useCreateCollectionFilter();
  const updateColFilter = useUpdateCollectionFilter();

  /* ── Category lookup ────────────────────────────────────────────────────── */
  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { data: l2Cats } = useCategories({ level: 2 });
  const catLookup: CatLookup = new Map(
    [...(l0Cats ?? []), ...(l1Cats ?? []), ...(l2Cats ?? [])].map((c) => [
      c.id,
      { name: c.name, level: c.level, parentId: c.parentId },
    ]),
  );

  /* ── Collection lookup ──────────────────────────────────────────────────── */
  const { data: collectionsData } = useCollections({ limit: 100 });
  const colLookup: CollectionLookup = new Map(
    (collectionsData?.items ?? []).map((c) => [c.id, c.name]),
  );

  /* ── Derived data ───────────────────────────────────────────────────────── */
  const catFilters = catData?.items ?? [];
  const catTotal = catData?.total ?? 0;
  const catTotalPages = catData?.totalPages ?? 1;

  const colFilters = colData?.items ?? [];
  const colTotal = colData?.total ?? 0;
  const colTotalPages = colData?.totalPages ?? 1;

  /* ── Handlers ───────────────────────────────────────────────────────────── */
  const handleCatSearch = useCallback((value: string) => {
    startTransition(() => {
      setCatSearch(value);
      setCatPage(1);
    });
  }, []);

  const handleColSearch = useCallback((value: string) => {
    startTransition(() => {
      setColSearch(value);
      setColPage(1);
    });
  }, []);

  async function handleCatSubmit(payload: FilterPayload | FilterUpdatePayload) {
    try {
      if (catModal.mode === "create") {
        await createFilter.mutateAsync(payload as FilterPayload);
      } else if (catModal.mode === "edit") {
        await updateFilter.mutateAsync({
          id: catModal.filter.id,
          data: payload as FilterUpdatePayload,
        });
      }
      setCatModal({ mode: "closed" });
    } catch {
      // toast shown in hook
    }
  }

  async function handleColSubmit(
    payload: CollectionFilterPayload | CollectionFilterUpdatePayload,
  ) {
    try {
      if (colModal.mode === "create") {
        await createColFilter.mutateAsync(payload as CollectionFilterPayload);
      } else if (colModal.mode === "edit") {
        await updateColFilter.mutateAsync({
          id: colModal.filter.id,
          data: payload as CollectionFilterUpdatePayload,
        });
      }
      setColModal({ mode: "closed" });
    } catch {
      // toast shown in hook
    }
  }

  /* ── Columns: category filters ──────────────────────────────────────────── */
  const catColumns: TableColumn<Filter>[] = [
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
          onClick={() => setCatModal({ mode: "edit", filter: item })}
          className="text-accent text-s font-medium hover:underline font-figtree"
        >
          Editar
        </button>
      ),
    },
  ];

  /* ── Columns: collection filters ────────────────────────────────────────── */
  const colColumns: TableColumn<CollectionFilter>[] = [
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
      key: "colecoes",
      header: "Coleções",
      render: (item) => (
        <CollectionCell
          collectionIds={item.collections.map((c) => c.collectionId)}
          lookup={colLookup}
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
          onClick={() => setColModal({ mode: "edit", filter: item })}
          className="text-accent text-s font-medium hover:underline font-figtree"
        >
          Editar
        </button>
      ),
    },
  ];

  const isCatMutating = createFilter.isPending || updateFilter.isPending;
  const isColMutating =
    createColFilter.isPending || updateColFilter.isPending;

  if (!allowFilterManagement) {
    return <AccessDeniedState message="A sua role não pode gerir filtros." />;
  }

  /* ── Active section helpers ─────────────────────────────────────────────── */
  const isCat = activeTab === "categories";
  const search = isCat ? catSearch : colSearch;
  const handleSearch = isCat ? handleCatSearch : handleColSearch;
  const sortOrder = isCat ? catSortOrder : colSortOrder;
  const toggleSort = isCat
    ? () => { setCatSortOrder((p) => (p === "asc" ? "desc" : "asc")); setCatPage(1); }
    : () => { setColSortOrder((p) => (p === "asc" ? "desc" : "asc")); setColPage(1); };
  const openCreate = isCat
    ? () => setCatModal({ mode: "create" })
    : () => setColModal({ mode: "create" });

  return (
    <>
      <PageHeader
        title="Filtros"
        actionLabel={isCat ? "Criar filtro" : "Criar filtro de coleção"}
        onAction={openCreate}
      />

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <div className="w-max">
            <TabPill
              tabs={[
                {
                  id: "categories",
                  label: "Filtros de categoria",
                  count: catTotal,
                },
                {
                  id: "collections",
                  label: "Filtros de coleção",
                  count: colTotal,
                },
              ]}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as Tab)}
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
              onClick={openCreate}
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
          {isCat ? (
            <DataTable
              columns={catColumns}
              rows={catFilters}
              keyExtractor={(f) => f.id}
              loading={catLoading}
              emptyMessage="Nenhum filtro de categoria encontrado."
            />
          ) : (
            <DataTable
              columns={colColumns}
              rows={colFilters}
              keyExtractor={(f) => f.id}
              loading={colLoading}
              emptyMessage="Nenhum filtro de coleção encontrado."
            />
          )}
        </div>

        {/* Range */}
        {isCat && !catLoading && catTotal > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(catPage - 1) * PAGE_SIZE + 1}–
              {Math.min(catPage * PAGE_SIZE, catTotal)} de {catTotal}
            </span>
          </div>
        )}
        {!isCat && !colLoading && colTotal > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(colPage - 1) * PAGE_SIZE + 1}–
              {Math.min(colPage * PAGE_SIZE, colTotal)} de {colTotal}
            </span>
          </div>
        )}
      </div>

      {isCat ? (
        <Pagination page={catPage} total={catTotalPages} onPageChange={setCatPage} />
      ) : (
        <Pagination page={colPage} total={colTotalPages} onPageChange={setColPage} />
      )}

      <FilterFormModal
        open={catModal.mode !== "closed"}
        onClose={() => setCatModal({ mode: "closed" })}
        onSubmit={handleCatSubmit}
        initial={catModal.mode === "edit" ? catModal.filter : undefined}
        loading={isCatMutating}
      />

      <CollectionFilterFormModal
        open={colModal.mode !== "closed"}
        onClose={() => setColModal({ mode: "closed" })}
        onSubmit={handleColSubmit}
        initial={colModal.mode === "edit" ? colModal.filter : undefined}
        loading={isColMutating}
      />
    </>
  );
}
