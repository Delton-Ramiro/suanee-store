"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CirclePlus, ArrowUpDown, ChevronRight } from "lucide-react";
import { useCollections, type Collection } from "@/lib/hooks/useCollections";
import {
  useAdminProducts,
  type AdminProduct,
} from "@/lib/hooks/useAdminProducts";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import SearchBar from "@/components/ui/SearchBar";
import TabPill from "@/components/ui/TabPill";
import Pagination from "@/components/ui/Pagination";
import CopyId from "@/components/ui/CopyId";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageCollections } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Types ────────────────────────────────────────────────────────────────── */

type ViewType = "all" | "available" | "importation" | "draft";

const TABS: { id: ViewType; label: string }[] = [
  { id: "all", label: "Todos produtos" },
  { id: "available", label: "Entrega imediata" },
  { id: "importation", label: "Por importação" },
  { id: "draft", label: "Rascunho" },
];

/* ── Collection card ──────────────────────────────────────────────────────── */

function CollectionCard({ col }: { col: Collection }) {
  return (
    <Link
      href={`/collections/${col.id}`}
      className="flex flex-row items-center gap-3 bg-card rounded-xl border border-border-light px-4 py-3 hover:shadow-md hover:border-accent/40 transition-all cursor-pointer"
    >
      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-surface-hover border border-border-light shrink-0">
        {col.coverImageUrl ? (
          <Image
            fill
            src={col.coverImageUrl}
            alt={col.name}
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="w-full h-full bg-bg" />
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-s font-medium text-text-dark font-figtree leading-tight truncate">
          {col.name}
        </span>
        {col._count !== undefined && (
          <span className="text-xxs text-text-subtle font-figtree mt-0.5">
            {col._count.products} produto{col._count.products !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {!col.isActive && (
        <span className="shrink-0 text-xxs font-bold font-figtree text-warning bg-warning/10 px-2 py-0.5 rounded-full">
          Oculta
        </span>
      )}
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 10;
const DESKTOP_COLS_PER_PAGE = 8;

export default function CollectionsPage() {
  const { user } = useAuth();
  const allowCollectionManagement = canManageCollections(user);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [colPage, setColPage] = useState(0);
  const [colsPerPage, setColsPerPage] = useState(DESKTOP_COLS_PER_PAGE);

  const [view, setView] = useState<ViewType>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    function handleResize() {
      setColsPerPage(window.innerWidth < 640 ? 4 : DESKTOP_COLS_PER_PAGE);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setColPage(0);
  }, [colsPerPage]);

  const { data: colData, isLoading: colsLoading } = useCollections({
    limit: 100,
  });
  const collections = colData?.items ?? [];

  const { data: prodData, isLoading: prodsLoading } = useAdminProducts(
    {
      page,
      limit: PAGE_SIZE,
      view,
      search: search || undefined,
      sortOrder,
      hasCollection: true,
    },
    { enabled: allowCollectionManagement },
  );

  if (!allowCollectionManagement) {
    return <AccessDeniedState message="A sua role não pode gerir coleções." />;
  }

  const products = prodData?.items ?? [];
  const totalPages = prodData?.totalPages ?? 1;
  const total = prodData?.total ?? 0;

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  function handleTabChange(v: ViewType) {
    setView(v);
    setPage(1);
    setSearch("");
  }

  const columns: TableColumn<AdminProduct>[] = [
    {
      key: "nr",
      header: "Nr. produto",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "produto",
      header: "Produto",
      render: (item) => {
        const thumb = item.media?.[0]?.url;
        return (
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-surface-hover border border-border-light">
              {thumb ? (
                <Image
                  fill
                  src={thumb}
                  alt={item.name}
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <div className="w-full h-full bg-surface-hover" />
              )}
            </div>
            <span className="text-text-dark text-sm font-medium font-figtree line-clamp-2">
              {item.name}
            </span>
          </div>
        );
      },
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
      key: "preco",
      header: "Preço",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="font-inter text-text-dark text-s">
          {formatPrice(item.basePrice)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <Link
          href={`/products/${item.id}`}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top row ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          Descubra as coleções
        </h2>
        <button
          onClick={() => router.push("/collections/new")}
          className="self-start sm:self-auto flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree pl-3 pr-5 py-3 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity"
        >
          <CirclePlus size={20} />
          Criar coleção
        </button>
      </div>

      {/* ── Collection cards grid ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Prev */}
        <div className="w-8 shrink-0 flex justify-center">
          {colPage > 0 && (
            <button
              onClick={() => setColPage((p) => p - 1)}
              className="flex items-center justify-center w-8 h-8 bg-card border border-border rounded-full shadow-sm text-text-muted hover:bg-surface-hover transition-colors"
              aria-label="Coleções anteriores"
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
          )}
        </div>

        {/* Grid: 4 cols × 2 rows */}
        <div className="grid grid-cols-2 sm:grid-cols-4 grid-rows-2 gap-3 flex-1">
          {colsLoading
            ? Array.from({ length: colsPerPage }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-card rounded-xl border border-border-light px-4 py-3"
                >
                  <div className="skeleton w-14 h-14 rounded-lg shrink-0" />
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div
                      className="skeleton h-3.5 rounded"
                      style={{ width: `${50 + ((i * 17) % 35)}%` }}
                    />
                    <div className="skeleton h-3 rounded w-1/3" />
                  </div>
                </div>
              ))
            : collections
                .slice(colPage * colsPerPage, (colPage + 1) * colsPerPage)
                .map((col) => <CollectionCard key={col.id} col={col} />)}
        </div>

        {/* Next */}
        <div className="w-8 shrink-0 flex justify-center">
          {(colPage + 1) * colsPerPage < collections.length && (
            <button
              onClick={() => setColPage((p) => p + 1)}
              className="flex items-center justify-center w-8 h-8 bg-card border border-border rounded-full shadow-sm text-text-muted hover:bg-surface-hover transition-colors"
              aria-label="Ver mais coleções"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Products card ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4">
          <div className="overflow-x-auto">
            <TabPill
              tabs={TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                count: tab.id === view ? total : undefined,
              }))}
              activeTab={view}
              onTabChange={(id) => handleTabChange(id as ViewType)}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome ou número"
              className="w-full sm:w-66"
            />
            <button
              onClick={() => router.push("/products/new")}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar produto"
            >
              <CirclePlus size={18} />
            </button>
            <button
              onClick={() => {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                setPage(1);
              }}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Ordenar"
            >
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-2 pt-4">
          <DataTable
            columns={columns}
            rows={products}
            keyExtractor={(p) => p.id}
            loading={prodsLoading}
            emptyMessage="Nenhum produto encontrado."
          />
        </div>

        {!prodsLoading && total > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
              de {total}
            </span>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </div>
  );
}
