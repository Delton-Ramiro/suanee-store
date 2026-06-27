"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowLeft,
  ChevronRight,
  MapPin,
  Home,
  Package,
  Pencil,
  Check,
  Search,
  Loader2,
} from "lucide-react";
import { useOrdersDrawer, ordersStore } from "@/lib/stores/ordersStore";
import { authFetch, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loginStore } from "@/lib/stores/loginStore";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "paid"
  | "in_process"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

type PickPointSummary = {
  id: string;
  name: string;
  province: string;
  address: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  variant: {
    color: { name: string } | null;
    size: { name: string; label: string | null } | null;
    product: {
      id: string;
      name: string;
      slug: string;
      brand: { name: string };
      media: Array<{ url: string }>;
    };
  };
};

type Order = {
  id: string;
  status: OrderStatus;
  subtotal: string | number;
  shippingCost: string | number;
  total: string | number;
  createdAt: string;
  deliveryType: string | null;
  deliveryAddress: string | null;
  pickPoint: PickPointSummary | null;
  items: OrderItem[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS: Record<OrderStatus, { label: string; textCls: string; dotCls: string }> = {
  pending:    { label: "Pendente",         textCls: "text-brand/40",  dotCls: "bg-brand/25" },
  paid:       { label: "Pago",             textCls: "text-success",   dotCls: "bg-success" },
  in_process: { label: "Em processamento", textCls: "text-primary",   dotCls: "bg-primary" },
  in_transit: { label: "Em trânsito",      textCls: "text-warning",   dotCls: "bg-warning" },
  delivered:  { label: "Entregue",         textCls: "text-success",   dotCls: "bg-success" },
  returned:   { label: "Devolvido",        textCls: "text-danger",    dotCls: "bg-danger" },
  cancelled:  { label: "Cancelado",        textCls: "text-danger/60", dotCls: "bg-danger/40" },
};

function num(v: string | number) {
  return Number(v);
}

function fmtMoney(v: string | number) {
  return num(v).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-MZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Delivery editor (inline) ───────────────────────────────────────────────

function DeliveryEditor({
  order,
  onSaved,
  onCancel,
}: {
  order: Order;
  onSaved: (updated: Partial<Order>) => void;
  onCancel: () => void;
}) {
  const [deliveryType, setDeliveryType] = useState<"pickup" | "home">(
    (order.deliveryType as "pickup" | "home") ?? "pickup",
  );
  const [selectedPp, setSelectedPp] = useState<PickPointSummary | null>(order.pickPoint ?? null);
  const [address, setAddress] = useState(order.deliveryAddress ?? "");
  const [ppSearch, setPpSearch] = useState("");
  const [ppResults, setPpResults] = useState<PickPointSummary[]>([]);
  const [ppLoading, setPpLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePpSearch(val: string) {
    setPpSearch(val);
    setListOpen(true);
    setSelectedPp(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setPpResults([]); setPpLoading(false); return; }
    setPpLoading(true);
    timerRef.current = setTimeout(() => {
      apiFetch<{ items: PickPointSummary[] }>(
        `/pick-points?search=${encodeURIComponent(val.trim())}&limit=30`,
      )
        .then(({ items }) => setPpResults(items))
        .catch(() => setPpResults([]))
        .finally(() => setPpLoading(false));
    }, 350);
  }

  const canSave = deliveryType === "home" ? address.trim().length > 0 : selectedPp !== null;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { deliveryType };
      if (deliveryType === "pickup") body.pickPointId = selectedPp!.id;
      if (deliveryType === "home") body.deliveryAddress = address.trim();
      await authFetch(`/orders/${order.id}/delivery`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved({
        deliveryType,
        deliveryAddress: deliveryType === "home" ? address.trim() : null,
        pickPoint: deliveryType === "pickup" ? selectedPp : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(["pickup", "home"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setDeliveryType(t); setSelectedPp(null); setPpSearch(""); setPpResults([]); }}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium tracking-wide border transition-colors ${
              deliveryType === t ? "bg-brand text-white border-brand" : "border-border text-text-muted hover:border-brand/40"
            }`}
          >
            {t === "pickup" ? <MapPin size={11} /> : <Home size={11} />}
            {t === "pickup" ? "Ponto de recolha" : "Domicílio"}
          </button>
        ))}
      </div>

      {deliveryType === "pickup" && (
        <div className="relative">
          {selectedPp ? (
            <div className="flex items-start gap-2 p-3 border border-brand/20 bg-brand/3">
              <MapPin size={12} className="text-brand shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand">{selectedPp.name}</p>
                <p className="text-[11px] text-text-muted">{selectedPp.province}</p>
              </div>
              <button type="button" onClick={() => { setSelectedPp(null); setPpSearch(""); }} className="text-text-muted hover:text-brand">
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={ppSearch}
                  onChange={(e) => handlePpSearch(e.target.value)}
                  placeholder="Pesquisar ponto..."
                  className="w-full pl-8 pr-7 py-2.5 text-xs border border-border bg-card focus:outline-none focus:border-brand"
                />
                {ppLoading && <Loader2 size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}
              </div>
              {listOpen && ppResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-0.5 bg-card border border-border shadow-md max-h-36 overflow-y-auto">
                  {ppResults.map((pp) => (
                    <button key={pp.id} type="button" onClick={() => { setSelectedPp(pp); setPpSearch(""); setPpResults([]); setListOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-hover border-b border-border-light last:border-0">
                      <p className="text-xs font-medium text-brand">{pp.name}</p>
                      <p className="text-[11px] text-text-muted">{pp.province}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {deliveryType === "home" && (
        <textarea value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="Endereço completo..." rows={2}
          className="w-full text-xs border border-border px-3 py-2.5 bg-card focus:outline-none focus:border-brand resize-none" />
      )}

      {error && <p className="text-[11px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 h-9 border border-border text-xs text-text-muted hover:bg-surface-hover transition-colors">
          Cancelar
        </button>
        <button type="button" disabled={!canSave || saving} onClick={handleSave}
          className="flex-1 h-9 bg-brand text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 hover:bg-primary transition-colors">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Order detail view ──────────────────────────────────────────────────────

function OrderDetail({
  order: initialOrder,
  onBack,
}: {
  order: Order;
  onBack: () => void;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const st = STATUS[order.status] ?? STATUS.pending;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back nav */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase text-text-muted hover:text-brand transition-colors py-5 px-6 shrink-0"
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
        Encomendas
      </button>

      <div className="px-6 pb-10 flex flex-col gap-8">
        {/* Order meta */}
        <div className="flex flex-col gap-2 border-b border-border-light pb-6">
          <p className="text-[11px] tracking-[0.18em] uppercase text-text-muted">
            {fmtDate(order.createdAt)}
          </p>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotCls}`} />
            <span className={`text-[11px] tracking-[0.12em] uppercase font-semibold ${st.textCls}`}>
              {st.label}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-0">
          <p className="text-[10px] tracking-[0.2em] uppercase text-text-muted mb-4">
            Artigos
          </p>
          {order.items.map((item) => {
            const p = item.variant.product;
            const thumb = p.media[0]?.url ?? null;
            const itemSubtotal = num(item.unitPrice) * item.quantity;
            const variant = [
              item.variant.color?.name,
              item.variant.size?.label ?? item.variant.size?.name,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={item.id} className="flex gap-4 py-5 border-b border-border-light/60 last:border-0">
                {/* Image */}
                <Link
                  href={`/produtos/${p.slug}`}
                  onClick={ordersStore.close}
                  className="shrink-0 w-16 h-20 overflow-hidden bg-muted-bg hover:opacity-80 transition-opacity"
                >
                  {thumb ? (
                    <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-border" />
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-brand/60 mb-0.5">
                      {p.brand.name}
                    </p>
                    <Link
                      href={`/produtos/${p.slug}`}
                      onClick={ordersStore.close}
                      className="text-sm font-medium text-brand leading-snug line-clamp-2 hover:text-primary transition-colors"
                    >
                      {p.name}
                    </Link>
                    {variant && (
                      <p className="text-[11px] text-text-muted mt-1">{variant}</p>
                    )}
                  </div>

                  {/* Price row */}
                  <div className="flex items-end justify-between mt-3">
                    <span className="text-[11px] text-text-muted">
                      {fmtMoney(item.unitPrice)} × {item.quantity}
                    </span>
                    <span className="text-sm font-semibold text-brand">
                      {fmtMoney(itemSubtotal)} MZN
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Price summary */}
        <div className="flex flex-col gap-0 border-t border-border-light pt-5">
          <div className="flex justify-between items-center py-2.5">
            <span className="text-[11px] tracking-[0.1em] uppercase text-text-muted">Subtotal</span>
            <span className="text-sm font-medium text-brand">{fmtMoney(order.subtotal)} MZN</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-border-light/60">
            <span className="text-[11px] tracking-[0.1em] uppercase text-text-muted">Entrega</span>
            <span className="text-sm font-medium text-brand">
              {num(order.shippingCost) === 0 ? "—" : `${fmtMoney(order.shippingCost)} MZN`}
            </span>
          </div>
          <div className="flex justify-between items-center pt-3.5 pb-1">
            <span className="text-[11px] tracking-[0.18em] uppercase font-bold text-brand">Total</span>
            <span className="text-base font-bold text-brand">{fmtMoney(order.total)} MZN</span>
          </div>
        </div>

        {/* Delivery method */}
        {order.deliveryType && (
          <div className="flex flex-col gap-3 border-t border-border-light pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.2em] uppercase text-text-muted">Entrega</p>
              {order.status === "pending" && !editingDelivery && (
                <button
                  type="button"
                  onClick={() => setEditingDelivery(true)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Pencil size={10} /> Editar
                </button>
              )}
            </div>

            {editingDelivery ? (
              <DeliveryEditor
                order={order}
                onSaved={(u) => { setOrder((o) => ({ ...o, ...u })); setEditingDelivery(false); }}
                onCancel={() => setEditingDelivery(false)}
              />
            ) : order.deliveryType === "pickup" && order.pickPoint ? (
              <div className="flex items-start gap-2.5">
                <MapPin size={13} className="text-text-muted shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-brand">{order.pickPoint.name}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{order.pickPoint.province}</p>
                  <p className="text-[11px] text-text-muted">{order.pickPoint.address}</p>
                </div>
              </div>
            ) : order.deliveryType === "home" ? (
              <div className="flex items-start gap-2.5">
                <Home size={13} className="text-text-muted shrink-0 mt-0.5" />
                <p className="text-sm text-brand leading-snug">
                  {order.deliveryAddress ?? "Entrega ao domicílio"}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order list row ─────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const st = STATUS[order.status] ?? STATUS.pending;
  const itemCount = order.items.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center justify-between py-5 border-b border-border-light/60 group hover:bg-surface-hover/30 transition-colors -mx-6 px-6"
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] tracking-[0.12em] uppercase text-text-muted">
          {fmtDate(order.createdAt)}
        </p>
        <p className="text-sm font-semibold text-brand">
          {fmtMoney(order.total)} MZN
        </p>
        <p className="text-[11px] text-text-muted">
          {itemCount} {itemCount === 1 ? "artigo" : "artigos"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotCls}`} />
          <span className={`text-[10px] tracking-[0.1em] uppercase font-semibold ${st.textCls}`}>
            {st.label}
          </span>
        </div>
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className="text-brand/25 group-hover:text-brand/50 transition-colors"
        />
      </div>
    </button>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────

export function OrdersDrawer() {
  const isOpen = useOrdersDrawer();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    authFetch<{ items: Order[] }>("/orders?limit=50")
      .then(({ items }) => setOrders(items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  useEffect(() => {
    if (!user) { setOrders(null); setSelected(null); setShowDetail(false); }
  }, [user]);

  // Reset detail view when drawer closes
  useEffect(() => {
    if (!isOpen) { setSelected(null); setShowDetail(false); }
  }, [isOpen]);

  function openDetail(order: Order) {
    setSelected(order);
    // tiny timeout so the element renders before the transition fires
    requestAnimationFrame(() => setShowDetail(true));
  }

  function closeDetail() {
    setShowDetail(false);
    setTimeout(() => setSelected(null), 300);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={ordersStore.close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compras realizadas"
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[540px] bg-white flex flex-col transition-transform duration-300 ease-out overflow-hidden ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header — shown only on list view */}
        <div
          className={`shrink-0 flex items-center justify-between px-6 pt-8 pb-4 border-b border-border-light transition-all duration-300 ${
            showDetail ? "opacity-0 pointer-events-none h-0 overflow-hidden py-0 pt-0 pb-0 border-0" : "opacity-100"
          }`}
        >
          <h2 className="text-[11px] tracking-[0.25em] uppercase font-semibold text-brand">
            Compras realizadas
          </h2>
          <button
            type="button"
            onClick={ordersStore.close}
            aria-label="Fechar"
            className="text-brand hover:opacity-50 transition-opacity"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Sliding panels container */}
        <div className="flex-1 relative overflow-hidden">
          {/* ── List panel ── */}
          <div
            className={`absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out px-6 py-2`}
            style={{ transform: showDetail ? "translateX(-30%)" : "translateX(0)" }}
          >
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center h-40">
                <span className="w-5 h-5 rounded-full border border-brand/20 border-t-brand animate-spin" />
              </div>
            )}

            {/* Not logged in */}
            {!loading && !user && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 pt-10">
                <p className="text-sm text-text-muted text-center">
                  Inicia sessão para ver as tuas compras.
                </p>
                <button
                  type="button"
                  onClick={() => { ordersStore.close(); loginStore.open(); }}
                  className="text-[11px] tracking-[0.15em] uppercase font-semibold text-primary hover:underline"
                >
                  Entrar
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && user && orders?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 pt-10">
                <Package size={24} strokeWidth={1} className="text-border" />
                <p className="text-sm text-text-muted text-center">
                  Ainda não realizaste nenhuma compra.
                </p>
              </div>
            )}

            {/* Order list */}
            {!loading && orders && orders.length > 0 &&
              orders.map((order) => (
                <OrderRow key={order.id} order={order} onClick={() => openDetail(order)} />
              ))
            }
          </div>

          {/* ── Detail panel ── */}
          {selected && (
            <div
              className="absolute inset-0 bg-white transition-transform duration-300 ease-in-out"
              style={{ transform: showDetail ? "translateX(0)" : "translateX(100%)" }}
            >
              {/* Close button — top right of detail */}
              <button
                type="button"
                onClick={ordersStore.close}
                aria-label="Fechar"
                className="absolute top-5 right-6 z-10 text-brand hover:opacity-50 transition-opacity"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
              <OrderDetail order={selected} onBack={closeDetail} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
