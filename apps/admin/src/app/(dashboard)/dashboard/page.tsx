"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  useDashboard,
  useDashboardRevenue,
  type BestSellingProduct,
  type TopProduct,
} from "@/lib/hooks/useDashboard";
import { formatPrice, formatDateTime, shortId } from "@/lib/format";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useAuth } from "@/lib/auth";
import { canViewDashboard } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Month / Year constants ──────────────────────────────────────────────── */

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 2026 + 1 },
  (_, i) => 2026 + i,
);

const MONTH_OPTIONS = MONTHS.map((label, i) => ({
  value: String(i + 1),
  label,
}));

const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: String(y) }));

/* ── "Entender" explanations ─────────────────────────────────────────────── */

const EXPLANATIONS: Record<string, string> = {
  vendas:
    "Mostra o total de receita gerada pelas encomendas confirmadas (pagas, em processo, em trânsito ou entregues) nos últimos 7 dias. O valor anterior refere-se às 7 dias que antecederam esse período.",
  encomendas:
    "Número de encomendas confirmadas (excluindo pendentes, canceladas e devolvidas) nos últimos 7 dias. A comparação é feita com as 7 dias anteriores.",
  usuarios:
    "Total de novos utilizadores que criaram conta nos últimos 7 dias. Os \u201cPenúltimos 7 dias\u201d referem-se ao período entre 14 e 7 dias atrás.",
  operacoes:
    "As 5 encomendas mais recentes, independentemente do estado. Permite ter uma visão rápida das últimas transações.",
  topProdutos:
    "Top 10 produtos com mais encomendas distintas. Pesquise pelo nome para filtrar rapidamente.",
  maisVendidos:
    "Top 10 produtos com maior quantidade total vendida (soma das unidades em todas as encomendas).",
};

/* ── Status badge ────────────────────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-warning" },
  paid: { label: "Pago", color: "text-success" },
  in_process: { label: "Em processo", color: "text-accent" },
  in_transit: { label: "Em trânsito", color: "text-navy" },
  delivered: { label: "Entregue", color: "text-success" },
  returned: { label: "Devolvido", color: "text-danger" },
  cancelled: { label: "Cancelado", color: "text-danger" },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: "text-text-muted" };
  const dotColor = cfg.color.replace("text-", "bg-");
  return (
    <span
      className={`flex items-center gap-1.5 text-s font-figtree ${cfg.color}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
      {cfg.label}
    </span>
  );
}

/* ── Trend arrow ─────────────────────────────────────────────────────────── */

function Trend({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const isUp = pct >= 0;
  const isFlat = Math.abs(pct) < 0.01;
  if (isFlat) return <Minus size={14} className="text-text-muted" />;
  return (
    <span
      className={`flex items-center gap-0.5 text-s font-lato font-medium ${isUp ? "text-success" : "text-danger"}`}
    >
      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ── Entender button ─────────────────────────────────────────────────────── */

function EntenderButton({
  id,
  open,
  onToggle,
}: {
  id: string;
  open: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onToggle(id)}
        className="h-8 px-5 flex items-center justify-center border border-accent rounded-full text-navy text-s font-lato font-medium hover:bg-accent/5 active:bg-accent/10 transition-colors"
      >
        Entender
      </button>
      {open === id && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-card border border-border-light rounded-lg shadow-card p-3 z-20">
          <p className="text-[12px] text-text-body font-figtree leading-relaxed">
            {EXPLANATIONS[id]}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({
  title,
  value,
  unit,
  current,
  prev,
  prevLabel,
  openExpl,
  explId,
  onToggle,
  extra,
  children,
}: {
  title: string;
  value: React.ReactNode;
  unit?: string;
  current: number;
  prev: number;
  prevLabel?: string;
  openExpl: string | null;
  explId: string;
  onToggle: (id: string) => void;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg shadow-card px-5 py-5 flex flex-col gap-3 min-h-55">
      <div>
        <p className="text-[17px] font-bold text-text-dark font-lato">
          {title}
        </p>
        <p className="text-s text-text-muted font-lato mt-0.5">
          Últimos 7 dias
        </p>
      </div>

      {children ?? (
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[32px] font-bold text-primary font-lato leading-none">
            {value}
          </span>
          {unit && (
            <div className="flex items-end gap-1 pb-0.5">
              <span className="text-md text-text-dark font-figtree">
                {unit}
              </span>
              <Trend current={current} prev={prev} />
            </div>
          )}
        </div>
      )}

      {prevLabel && (
        <p className="text-s text-text-muted font-lato">
          Penúltimos 7 dias{" "}
          <span className="font-bold text-navy">{prevLabel}</span>
        </p>
      )}

      {extra}

      <div className="mt-auto flex justify-end">
        <EntenderButton id={explId} open={openExpl} onToggle={onToggle} />
      </div>
    </div>
  );
}

/* ── Chart tooltip ───────────────────────────────────────────────────────── */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card shadow-card rounded-lg px-3 py-2 border border-border-light">
      <p className="text-[12px] text-text-muted font-figtree">Dia {label}</p>
      <p className="text-sm font-bold text-primary font-lato">
        {formatPrice(payload[0].value)} MZN
      </p>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const allowDashboard = canViewDashboard(user);
  const now = new Date();
  const [chartMonth, setChartMonth] = useState(now.getMonth() + 1);
  const [chartYear, setChartYear] = useState(now.getFullYear());
  const [openExpl, setOpenExpl] = useState<string | null>(null);
  const [topSearch, setTopSearch] = useState("");
  const [sellSearch, setSellSearch] = useState("");
  const [openLostDash, setOpenLostDash] = useState(false);

  const { data, isLoading } = useDashboard({ enabled: allowDashboard });
  const { data: revenueData, isLoading: revenueLoading } = useDashboardRevenue(
    chartMonth,
    chartYear,
    { enabled: allowDashboard },
  );

  if (!allowDashboard) {
    return (
      <AccessDeniedState message="A sua role não pode aceder ao dashboard." />
    );
  }

  function toggleExpl(id: string) {
    setOpenExpl((prev) => (prev === id ? null : id));
  }

  // Filtered local lists
  const filteredTop: TopProduct[] = (data?.topProducts ?? []).filter((p) =>
    p.name.toLowerCase().includes(topSearch.toLowerCase()),
  );
  const filteredSell: BestSellingProduct[] = (
    data?.bestSellingProducts ?? []
  ).filter((p) => p.name.toLowerCase().includes(sellSearch.toLowerCase()));

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-55 rounded-lg" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="skeleton h-72 rounded-lg" />
          <div className="skeleton h-72 rounded-lg" />
        </div>
        <div className="skeleton h-72 rounded-lg" />
      </div>
    );
  }

  const { stats, latestOrders, latestCategories, latestProducts } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total de vendas */}
        <StatCard
          title="Total de vendas"
          value={formatPrice(stats.sales7d)}
          unit="Mzn"
          current={stats.sales7d}
          prev={stats.salesPrev7d}
          prevLabel={`(${formatPrice(stats.salesPrev7d)} Mzn)`}
          openExpl={openExpl}
          explId="vendas"
          onToggle={toggleExpl}
          extra={
            stats.returnedSales7d > 0 || stats.cancelledSales7d > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-s text-danger font-figtree">
                  ⚠{" "}
                  {formatPrice(stats.returnedSales7d + stats.cancelledSales7d)}{" "}
                  Mzn em devoluções / cancelamentos
                </p>
                <button
                  type="button"
                  onClick={() => setOpenLostDash((v) => !v)}
                  className="self-start h-7 px-3 rounded-full border border-danger/40 text-danger text-[12px] font-lato font-medium hover:bg-danger/5 transition-colors"
                >
                  {openLostDash ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
                {openLostDash && (
                  <div className="bg-danger/5 border border-danger/20 rounded-lg px-3 py-2 flex flex-col gap-1">
                    {stats.returnedSales7d > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body">
                        <span>Devolvidas</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.returnedSales7d)} Mzn
                        </span>
                      </div>
                    )}
                    {stats.cancelledSales7d > 0 && (
                      <div className="flex justify-between text-s font-figtree text-text-body">
                        <span>Canceladas</span>
                        <span className="font-inter text-danger">
                          {formatPrice(stats.cancelledSales7d)} Mzn
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : undefined
          }
        />

        {/* Total de encomendas */}
        <StatCard
          title="Total de encomendas"
          value={stats.orders7d}
          unit="encomendas"
          current={stats.orders7d}
          prev={stats.ordersPrev7d}
          prevLabel={`(${stats.ordersPrev7d})`}
          openExpl={openExpl}
          explId="encomendas"
          onToggle={toggleExpl}
        />

        {/* Total de usuários — split layout */}
        <StatCard
          title="Total de usuários"
          value={0}
          current={stats.newUsers7d}
          prev={stats.newUsersPrev7d}
          openExpl={openExpl}
          explId="usuarios"
          onToggle={toggleExpl}
        >
          <div className="flex items-start gap-6 mt-1">
            <div className="flex flex-col gap-1">
              <span className="text-s text-text-body font-figtree">Novos</span>
              <span className="text-[28px] font-bold text-primary font-lato leading-none">
                {stats.newUsers7d}
              </span>
            </div>
            <div className="w-px h-10 bg-border-light self-center" />
            <div className="flex flex-col gap-1">
              <span className="text-s text-text-body font-figtree">
                Penúltimos 7 dias
              </span>
              <span className="text-[28px] font-bold text-navy font-lato leading-none">
                {stats.newUsersPrev7d}
              </span>
            </div>
          </div>
        </StatCard>
      </div>

      {/* ── Receita chart ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg shadow-card px-5 py-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-[17px] font-bold text-text-dark font-lato">
            Receita
          </p>
          <div className="flex items-center gap-2">
            <div className="w-40">
              <SearchableSelect
                value={String(chartMonth)}
                onChange={(v) => setChartMonth(Number(v))}
                options={MONTH_OPTIONS}
                searchable={false}
              />
            </div>
            <div className="w-28">
              <SearchableSelect
                value={String(chartYear)}
                onChange={(v) => setChartYear(Number(v))}
                options={YEAR_OPTIONS}
                searchable={false}
              />
            </div>
          </div>
        </div>
        <div className="h-56">
          {revenueLoading ? (
            <div className="skeleton h-full w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueData?.days ?? []}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{
                    fontSize: 11,
                    fill: "#8b909a",
                    fontFamily: "var(--font-inter)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: "#8b909a",
                    fontFamily: "var(--font-inter)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={36}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{
                    stroke: "#356e99",
                    strokeWidth: 1,
                    strokeDasharray: "4 2",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#023337"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#023337",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Operações de compra + Produtos Tops ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Operações de compra */}
        <div className="bg-card rounded-lg shadow-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
            <p className="text-[16px] font-bold text-text-dark font-lato">
              Operações de compra
            </p>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="text-left border-b border-border-light">
                  <th className="px-4 py-3 text-[12px] font-medium text-text-table-head font-figtree w-8">
                    Nr
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-table-head font-figtree">
                    Id encomenda
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-table-head font-figtree">
                    Data
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-table-head font-figtree">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-text-table-head font-figtree text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className="border-b border-border-light last:border-b-0 hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-s text-text-muted font-inter">
                      {idx + 1}.
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-s text-accent font-inter hover:underline"
                      >
                        {shortId(order.user.id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-muted font-inter whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-s font-inter text-text-dark">
                        {formatPrice(order.total)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-border-light">
            <EntenderButton
              id="operacoes"
              open={openExpl}
              onToggle={toggleExpl}
            />
          </div>
        </div>

        {/* Produtos Tops */}
        <div className="bg-card rounded-lg shadow-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border-light">
            <p className="text-md font-bold text-text-dark font-lato">
              Produtos Tops
            </p>
            <Link
              href="/products"
              className="mt-3 block text-center text-[12px] text-accent font-figtree hover:underline"
            >
              Todos produtos
            </Link>
          </div>
          {/* Local search */}
          <div className="px-4 py-2 border-b border-border-light">
            <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border-light bg-bg">
              <Search size={13} className="text-text-label shrink-0" />
              <input
                type="text"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="Procurar nome"
                className="flex-1 text-[12px] font-figtree text-text-dark bg-transparent outline-none placeholder:text-text-label"
              />
            </div>
          </div>
          <div className="flex flex-col divide-y divide-border-light overflow-y-auto flex-1 max-h-85">
            {filteredTop.length === 0 && (
              <p className="text-s text-text-muted text-center py-8 font-figtree">
                Sem resultados.
              </p>
            )}
            {filteredTop.map((p) => (
              <div
                key={p.productId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover"
              >
                {p.thumbnailUrl ? (
                  <Image
                    src={p.thumbnailUrl}
                    alt={p.name}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded border border-border-light object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded border border-border-light bg-surface-hover shrink-0" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-s text-text-dark font-lato truncate">
                    {p.name}
                  </span>
                  <span className="text-xxs text-text-muted font-inter">
                    {shortId(p.productId)}
                  </span>
                </div>
                <span className="text-s font-bold font-inter text-primary shrink-0">
                  {formatPrice(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Produtos mais vendidos + Adicionar novo produto ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Produtos mais vendidos */}
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
            <p className="text-[16px] font-bold text-text-dark font-lato">
              Produtos mais vendidos
            </p>
            <div className="flex items-center gap-2">
              {/* Local search */}
              <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border-light bg-bg">
                <Search size={13} className="text-text-label shrink-0" />
                <input
                  type="text"
                  value={sellSearch}
                  onChange={(e) => setSellSearch(e.target.value)}
                  placeholder="Procurar produto"
                  className="text-[12px] font-figtree text-text-dark bg-transparent outline-none placeholder:text-text-label w-36"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="bg-navy">
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree">
                    Produto
                  </th>
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree ">
                    Nr. Encomendas
                  </th>
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree">
                    Estado
                  </th>
                  <th className="px-8 py-3 text-right text-s font-medium text-white font-figtree">
                    Preço
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSell.map((p) => (
                  <tr
                    key={p.productId}
                    className="border-b border-border-light last:border-b-0 hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.thumbnailUrl ? (
                          <Image
                            src={p.thumbnailUrl}
                            alt={p.name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded border border-border-light object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded border border-border-light bg-surface-hover shrink-0" />
                        )}
                        <span className="text-s text-text-dark font-lato">
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-s font-inter text-text-dark">
                      {p.totalQuantity}
                    </td>
                    <td className="px-4 py-3">
                      {p.stockStatus === "in_stock" ? (
                        <span className="flex items-center gap-1.5 text-[12px] text-text-muted font-figtree">
                          <span className="w-2 h-2 rounded-full bg-navy inline-block" />
                          Disponível
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[12px] text-warning font-figtree">
                          <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                          Por encomenda
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-3 text-right">
                      <span className="text-s font-inter font-bold text-text-dark">
                        {formatPrice(p.basePrice)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSell.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-text-muted text-sm"
                    >
                      Sem resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-border-light">
            <EntenderButton
              id="maisVendidos"
              open={openExpl}
              onToggle={toggleExpl}
            />
          </div>
        </div>

        {/* Adicionar novo produto */}
        <div className="bg-card rounded-lg shadow-card px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-md font-bold text-text-dark font-lato">
              Adicionar novo produto
            </p>
            <Link
              href="/products/new"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-navy text-white text-[12px] font-lato font-semibold hover:bg-accent transition-colors"
            >
              <Plus size={13} />
              Criar novo
            </Link>
          </div>

          <div className="flex flex-col gap-5">
            {/* Latest categories */}
            <div>
              <p className="text-xxs text-text-subtle font-figtree tracking-wide mb-2">
                Categorias
              </p>
              <div className="flex flex-col gap-1.5">
                {latestCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href="/categories"
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border-light hover:bg-surface-hover transition-colors"
                  >
                    {cat.imageUrl ? (
                      <Image
                        src={cat.imageUrl}
                        alt={cat.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-surface-hover shrink-0" />
                    )}
                    <span className="flex-1 text-s font-lato text-text-dark font-medium truncate">
                      {cat.name}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-text-label shrink-0"
                    />
                  </Link>
                ))}
              </div>
              <Link
                href="/categories"
                className="mt-2 block text-center text-[12px] text-accent font-figtree hover:underline"
              >
                Ver todas
              </Link>
            </div>

            {/* Latest products */}
            <div>
              <p className="text-xxs text-text-subtle font-figtree tracking-wide mb-2">
                Últimos produtos
              </p>
              <div className="flex flex-col gap-1.5">
                {latestProducts.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.id}`}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border-light hover:bg-surface-hover transition-colors"
                  >
                    {prod.thumbnailUrl ? (
                      <Image
                        src={prod.thumbnailUrl}
                        alt={prod.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-surface-hover shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-lato text-text-dark font-medium truncate">
                        {prod.name}
                      </span>
                      <span className="text-[12px] text-primary font-inter font-semibold">
                        {formatPrice(prod.basePrice)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href="/products"
                className="mt-2 block text-center text-[12px] text-accent font-figtree hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
