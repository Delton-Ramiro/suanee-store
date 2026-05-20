"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  useCurrencyRates,
  useCreateCurrencyRate,
  useUpdateCurrencyRate,
  type CurrencyRate,
} from "@/lib/hooks/useCurrency";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import CurrencyFormModal from "@/components/currencies/CurrencyFormModal";
import CopyId from "@/components/ui/CopyId";
import TabPill from "@/components/ui/TabPill";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageCurrencies } from "@/lib/admin-access";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; rate: CurrencyRate };

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function AdminCurrencyPage() {
  const { user } = useAuth();
  const allowCurrencyManagement = canManageCurrencies(user);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [, startTransition] = useTransition();

  const { data: allRates = [], isLoading } = useCurrencyRates({
    enabled: allowCurrencyManagement,
  });
  const createRate = useCreateCurrencyRate();
  const updateRate = useUpdateCurrencyRate();

  /* Client-side filter + sort */
  const rates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allRates.filter(
          (r) =>
            r.code.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            r.symbol.toLowerCase().includes(q),
        )
      : allRates;

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [allRates, search, sortOrder]);

  const handleSearch = useCallback((value: string) => {
    startTransition(() => setSearch(value));
  }, []);

  function toggleSort() {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  async function handleSubmit(data: {
    code: string;
    name: string;
    symbol: string;
    rate: number;
  }) {
    if (!allowCurrencyManagement) return;
    try {
      if (modal.mode === "create") {
        await createRate.mutateAsync(data);
      } else if (modal.mode === "edit") {
        await updateRate.mutateAsync({ id: modal.rate.id, data });
      }
      setModal({ mode: "closed" });
    } catch {
      // toast already shown by the mutation hook — keep modal open
    }
  }

  /* ── Table columns ──────────────────────────────────────────────────────── */
  const columns: TableColumn<CurrencyRate>[] = [
    {
      key: "id",
      header: "Nr.",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "code",
      header: "Código",
      headerClassName: "w-[100px]",
      render: (item) => (
        <span className="font-inter font-semibold text-text-dark text-sm">
          {item.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nome",
      render: (item) => (
        <span className="text-text-dark text-sm">{item.name}</span>
      ),
    },
    {
      key: "symbol",
      header: "Símbolo",
      headerClassName: "w-[90px]",
      render: (item) => (
        <span className="font-inter text-text-body text-sm">{item.symbol}</span>
      ),
    },
    {
      key: "rate",
      header: "Taxa (MZN)",
      headerClassName: "w-[130px]",
      render: (item) => (
        <span className="font-inter text-text-body text-sm">
          {formatPrice(item.rate)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Atualizado em",
      headerClassName: "w-[150px]",
      render: (item) => (
        <span className="text-text-body font-inter text-sm">
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
          onClick={() => setModal({ mode: "edit", rate: item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </button>
      ),
    },
  ];

  const isMutating = createRate.isPending || updateRate.isPending;

  return (
    <>
      <PageHeader
        title="Gestão câmbio"
        actionLabel={allowCurrencyManagement ? "Criar câmbio" : undefined}
        onAction={
          allowCurrencyManagement
            ? () => setModal({ mode: "create" })
            : undefined
        }
      />

      {!allowCurrencyManagement ? (
        <div className="bg-card rounded-lg border border-border-light px-6 py-8">
          <p className="text-sm text-text-body font-figtree">
            A sua role não pode gerir taxas de câmbio.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
            <div className="w-max">
              <TabPill
                tabs={[
                  {
                    id: "all",
                    label: "Todos câmbios",
                    count: allRates.length,
                  },
                ]}
                activeTab="all"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Procure por código ou nome"
                className="w-full sm:w-66"
              />
              <button
                onClick={() => setModal({ mode: "create" })}
                className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                aria-label="Criar câmbio"
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
          <div className="px-6 pb-6 pt-4">
            <DataTable
              columns={columns}
              rows={rates}
              keyExtractor={(r) => r.id}
              loading={isLoading}
              emptyMessage="Nenhuma taxa de câmbio encontrada."
            />
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {allowCurrencyManagement && (
        <CurrencyFormModal
          open={modal.mode !== "closed"}
          onClose={() => setModal({ mode: "closed" })}
          onSubmit={handleSubmit}
          initial={modal.mode === "edit" ? modal.rate : undefined}
          loading={isMutating}
        />
      )}
    </>
  );
}
