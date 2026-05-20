"use client";

import Image from "next/image";
import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import {
  useClients,
  type ClientListItem,
  type ClientSegment,
} from "@/lib/hooks/useClients";
import SearchBar from "@/components/ui/SearchBar";
import TabPill from "@/components/ui/TabPill";
import Pagination from "@/components/ui/Pagination";
import ClientDetailPanel from "@/components/ClientDetailPanel";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canViewClients } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Helpers ─────────────────────────────────────────────────────── */

function trendPct(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

function AvatarCircle({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div className="w-9 h-9 rounded-full bg-navy text-white text-[12px] font-bold font-lato flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

/* ── Entender tooltip ─────────────────────────────────────────────────────── */

function EntenderButton({ explanation }: { explanation: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-5 flex items-center justify-center border border-accent rounded-full text-navy text-s font-lato font-medium hover:bg-accent/5 active:bg-accent/10 transition-colors"
      >
        Entender
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-card border border-border-light rounded-lg shadow-card p-3 z-20">
          <p className="text-[12px] text-text-body font-figtree leading-relaxed">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */

type StatCardProps = {
  title: string;
  timeLabel: string;
  value: number | string;
  unit: string;
  subLabel: string;
  subCount: number | string;
  trend?: number;
  explanation: string;
};

function StatCard({
  title,
  timeLabel,
  value,
  unit,
  subLabel,
  subCount,
  trend,
  explanation,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div className="bg-card rounded-lg shadow-card px-5 py-5 flex flex-col min-h-55.5">
      {/* Title */}
      <p className="text-[18px] font-bold text-text-dark font-lato leading-6.5">
        {title}
      </p>

      {/* Time label */}
      <p className="text-sm text-text-muted font-lato mt-1 tracking-[-0.28px]">
        {timeLabel}
      </p>

      {/* Big number + unit + trend */}
      <div className="flex items-end gap-4 mt-4">
        <span className="text-[32px] font-bold text-primary font-lato leading-none">
          {value}
        </span>
        <div className="flex items-end gap-1 pb-0.5">
          <span className="text-[16px] text-text-dark font-lato leading-none">
            {unit}
          </span>
          {trend !== undefined && (
            <div className="flex items-center">
              {isPositive ? (
                <ArrowUp size={14} className="text-success" strokeWidth={2.5} />
              ) : isNegative ? (
                <ArrowDown
                  size={14}
                  className="text-danger"
                  strokeWidth={2.5}
                />
              ) : null}
              <span
                className={`text-sm font-lato leading-none ${
                  isPositive
                    ? "text-success"
                    : isNegative
                      ? "text-danger"
                      : "text-text-muted"
                }`}
              >
                {Math.abs(trend)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sub-line */}
      <p className="text-sm text-text-muted font-lato mt-4">
        {subLabel} <span className="font-bold text-navy">({subCount})</span>
      </p>

      {/* Entender — pushed to bottom right */}
      <div className="flex justify-end mt-auto">
        <EntenderButton explanation={explanation} />
      </div>
    </div>
  );
}

/* ── Segments ─────────────────────────────────────────────────────────────── */

const SEGMENT_TABS: { id: ClientSegment; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "buyers", label: "Compradores" },
  { id: "visitors", label: "Visitantes com conta" },
];

const PAGE_SIZE = 20;

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function ClientsPage() {
  const { user } = useAuth();
  const allowClients = canViewClients(user);
  const [segment, setSegment] = useState<ClientSegment>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { data, isLoading } = useClients(
    {
      page,
      limit: PAGE_SIZE,
      segment,
      search: search || undefined,
      sortBy: "createdAt",
      sortOrder,
    },
    { enabled: allowClients },
  );

  if (!allowClients) {
    return (
      <AccessDeniedState message="A sua role não pode aceder aos clientes." />
    );
  }

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const stats = data?.stats;

  const handleSearch = useCallback((v: string) => {
    startTransition(() => {
      setSearch(v);
      setPage(1);
    });
  }, []);

  function handleSegment(id: string) {
    setSegment(id as ClientSegment);
    setPage(1);
    setSelectedId(null);
  }

  function toggleSort() {
    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  const newClientsTrend = stats
    ? trendPct(stats.newClientsToday, stats.newClientsYesterday)
    : 0;
  const visitsTrend = stats
    ? trendPct(stats.visitsToday, stats.visitsYesterday)
    : 0;

  type Col = {
    key: string;
    header: string;
    headerClassName?: string;
    className?: string;
    render: (item: ClientListItem) => React.ReactNode;
  };

  const columns: Col[] = [
    {
      key: "client",
      header: "Cliente",
      render: (item) => (
        <div className="flex items-center gap-3">
          <AvatarCircle name={item.name} />
          <div className="flex flex-col min-w-0">
            <span className="text-s font-medium text-text-dark font-figtree truncate max-w-40">
              {item.name}
            </span>
            <span className="text-xxs text-text-subtle font-figtree truncate max-w-40">
              {item.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "orders",
      header: "Encomendas",
      headerClassName: "w-[110px]",
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-inter text-s text-text-body">
            {item.paidOrders}
          </span>
          {item.pendingOrders > 0 && (
            <span className="text-2xs text-text-subtle font-inter">
              +{item.pendingOrders} em aberto
            </span>
          )}
        </div>
      ),
    },
    {
      key: "spent",
      header: "Total gasto",
      headerClassName: "w-[150px]",
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-inter text-s text-text-body">
            {item.totalSpent > 0 ? formatPrice(item.totalSpent) : "—"}
          </span>
          {item.pendingOrdersAmount > 0 && (
            <span className="text-2xs text-text-subtle font-inter">
              +{formatPrice(item.pendingOrdersAmount)} por confirmar
            </span>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Segmento",
      headerClassName: "w-[130px]",
      render: (item) => (
        <span
          className={`text-xxs font-semibold font-inter px-2 py-0.5 rounded-full ${
            item.paidOrders > 0
              ? "bg-success/10 text-success"
              : "bg-surface-hover text-text-muted"
          }`}
        >
          {item.paidOrders > 0 ? "Comprador" : "Visitante"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Registado em",
      headerClassName: "w-[130px]",
      render: (item) => (
        <span className="text-[12px] text-text-muted font-inter">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stats cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total de clientes"
          timeLabel="Todo tempo"
          value={stats?.totalClients ?? "—"}
          unit="Clientes"
          subLabel="Últimos mês"
          subCount={stats?.lastMonthClients ?? "—"}
          explanation="Número total de utilizadores registados na plataforma desde o início. 'Últimos mês' conta os que criaram conta nos últimos 30 dias."
        />
        <StatCard
          title="Novos clientes"
          timeLabel="Hoje"
          value={stats?.newClientsToday ?? "—"}
          unit="clientes"
          subLabel="Ontem"
          subCount={stats?.newClientsYesterday ?? "—"}
          trend={stats ? newClientsTrend : undefined}
          explanation="Número de novos utilizadores registados hoje. A percentagem compara com o total do dia anterior — verde indica crescimento, vermelho indica queda."
        />
        <StatCard
          title="Visitas"
          timeLabel="Hoje"
          value={stats?.visitsToday ?? "—"}
          unit="visitas"
          subLabel="Ontem"
          subCount={stats?.visitsYesterday ?? "—"}
          trend={stats ? visitsTrend : undefined}
          explanation="Sessões de visitantes registadas hoje via identificador anónimo de dispositivo. Inclui utilizadores autenticados e não autenticados. Comparação percentual com ontem."
        />
      </div>

      {/* ── Table card ─────────────────────────────────────────────────── */}
      <div className="flex bg-card rounded-lg shadow-card overflow-hidden">
        {/* Main table area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-border-light gap-3">
            <div className="overflow-x-auto">
              <TabPill
                tabs={SEGMENT_TABS.map((t) => ({
                  id: t.id,
                  label: t.label,
                  count: t.id === segment ? total : undefined,
                }))}
                activeTab={segment}
                onTabChange={handleSegment}
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Pesquisar por nome ou email…"
                className="w-full sm:w-66"
              />
              <button
                onClick={toggleSort}
                title={
                  sortOrder === "asc"
                    ? "Ordenar decrescente"
                    : "Ordenar crescente"
                }
                className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="px-3 sm:px-6 pb-2 pt-4 overflow-x-auto">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="bg-navy rounded-md">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 first:rounded-l-md last:rounded-r-md text-left text-sm font-medium text-white font-figtree whitespace-nowrap ${col.headerClassName ?? ""}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-border-light last:border-b-0"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          <div
                            className="skeleton h-4 rounded"
                            style={{
                              width: `${60 + ((rowIdx * 13 + col.key.length * 7) % 30)}%`,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : clients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-10 text-center text-text-muted text-sm"
                    >
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clients.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() =>
                        setSelectedId((prev) =>
                          prev === item.id ? null : item.id,
                        )
                      }
                      className={`border-b border-border-light last:border-b-0 cursor-pointer transition-colors ${
                        selectedId === item.id
                          ? "bg-navy/5"
                          : "hover:bg-surface-hover"
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-sm text-text-dark font-figtree ${col.className ?? ""}`}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Range */}
          {!isLoading && total > 0 && (
            <div className="px-6 pb-4 pt-1 text-right">
              <span className="text-s font-inter text-text-subtle">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
                de {total}
              </span>
            </div>
          )}
        </div>

        {/* Detail panel — slides in by toggling width */}
        {selectedId && (
          <ClientDetailPanel
            clientId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </div>
  );
}
