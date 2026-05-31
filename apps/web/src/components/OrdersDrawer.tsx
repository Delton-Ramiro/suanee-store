"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { useOrdersDrawer, ordersStore } from "@/lib/stores/ordersStore";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────

type OrderStatus =
  | "pending"
  | "paid"
  | "in_process"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  variant: {
    color: { name: string } | null;
    size: { name: string; label: string } | null;
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
  total: string | number;
  createdAt: string;
  items: OrderItem[];
};

// ── Helpers ────────────────────────────────────────────────────────

const STATUS: Record<
  OrderStatus,
  { label: string; cls: string }
> = {
  pending:    { label: "Pendente",           cls: "bg-gray-100 text-gray-500" },
  paid:       { label: "Pago",               cls: "bg-green-100 text-green-700" },
  in_process: { label: "Em processamento",   cls: "bg-blue-100 text-blue-700" },
  in_transit: { label: "Em trânsito",        cls: "bg-amber-100 text-amber-700" },
  delivered:  { label: "Entregue",           cls: "bg-success/15 text-success" },
  returned:   { label: "Devolvido",          cls: "bg-danger/10 text-danger" },
  cancelled:  { label: "Cancelado",          cls: "bg-gray-100 text-gray-400" },
};

function fmt(v: string | number) {
  return (
    new Intl.NumberFormat("pt-MZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v)) + " MZN"
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-MZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Order accordion item ───────────────────────────────────────────

function OrderRow({ item }: { item: OrderItem }) {
  const p = item.variant.product;
  return (
    <div className="flex gap-[10px] items-start">
      {/* Thumbnail */}
      <div className="w-[100px] h-[150px] shrink-0 overflow-hidden bg-bg">
        {p.media[0] ? (
          <img
            src={p.media[0].url}
            alt={p.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={24} className="text-border" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 pt-[10px]">
        <div className="flex items-start justify-between gap-2 mb-[10px]">
          <Link
            href={`/produtos/${p.slug}`}
            onClick={ordersStore.close}
            className="text-[15px] font-light text-black hover:text-primary transition-colors leading-snug line-clamp-2"
          >
            {p.name}
          </Link>
          <span className="text-[16px] font-bold text-text-muted shrink-0">
            {fmt(item.unitPrice)}
          </span>
        </div>

        <div className="flex flex-col gap-[5px] text-[15px] text-black">
          {item.variant.product.brand.name && (
            <p>
              <span className="font-bold">Marca</span>:{" "}
              <span className="font-normal">{item.variant.product.brand.name}</span>
            </p>
          )}
          {item.variant.color && (
            <p>
              <span className="font-bold">Cor</span>:{" "}
              <span className="font-normal">{item.variant.color.name}</span>
            </p>
          )}
          {item.variant.size && (
            <p>
              <span className="font-bold">Tamanho</span>:{" "}
              <span className="font-normal">
                {item.variant.size.label ?? item.variant.size.name}
              </span>
            </p>
          )}
        </div>

        <p className="mt-[12px] text-[13px] text-text-muted">
          Quantidade: {item.quantity}
        </p>
      </div>
    </div>
  );
}

function OrderAccordion({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const st = STATUS[order.status] ?? STATUS.pending;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 pb-3 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[16px] font-bold text-black whitespace-nowrap">
            {fmtDate(order.createdAt)}
          </span>
          <span
            className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}
          >
            {st.label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[16px] font-bold text-black">
            {fmt(order.total)}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={1.5}
            className={`text-text-muted transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? "max-h-[2000px] pb-5" : "max-h-0"
        }`}
      >
        <div className="flex flex-col gap-[5px]">
          {order.items.map((item) => (
            <OrderRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────

export function OrdersDrawer() {
  const isOpen = useOrdersDrawer();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lazy fetch — only when drawer opens for the first time after login
  useEffect(() => {
    if (!isOpen || !user || orders !== null) return;
    setLoading(true);
    authFetch<{ items: Order[] }>("/orders?limit=50")
      .then(({ items }) =>
        setOrders(items.filter((o) => o.status !== "pending")),
      )
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isOpen, user, orders]);

  // Reset cached orders when user logs out
  useEffect(() => {
    if (!user) {
      setOrders(null);
      setExpandedId(null);
    }
  }, [user]);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={ordersStore.close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Compras realizadas"
        aria-modal="true"
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[583px] bg-white flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[51px] pt-[52px] pb-0 shrink-0">
          <h2 className="text-h4 font-medium text-black">
            Compras realizadas
          </h2>
          <button
            type="button"
            onClick={ordersStore.close}
            aria-label="Fechar"
            className="text-black hover:opacity-60 transition-opacity"
          >
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[36px] pt-[22px] pb-8">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-40">
              <span className="w-7 h-7 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
            </div>
          )}

          {/* Not logged in */}
          {!loading && !user && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <p className="text-sm text-text-muted text-center">
                Inicia sessão para ver as tuas compras.
              </p>
              <Link
                href="/login"
                onClick={ordersStore.close}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Entrar
              </Link>
            </div>
          )}

          {/* Empty */}
          {!loading && user && orders?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Package size={32} className="text-border" />
              <p className="text-sm text-text-muted text-center">
                Ainda não realizaste nenhuma compra.
              </p>
            </div>
          )}

          {/* Orders list */}
          {!loading && orders && orders.length > 0 && (
            <div className="flex flex-col gap-[22px]">
              {orders.map((order) => (
                <OrderAccordion
                  key={order.id}
                  order={order}
                  expanded={expandedId === order.id}
                  onToggle={() => toggle(order.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
