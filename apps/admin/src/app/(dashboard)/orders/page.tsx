"use client";

import ClientDetailPanel from "@/components/ClientDetailPanel";
import CopyId from "@/components/ui/CopyId";
import Pagination from "@/components/ui/Pagination";
import SearchBar from "@/components/ui/SearchBar";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { formatDate, formatPrice } from "@/lib/format";
import {
  useOrders,
  type OrderListItem,
  type OrderSegment,
  type OrderStatus,
} from "@/lib/hooks/useOrders";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  Clock,
  CreditCard,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useAuth } from "@/lib/auth";
import { canViewOrders } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function trendPct(today: number, lastWeek: number): number {
  if (lastWeek === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - lastWeek) / lastWeek) * 100);
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

/* ── Standard stat card ───────────────────────────────────────────────────── */

type StatCardProps = {
  title: string;
  timeLabel: string;
  value: React.ReactNode;
  unit: string;
  subLabel: string;
  subCount: React.ReactNode;
  trend?: number;
  explanation: string;
  extra?: React.ReactNode;
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
  extra,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div className="bg-card rounded-lg shadow-card px-5 py-5 flex flex-col min-h-55.5">
      <p className="text-[18px] font-bold text-text-dark font-lato leading-6.5">
        {title}
      </p>
      <p className="text-sm text-text-muted font-lato mt-1 tracking-[-0.28px]">
        {timeLabel}
      </p>
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
                {Math.abs(trend ?? 0)}%
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-text-muted font-lato mt-4">
        {subLabel} <span className="font-bold text-navy">({subCount})</span>
      </p>
      {extra && <div className="mt-2">{extra}</div>}
      <div className="flex justify-end mt-auto">
        <EntenderButton explanation={explanation} />
      </div>
    </div>
  );
}

/* ── Delivery stat card (two-number layout) ───────────────────────────────── */

function DeliveryStatCard({
  deliveredToday,
  inTransitNow,
}: {
  deliveredToday: number;
  inTransitNow: number;
}) {
  return (
    <div className="bg-card rounded-lg shadow-card px-5 py-5 flex flex-col min-h-55.5">
      <p className="text-[18px] font-bold text-text-dark font-lato leading-6.5">
        Entregas e trânsito
      </p>
      <p className="text-sm text-text-muted font-lato mt-1 tracking-[-0.28px]">
        Hoje
      </p>
      <div className="flex items-center gap-6 mt-4 flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-s text-text-muted font-lato">
            Entregas feitas
          </span>
          <span className="text-[32px] font-bold text-primary font-lato leading-none">
            {deliveredToday}
          </span>
        </div>
        <div className="w-px h-12 bg-border-light shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-s text-text-muted font-lato">Em trânsito</span>
          <span className="text-[32px] font-bold text-navy font-lato leading-none">
            {inTransitNow}
          </span>
        </div>
      </div>
      <div className="flex justify-end mt-auto">
        <EntenderButton explanation="'Entregas feitas' conta os pedidos marcados como entregues hoje. 'Em trânsito' mostra todos os pedidos que estão actualmente a caminho do cliente." />
      </div>
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pendente",
    icon: <Clock size={14} strokeWidth={2} />,
    className: "text-warning",
  },
  paid: {
    label: "Pago",
    icon: <CreditCard size={14} strokeWidth={2} />,
    className: "text-success",
  },
  in_process: {
    label: "Em processo",
    icon: <Package size={14} strokeWidth={2} />,
    className: "text-accent",
  },
  in_transit: {
    label: "Em trânsito",
    icon: <Truck size={14} strokeWidth={2} />,
    className: "text-navy",
  },
  delivered: {
    label: "Entregue",
    icon: <CheckCircle size={14} strokeWidth={2} />,
    className: "text-accent",
  },
  returned: {
    label: "Devolvido",
    icon: <RotateCcw size={14} strokeWidth={2} />,
    className: "text-danger",
  },
  cancelled: {
    label: "Cancelado",
    icon: <XCircle size={14} strokeWidth={2} />,
    className: "text-danger",
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <div className={`flex items-center gap-1.5 ${cfg.className}`}>
      {cfg.icon}
      <span className="text-sm font-lato font-medium">{cfg.label}</span>
    </div>
  );
}

/* ── Segments ─────────────────────────────────────────────────────────────── */

const SEGMENT_TABS: { id: OrderSegment; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Pendentes" },
  { id: "paid", label: "Pagas" },
  { id: "in_process", label: "Em processamento" },
  { id: "in_transit", label: "Em trânsito" },
  { id: "delivered", label: "Entregues" },
  { id: "cancelled", label: "Canceladas" },
  { id: "returned", label: "Devolvidas" },
];

const PAGE_SIZE = 20;

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function OrdersPage() {
  const { user } = useAuth();
  const allowOrders = canViewOrders(user);
  const [segment, setSegment] = useState<OrderSegment>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [openLostOrders, setOpenLostOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{
    clientId: string;
    orderId: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const { data, isLoading } = useOrders(
    {
      page,
      limit: PAGE_SIZE,
      status: segment === "all" ? undefined : segment,
      search: search || undefined,
      sortBy: "createdAt",
      sortOrder,
    },
    { enabled: allowOrders },
  );

  if (!allowOrders) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às encomendas." />
    );
  }

  const orders = data?.items ?? [];
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
    setSegment(id as OrderSegment);
    setPage(1);
    setSelectedOrder(null);
  }

  function toggleSort() {
    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  const salesTrend = stats
    ? trendPct(stats.todaySales, stats.lastWeekSameDaySales)
    : 0;
  const ordersTrend = stats
    ? trendPct(stats.newOrdersToday, stats.newOrdersLastWeekSameDay)
    : 0;

  type Col = {
    key: string;
    header: string;
    headerClassName?: string;
    className?: string;
    render: (item: OrderListItem) => React.ReactNode;
  };

  const columns: Col[] = [
    {
      key: "nr",
      header: "Nr. encomenda",
      headerClassName: "w-[130px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "client",
      header: "Nome do cliente",
      headerClassName: "w-[160px]",
      render: (item) => (
        <div className="flex items-center gap-2">
          <AvatarCircle name={item.user.name} avatarUrl={item.user.avatarUrl} />
          <span className="text-s text-text-dark font-figtree truncate max-w-32">
            {item.user.name}
          </span>
        </div>
      ),
    },
    {
      key: "product",
      header: "Produto(s)",
      headerClassName: "w-[220px]",
      render: (item) => {
        const first = item.items[0];
        const count = item._count.items;
        if (!first) return <span className="text-text-muted">—</span>;
        const thumbUrl = first.product.media[0]?.url;
        return (
          <div className="flex items-center gap-2">
            {thumbUrl ? (
              <Image
                src={thumbUrl}
                alt={first.product.name}
                width={36}
                height={36}
                className="w-9 h-9 rounded border border-border-light object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded border border-border-light bg-surface-hover shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-s text-text-dark font-lato truncate max-w-36">
                {first.product.name}
              </span>
              {count > 1 && (
                <span className="text-xxs text-text-muted font-figtree">
                  +{count - 1} {count - 1 === 1 ? "item" : "itens"}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "itemsCount",
      header: "Nº de prod.",
      headerClassName: "w-[90px]",
      className: "text-center",
      render: (item) => (
        <span className="font-inter text-s text-text-body">
          {item._count.items}
        </span>
      ),
    },
    {
      key: "date",
      header: "Data",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="text-s text-text-muted font-inter">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "price",
      header: "Preço",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="font-inter text-sm text-text-dark">
          {formatPrice(item.total)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      headerClassName: "w-[140px]",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "updatedAt",
      header: "Última atualização",
      headerClassName: "w-[140px]",
      render: (item) => (
        <span className="text-[12px] text-text-muted font-inter">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stats cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total de vendas"
          timeLabel="Hoje"
          value={
            stats ? (
              <span title={`${formatPrice(stats.todaySales)} MZN`}>
                {formatPrice(stats.todaySales)}
              </span>
            ) : (
              "—"
            )
          }
          unit="Mzn"
          subLabel="Últimos 7 dias"
          subCount={
            stats ? (
              <span title={`${formatPrice(stats.last7DaysSales)} MZN`}>
                {formatPrice(stats.last7DaysSales)} Mzn
              </span>
            ) : (
              "—"
            )
          }
          trend={stats ? salesTrend : undefined}
          explanation="Total arrecadado com encomendas pagas hoje. A percentagem compara com o mesmo dia da semana passada. Passe o rato por cima dos valores para ver o montante exacto."
          extra={
            stats &&
            (stats.returnedSalesLast7Days > 0 ||
              stats.cancelledSalesLast7Days > 0) ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-s text-danger font-figtree">
                  ⚠{" "}
                  {formatPrice(
                    stats.returnedSalesLast7Days +
                      stats.cancelledSalesLast7Days,
                  )}{" "}
                  Mzn em devoluções / cancelamentos (7 dias)
                </p>
                <button
                  type="button"
                  onClick={() => setOpenLostOrders((v) => !v)}
                  className="self-start h-7 px-3 rounded-full border border-danger/40 text-danger text-[12px] font-lato font-medium hover:bg-danger/5 transition-colors"
                >
                  {openLostOrders ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
                {openLostOrders && (
                  <div className="bg-danger/5 border border-danger/20 rounded-lg px-3 py-2 flex flex-col gap-1">
                    {stats.returnedSalesLast7Days > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body">
                        <span>Devolvidas (7 dias)</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.returnedSalesLast7Days)} Mzn
                        </span>
                      </div>
                    )}
                    {stats.cancelledSalesLast7Days > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body">
                        <span>Canceladas (7 dias)</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.cancelledSalesLast7Days)} Mzn
                        </span>
                      </div>
                    )}
                    {stats.returnedSalesToday > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body border-t border-danger/20 pt-1 mt-1">
                        <span>Devolvidas (hoje)</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.returnedSalesToday)} Mzn
                        </span>
                      </div>
                    )}
                    {stats.cancelledSalesToday > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body">
                        <span>Canceladas (hoje)</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.cancelledSalesToday)} Mzn
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : undefined
          }
        />
        <StatCard
          title="Novas encomendas"
          timeLabel="Hoje"
          value={stats?.newOrdersToday ?? "—"}
          unit="encomendas"
          subLabel="Últimos 7 dias"
          subCount={stats?.newOrdersLast7Days ?? "—"}
          trend={stats ? ordersTrend : undefined}
          explanation="Número de encomendas pagas hoje. A percentagem compara com o mesmo dia da semana passada. 'Últimos 7 dias' mostra o total de encomendas no período."
        />
        <DeliveryStatCard
          deliveredToday={stats?.deliveredToday ?? 0}
          inTransitNow={stats?.inTransitNow ?? 0}
        />
      </div>

      {/* ── Table card ─────────────────────────────────────────────────── */}
      <div className="flex bg-card rounded-lg shadow-card overflow-hidden">
        {/* Main table area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-border-light gap-3">
            <div className="w-full sm:w-52">
              <SearchableSelect
                value={segment}
                onChange={(v) => handleSegment(v || "all")}
                options={SEGMENT_TABS.map((t) => ({
                  value: t.id,
                  label: t.label,
                }))}
                searchable={false}
                placeholder="Filtrar por estado…"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Procure pelo cliente ou número…"
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
                ) : orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-10 text-center text-text-muted text-sm"
                    >
                      Nenhuma encomenda encontrada.
                    </td>
                  </tr>
                ) : (
                  orders.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() =>
                        setSelectedOrder((prev) =>
                          prev?.orderId === item.id
                            ? null
                            : { clientId: item.user.id, orderId: item.id },
                        )
                      }
                      className={`border-b border-border-light last:border-b-0 cursor-pointer transition-colors ${
                        selectedOrder?.orderId === item.id
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

        {/* Client detail panel */}
        {selectedOrder && (
          <ClientDetailPanel
            clientId={selectedOrder.clientId}
            orderId={selectedOrder.orderId}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </div>
  );
}
