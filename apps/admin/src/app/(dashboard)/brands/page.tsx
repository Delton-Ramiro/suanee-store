"use client";

import Image from "next/image";
import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import { useBrands, type Brand } from "@/lib/hooks/useBrands";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import CopyId from "@/components/ui/CopyId";
import TabPill from "@/components/ui/TabPill";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canManageBrands } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

const PAGE_SIZE = 20;

export default function BrandsPage() {
  const { user } = useAuth();
  const allowBrandManagement = canManageBrands(user);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useBrands(
    {
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      sortOrder,
    },
    { enabled: allowBrandManagement },
  );

  if (!allowBrandManagement) {
    return <AccessDeniedState message="A sua role não pode gerir marcas." />;
  }

  const brands = data?.items ?? [];
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

  const columns: TableColumn<Brand>[] = [
    {
      key: "nr",
      header: "Nr. marca",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "nome",
      header: "Nome",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg shrink-0 overflow-hidden bg-surface-hover border border-border-light">
            {item.logoUrl ? (
              <Image
                fill
                src={item.logoUrl}
                alt={item.name}
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="w-full h-full bg-bg" />
            )}
          </div>
          <span className="text-text-dark text-sm font-medium font-figtree">
            {item.name}
          </span>
        </div>
      ),
    },
    {
      key: "produtos",
      header: "Produtos",
      headerClassName: "w-[100px]",
      render: (item) => (
        <span className="font-inter text-text-body text-s">
          {item._count?.products ?? 0}
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
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <Link
          href={`/brands/${item.id}`}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Gestão de marcas"
        actionLabel="Criar marca"
        onAction={() => router.push("/brands/new")}
      />

      {/* Card */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          {/* Tab pill */}
          <div className="w-max">
            <TabPill
              tabs={[{ id: "all", label: "Todas as marcas", count: total }]}
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
              onClick={() => router.push("/brands/new")}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Criar marca"
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
            rows={brands}
            keyExtractor={(item) => item.id}
            loading={isLoading}
            emptyMessage="Nenhuma marca encontrada."
          />
        </div>

        {/* Range indicator */}
        {!isLoading && total > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
              de {total}
            </span>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </>
  );
}
