"use client";

import Image from "next/image";
import {
  X,
  Mail,
  Phone,
  MessageCircle,
  ShoppingBag,
  Calendar,
  Cake,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useClientDetail } from "@/lib/hooks/useClients";
import { formatDate, formatPrice } from "@/lib/format";

/* ── Avatar ─────────────────────────────────────────────────────────────── */

export function AvatarCircle({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "w-8 h-8 text-xxs"
      : size === "lg"
        ? "w-12 h-12 text-md"
        : "w-10 h-10 text-s";

  const dimMap = { sm: 32, md: 40, lg: 48 };
  const dim = dimMap[size];

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={dim}
        height={dim}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
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
    <div
      className={`${sizeClass} rounded-full bg-navy text-white font-bold font-lato flex items-center justify-center shrink-0`}
    >
      {initials}
    </div>
  );
}

/* ── Panel row ────────────────────────────────────────────────────────────── */

export function PanelRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-light last:border-b-0">
      <div className="w-7 h-7 rounded-md bg-surface-hover flex items-center justify-center text-text-muted shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-2xs text-text-subtle font-figtree uppercase tracking-wide">
          {label}
        </span>
        <span className="text-s text-text-dark font-medium font-figtree break-all">
          {value ?? <span className="text-text-subtle">—</span>}
        </span>
      </div>
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

interface ClientDetailPanelProps {
  clientId: string;
  onClose: () => void;
  /** When provided (from orders list), shows a "Ver detalhes da encomenda" link */
  orderId?: string;
}

export default function ClientDetailPanel({
  clientId,
  onClose,
  orderId,
}: ClientDetailPanelProps) {
  const { data, isLoading } = useClientDetail(clientId);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom-sheet on mobile, side panel on md+ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl overflow-hidden shadow-2xl md:static md:w-68 md:max-h-none md:rounded-none md:shadow-none md:shrink-0 bg-card border-t border-border-light md:border-t-0 md:border-l flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
          <span className="text-s font-bold text-text-dark font-lato">
            Detalhes do cliente
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-9 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col overflow-y-auto flex-1">
              {/* Avatar + name + badge */}
              <div className="flex flex-col items-center gap-2 px-4 py-5 border-b border-border-light">
                <AvatarCircle name={data.name} avatarUrl={data.avatarUrl} />
                <span className="text-md font-bold text-text-dark font-lato text-center">
                  {data.name}
                </span>
                <span
                  className={`text-xxs font-semibold font-inter px-2.5 py-0.5 rounded-full ${
                    data.paidOrders > 0
                      ? "bg-success/10 text-success"
                      : "bg-surface-hover text-text-muted"
                  }`}
                >
                  {data.paidOrders > 0 ? "Comprador" : "Visitante com conta"}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 divide-x divide-border-light border-b border-border-light">
                <div className="flex flex-col items-center py-4 gap-0.5">
                  <span className="text-[22px] font-bold text-primary font-lato leading-none">
                    {data.paidOrders}
                  </span>
                  <span className="text-xxs text-text-subtle font-figtree">
                    Encomendas
                  </span>
                </div>
                <div className="flex flex-col items-center py-4 gap-0.5 px-2 text-center">
                  <span className="text-[18px] font-bold text-primary font-lato leading-none">
                    {formatPrice(data.totalSpent)}
                  </span>
                  <span className="text-xxs text-text-subtle font-figtree">
                    MZN gastos
                  </span>
                </div>
              </div>

              {/* Pending orders hint */}
              {data.pendingOrders > 0 && (
                <div className="px-4 py-2 border-b border-border-light flex items-center gap-1.5">
                  <span className="text-2xs text-text-subtle font-figtree">
                    +{data.pendingOrders} encomenda
                    {data.pendingOrders !== 1 ? "s" : ""} em aberto
                    {data.pendingOrdersAmount > 0 && (
                      <>
                        {" "}
                        &mdash; {formatPrice(data.pendingOrdersAmount)} MZN por
                        confirmar
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Contact + info rows */}
              <div className="px-4">
                <PanelRow
                  icon={<Mail size={14} />}
                  label="Email"
                  value={data.email}
                />
                <PanelRow
                  icon={<Phone size={14} />}
                  label="Telefone"
                  value={data.phone}
                />
                <PanelRow
                  icon={<MessageCircle size={14} />}
                  label="WhatsApp"
                  value={data.whatsappNumber}
                />
                <PanelRow
                  icon={<Cake size={14} />}
                  label="Data de nascimento"
                  value={data.birthDate ? formatDate(data.birthDate) : null}
                />
                <PanelRow
                  icon={<Calendar size={14} />}
                  label="Membro desde"
                  value={formatDate(data.createdAt)}
                />
                <PanelRow
                  icon={<ShoppingBag size={14} />}
                  label="Última compra"
                  value={
                    data.lastPurchaseAt ? formatDate(data.lastPurchaseAt) : null
                  }
                />
              </div>
            </div>

            {/* "Ver encomenda" — pinned footer, always visible */}
            {orderId && (
              <div className="px-4 py-3 border-t border-border-light shrink-0">
                <Link
                  href={`/orders/${orderId}`}
                  className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-accent text-accent text-s font-lato font-medium hover:bg-accent/5 transition-colors"
                >
                  <ClipboardList size={15} />
                  Ver detalhes da encomenda
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
