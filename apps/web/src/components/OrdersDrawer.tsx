"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Package } from "lucide-react";
import { useOrdersDrawer, ordersStore } from "@/lib/stores/ordersStore";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loginStore } from "@/lib/stores/loginStore";
import { DrawerPanel, DrawerItemRow } from "./DrawerPanel";

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending:    { label: "Pendente",          cls: "bg-border/40 text-brand/50" },
  paid:       { label: "Pago",              cls: "bg-success/10 text-success" },
  in_process: { label: "Em processamento",  cls: "bg-primary/10 text-primary" },
  in_transit: { label: "Em trânsito",       cls: "bg-warning/10 text-warning" },
  delivered:  { label: "Entregue",          cls: "bg-success/10 text-success" },
  returned:   { label: "Devolvido",         cls: "bg-danger/10 text-danger" },
  cancelled:  { label: "Cancelado",         cls: "bg-border/40 text-brand/40" },
};

function fmtPrice(v: string | number) {
  return (
    "MZN " +
    new Intl.NumberFormat("pt-MZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v))
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-MZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Order accordion ────────────────────────────────────────────────────────

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
    <div className="border-b border-border-light last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-brand whitespace-nowrap">
            {fmtDate(order.createdAt)}
          </span>
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-brand">{fmtPrice(order.total)}</span>
          <ChevronDown
            size={15}
            strokeWidth={1.5}
            className={`text-brand/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? "max-h-[2000px] pb-3" : "max-h-0"
        }`}
      >
        {order.items.map((item) => {
          const p = item.variant.product;
          return (
            <DrawerItemRow
              key={item.id}
              imageUrl={p.media[0]?.url}
              imageHref={`/produtos/${p.slug}`}
              onImageClick={ordersStore.close}
              name={p.name}
              nameHref={`/produtos/${p.slug}`}
              onNameClick={ordersStore.close}
              price={fmtPrice(item.unitPrice)}
              meta={[
                p.brand.name,
                item.variant.color?.name,
                item.variant.size?.label ?? item.variant.size?.name,
                `× ${item.quantity}`,
              ]}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────

export function OrdersDrawer() {
  const isOpen = useOrdersDrawer();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user || orders !== null) return;
    setLoading(true);
    authFetch<{ items: Order[] }>("/orders?limit=50")
      .then(({ items }) => setOrders(items.filter((o) => o.status !== "pending")))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isOpen, user, orders]);

  useEffect(() => {
    if (!user) {
      setOrders(null);
      setExpandedId(null);
    }
  }, [user]);

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={ordersStore.close}
      title="Compras realizadas"
      ariaLabel="Compras realizadas"
      maxWidth="max-w-[580px]"
    >
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <span className="w-6 h-6 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
        </div>
      )}

      {/* Not logged in */}
      {!loading && !user && (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <p className="text-sm text-text-muted text-center">
            Inicia sessão para ver as tuas compras.
          </p>
          <button
            type="button"
            onClick={() => { ordersStore.close(); loginStore.open(); }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Entrar
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && user && orders?.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Package size={28} className="text-border" />
          <p className="text-sm text-text-muted text-center">
            Ainda não realizaste nenhuma compra.
          </p>
        </div>
      )}

      {/* Orders */}
      {!loading && orders && orders.length > 0 &&
        orders.map((order) => (
          <OrderAccordion
            key={order.id}
            order={order}
            expanded={expandedId === order.id}
            onToggle={() => setExpandedId((p) => (p === order.id ? null : order.id))}
          />
        ))
      }
    </DrawerPanel>
  );
}
