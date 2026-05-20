"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { CirclePlus } from "lucide-react";
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
import { canCreateProducts, canViewProducts } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

type ViewType = "all" | "available" | "importation" | "draft" | "hidden";

const TABS: { id: ViewType; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "available", label: "Em stock" },
  { id: "importation", label: "Importação" },
  { id: "draft", label: "Rascunho" },
  { id: "hidden", label: "Ocultos" },
];

const PAGE_SIZE = 20;

function StatusBadge({
  status,
  stockStatus,
}: {
  status: string;
  stockStatus: string;
}) {
  if (status === "draft")
    return (
      <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-warning/10 text-warning font-inter">
        Rascunho
      </span>
    );
  if (status === "published" && stockStatus === "in_stock")
    return (
      <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-success/10 text-success font-inter">
        Em stock
      </span>
    );
  if (status === "published" && stockStatus === "by_importation")
    return (
      <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-accent/10 text-accent font-inter">
        Importação
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-border text-text-muted font-inter">
      {status}
    </span>
  );
}

const COLUMNS: TableColumn<AdminProduct>[] = [
  {
    key: "product",
    header: "Produto",
    render: (p) => (
      <Link
        href={`/products/${p.id}`}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface-hover border border-border-light shrink-0">
          {p.media[0] ? (
            <Image
              fill
              src={p.media[0].url}
              alt={p.name}
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full bg-bg" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-s font-medium text-text-dark font-figtree truncate max-w-[200px]">
            {p.name}
          </span>
          {p.brand && (
            <span className="text-xxs text-text-subtle font-figtree">
              {p.brand.name}
            </span>
          )}
        </div>
      </Link>
    ),
  },
  {
    key: "id",
    header: "ID",
    render: (p) => <CopyId id={p.id} />,
  },
  {
    key: "price",
    header: "Preço",
    render: (p) => (
      <span className="font-inter text-s text-text-dark">
        {formatPrice(p.basePrice)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Estado",
    render: (p) => (
      <StatusBadge status={p.status} stockStatus={p.stockStatus} />
    ),
  },
  {
    key: "variants",
    header: "Variantes",
    render: (p) => (
      <span className="font-inter text-s text-text-muted">
        {p._count.variants}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Criado em",
    render: (p) => (
      <span className="text-[12px] text-text-muted font-figtree">
        {formatDate(p.createdAt)}
      </span>
    ),
  },
  {
    key: "updatedAt",
    header: "Última atualização",
    render: (p) => (
      <span className="text-[12px] text-text-muted font-figtree">
        {formatDate(p.updatedAt)}
      </span>
    ),
  },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const allowProductView = canViewProducts(user);
  const allowCreateProduct = canCreateProducts(user);
  const [view, setView] = useState<ViewType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminProducts(
    {
      view,
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { enabled: allowProductView },
  );

  if (!allowProductView) {
    return (
      <AccessDeniedState message="A sua role não pode aceder aos produtos." />
    );
  }

  const products = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
  }

  function handleTabChange(t: ViewType) {
    setView(t);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[22px] font-bold text-primary font-lato">
          Produtos
        </h1>
        {allowCreateProduct ? (
          <Link
            href="/products/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-s font-semibold font-figtree hover:bg-primary transition-colors shrink-0"
          >
            <CirclePlus size={16} />
            Novo produto
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <TabPill
          tabs={TABS}
          activeTab={view}
          onTabChange={(id) => handleTabChange(id as ViewType)}
        />
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Pesquisar produtos…"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        rows={products}
        keyExtractor={(p) => p.id}
        loading={isLoading}
        emptyMessage="Nenhum produto encontrado."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination page={page} total={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
