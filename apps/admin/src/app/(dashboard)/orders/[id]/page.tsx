"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  CreditCard,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  ImagePlus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOrderDetail,
  type OrderDetail,
  type OrderStatus,
} from "@/lib/hooks/useOrders";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice, shortId } from "@/lib/format";
import { PanelRow } from "@/components/ClientDetailPanel";
import { useAuth } from "@/lib/auth";
import {
  canEditPendingOrderDetails,
  resolveAdminRoleKey,
  canTransitionOrderToStatus,
  canViewOrders,
} from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Valid transitions (mirrors routes.ts) ────────────────────────────────── */

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["in_process", "cancelled"],
  in_process: ["in_transit", "cancelled"],
  in_transit: ["delivered", "returned"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

/* ── Status config ────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: React.ReactNode; className: string; bg: string }
> = {
  pending: {
    label: "Pendente",
    icon: <Clock size={14} strokeWidth={2} />,
    className: "text-warning",
    bg: "bg-warning/10",
  },
  paid: {
    label: "Pago",
    icon: <CreditCard size={14} strokeWidth={2} />,
    className: "text-success",
    bg: "bg-success/10",
  },
  in_process: {
    label: "Em processo",
    icon: <Package size={14} strokeWidth={2} />,
    className: "text-accent",
    bg: "bg-accent/10",
  },
  in_transit: {
    label: "Em trânsito",
    icon: <Truck size={14} strokeWidth={2} />,
    className: "text-navy",
    bg: "bg-navy/10",
  },
  delivered: {
    label: "Entregue",
    icon: <CheckCircle size={14} strokeWidth={2} />,
    className: "text-success",
    bg: "bg-success/10",
  },
  returned: {
    label: "Devolvido",
    icon: <RotateCcw size={14} strokeWidth={2} />,
    className: "text-danger",
    bg: "bg-danger/10",
  },
  cancelled: {
    label: "Cancelado",
    icon: <XCircle size={14} strokeWidth={2} />,
    className: "text-danger",
    bg: "bg-danger/10",
  },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  in_process: "Em processo",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  returned: "Devolvido",
  cancelled: "Cancelado",
};

/* ── Status select — ApiSearchSelect-style, no search ───────────────────── */

function StatusSelect({
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 h-12 rounded-xl border border-border bg-card text-[14px] font-figtree focus:outline-none focus:border-accent transition-colors"
      >
        <span className={selected ? "text-text-dark" : "text-text-label"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-[14px] font-figtree hover:bg-surface-hover transition-colors ${
                  opt.value === value
                    ? "bg-navy/5 text-navy font-semibold"
                    : "text-text-dark"
                }`}
              >
                <span
                  className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-full border transition-colors ${
                    opt.value === value
                      ? "bg-navy border-navy"
                      : "border-border"
                  }`}
                >
                  {opt.value === value && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <circle cx="4" cy="4" r="2.5" fill="white" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

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
        width={48}
        height={48}
        className="w-12 h-12 rounded-full object-cover shrink-0"
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
    <div className="w-12 h-12 rounded-full bg-navy text-white text-sm font-bold font-lato flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

/* ── Multi-image upload (up to N slots) ────────────────────────────────────── */

function MultiImageUpload({
  urls,
  onChange,
  max = 3,
  context = "order",
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  context?: string;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  async function handleFile(file: File, idx: number) {
    setUploading(idx);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { publicUrl } = await apiFetch<{ publicUrl: string }>(
        "/admin/media/upload",
        {
          method: "POST",
          body: JSON.stringify({
            context,
            filename: file.name,
            contentType: file.type,
            data: base64,
          }),
        },
      );
      const next = [...urls];
      next[idx] = publicUrl;
      onChange(next);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar imagem",
      );
    } finally {
      setUploading(null);
    }
  }

  const slots = Array.from({ length: max });

  return (
    <div className="flex gap-2 flex-wrap">
      {slots.map((_, idx) => {
        const url = urls[idx] ?? null;
        const isUploading = uploading === idx;
        return (
          <div
            key={idx}
            className="relative w-24 h-24 rounded-lg overflow-hidden border border-border-light bg-bg group"
          >
            {url ? (
              <Image
                fill
                src={url}
                alt={`Prova ${idx + 1}`}
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-label">
                <ImagePlus size={22} />
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {!isUploading && (
              <button
                type="button"
                onClick={() => inputRefs.current[idx]?.click()}
                className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 bg-black/30 flex items-center justify-center transition-opacity"
              >
                <ImagePlus size={18} className="text-white" />
              </button>
            )}
            {!isUploading && url && (
              <button
                type="button"
                onClick={() => {
                  const next = [...urls];
                  next.splice(idx, 1);
                  onChange(next);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-danger flex items-center justify-center text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XCircle size={12} />
              </button>
            )}
            <input
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, idx);
                e.target.value = "";
              }}
              disabled={isUploading}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── Status change modal ──────────────────────────────────────────────────── */

type StatusModalProps = {
  currentStatus: OrderStatus;
  targetStatus: OrderStatus;
  onConfirm: (data: {
    proofNotes?: string;
    returnReason?: string;
    returnProof?: string[];
    cancellationReason?: string;
  }) => Promise<void>;
  onCancel: () => void;
};

function StatusChangeModal({
  currentStatus,
  targetStatus,
  onConfirm,
  onCancel,
}: StatusModalProps) {
  const [proofNotes, setProofNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnProofUrls, setReturnProofUrls] = useState<string[]>([]);
  const [cancellationReason, setCancellationReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const needsProof = targetStatus === "paid";
  const needsReturn = targetStatus === "returned";
  const needsCancel = targetStatus === "cancelled";

  const isValid =
    confirmText.trim().toLowerCase() === "confirmo" &&
    (needsProof ? proofNotes.trim().length > 0 : true) &&
    (needsReturn ? returnReason.trim().length > 0 : true) &&
    (needsCancel ? cancellationReason.trim().length > 0 : true);

  async function handleSubmit() {
    if (!isValid) return;
    setSaving(true);
    try {
      await onConfirm({
        proofNotes: needsProof ? proofNotes : undefined,
        returnReason: needsReturn ? returnReason : undefined,
        returnProof:
          needsReturn && returnProofUrls.length > 0
            ? returnProofUrls
            : undefined,
        cancellationReason: needsCancel ? cancellationReason : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md flex flex-col gap-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light">
          <p className="text-md font-bold text-text-dark font-lato">
            Atualizar estado
          </p>
          <p className="text-s text-text-muted font-figtree mt-0.5">
            {STATUS_LABELS[currentStatus]} →{" "}
            <span className={STATUS_CONFIG[targetStatus].className}>
              {STATUS_LABELS[targetStatus]}
            </span>
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* paid: proof notes */}
          {needsProof && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-text-dark font-lato uppercase tracking-wide">
                Notas de pagamento <span className="text-danger">*</span>
              </label>
              <textarea
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Pagamento confirmado via M-Pesa #12345"
                className="w-full rounded-lg border border-border px-3 py-2 text-s font-figtree text-text-dark bg-bg outline-none focus:border-accent resize-none"
              />
            </div>
          )}

          {/* returned: reason + proof images */}
          {needsReturn && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-text-dark font-lato uppercase tracking-wide">
                  Motivo da devolução <span className="text-danger">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo da devolução"
                  className="w-full rounded-lg border border-border px-3 py-2 text-s font-figtree text-text-dark bg-bg outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-text-dark font-lato uppercase tracking-wide">
                  Prova de devolução (até 3 imagens)
                </label>
                <MultiImageUpload
                  urls={returnProofUrls}
                  onChange={setReturnProofUrls}
                  max={3}
                  context="order-return"
                />
              </div>
            </>
          )}

          {/* cancelled: cancellation reason */}
          {needsCancel && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-text-dark font-lato uppercase tracking-wide">
                Motivo do cancelamento <span className="text-danger">*</span>
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo do cancelamento"
                className="w-full rounded-lg border border-border px-3 py-2 text-s font-figtree text-text-dark bg-bg outline-none focus:border-accent resize-none"
              />
            </div>
          )}

          {/* Confirm gate */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border-light">
            <label className="text-[12px] font-semibold text-text-dark font-lato uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-warning" />
              Escreva "Confirmo" para continuar
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Confirmo"
              className="w-full rounded-lg border border-border px-3 py-2 text-s font-figtree text-text-dark bg-bg outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Footer */}

        <div className="px-5 py-4 border-t border-border-light flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-9 px-4 rounded-lg border border-border text-s font-lato text-text-dark hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="h-9 px-5 rounded-lg bg-navy text-white text-s font-lato font-semibold disabled:opacity-40 hover:bg-primary transition-colors"
          >
            {saving ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Inline item-row edit/delete ──────────────────────────────────────────── */

type ItemRow = OrderDetail["items"][number];

function ProductRow({
  item,
  canEdit,
  orderId,
  onMutated,
}: {
  item: ItemRow;
  canEdit: boolean;
  orderId: string;
  onMutated: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [editQty, setEditQty] = useState(String(item.quantity));
  const [saving, setSaving] = useState(false);

  const thumbUrl = item.product.media[0]?.url ?? null;

  async function saveEdit() {
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/orders/${orderId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: qty }),
      });
      toast.success("Item atualizado");
      onMutated();
      setMode("view");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    try {
      await apiFetch(`/admin/orders/${orderId}/items/${item.id}`, {
        method: "DELETE",
      });
      toast.success("Item removido");
      onMutated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
      setSaving(false);
      setMode("view");
    }
  }

  return (
    <tr className="border-b border-border-light last:border-b-0">
      {/* Nr */}
      <td className="px-4 py-3">
        <span className="text-s font-inter text-text-muted">
          {shortId(item.id)}…
        </span>
      </td>
      {/* Product */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {thumbUrl ? (
            <Image
              src={thumbUrl}
              alt={item.product.name}
              width={36}
              height={36}
              className="w-9 h-9 rounded border border-border-light object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded border border-border-light bg-surface-hover shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-s text-text-dark font-lato truncate max-w-44">
              {item.product.name}
            </span>
            <span className="text-xxs text-text-muted font-figtree flex items-center gap-1">
              {item.variant.color && (
                <span
                  className="inline-block w-3 h-3 rounded-full border border-black/10 shrink-0"
                  style={{ background: item.variant.color.hexCode }}
                />
              )}
              {[item.variant.color?.name, item.variant.size?.name]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
          </div>
        </div>
      </td>
      {/* Unit price */}
      <td className="px-4 py-3">
        <span className="font-inter text-s text-text-dark">
          {formatPrice(item.unitPrice)}
        </span>
      </td>
      {/* Quantity */}
      <td className="px-4 py-3">
        {mode === "edit" ? (
          <input
            type="number"
            min={0}
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            className="w-16 rounded border border-border px-2 py-1 text-s font-inter text-text-dark bg-bg outline-none focus:border-accent"
          />
        ) : (
          <span className="font-inter text-s text-text-body">
            {item.quantity}
          </span>
        )}
      </td>

      {/* Action — only when canEdit */}
      {canEdit && (
        <td className="px-4 py-3">
          {mode === "view" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditQty(String(item.quantity));
                  setMode("edit");
                }}
                className="text-[12px] text-accent font-lato font-medium hover:underline flex items-center gap-1"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                onClick={() => setMode("delete")}
                className="text-[12px] text-danger font-lato font-medium hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} /> Remover
              </button>
            </div>
          )}

          {mode === "edit" && (
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-[12px] text-success font-lato font-semibold hover:underline disabled:opacity-50"
              >
                {saving ? "…" : "Guardar"}
              </button>
              <button
                onClick={() => setMode("view")}
                disabled={saving}
                className="text-[12px] text-text-muted font-lato hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}

          {mode === "delete" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-danger font-figtree">
                Remover?
              </span>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="text-[12px] text-danger font-lato font-semibold hover:underline disabled:opacity-50"
              >
                {saving ? "…" : "Sim"}
              </button>
              <button
                onClick={() => setMode("view")}
                disabled={saving}
                className="text-[12px] text-text-muted font-lato hover:underline"
              >
                Não
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const allowOrderView = canViewOrders(user);
  const roleKey = resolveAdminRoleKey(user);
  const showStatusTransitionUi = roleKey !== "customer_care";
  const showEditDeliveryPrice = roleKey !== "customer_care";

  const { data: order, isLoading } = useOrderDetail(id, {
    enabled: allowOrderView,
  });

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | "">("");
  const [showModal, setShowModal] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingInput, setShippingInput] = useState("");
  const [savingShipping, setSavingShipping] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function applyStatusChange(extra: {
    proofNotes?: string;
    returnReason?: string;
    returnProof?: string[];
    cancellationReason?: string;
  }) {
    if (!pendingStatus) return;
    await apiFetch(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: pendingStatus, ...extra }),
    });
    toast.success("Estado atualizado");
    setShowModal(false);
    setPendingStatus("");
    invalidate();
  }

  function handleApply() {
    if (!pendingStatus || !order) return;
    const needsModal =
      pendingStatus === "paid" ||
      pendingStatus === "returned" ||
      pendingStatus === "cancelled";
    if (needsModal) {
      setShowModal(true);
    } else {
      applyStatusChange({}).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Erro");
      });
    }
  }

  async function saveShipping() {
    const cost = parseFloat(shippingInput);
    if (isNaN(cost) || cost < 0) return;
    setSavingShipping(true);
    try {
      await apiFetch(`/admin/orders/${id}/shipping`, {
        method: "PATCH",
        body: JSON.stringify({ shippingCost: cost }),
      });
      toast.success("Custo de envio atualizado");
      setEditingShipping(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSavingShipping(false);
    }
  }

  /* ── Skeleton ── */
  if (!allowOrderView) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às encomendas." />
    );
  }

  if (isLoading || !order) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-8 w-60 rounded-lg" />
        <div className="skeleton h-96 w-full rounded-lg" />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status];
  const nextOptions = (VALID_TRANSITIONS[order.status] ?? []).filter((status) =>
    canTransitionOrderToStatus(user, status),
  );
  const canEdit =
    order.status === "pending" && canEditPendingOrderDetails(user);

  /* Parse returnProof URLs */
  let returnProofUrls: string[] = [];
  if (order.returnProof) {
    try {
      returnProofUrls = JSON.parse(order.returnProof) as string[];
    } catch {
      returnProofUrls = [order.returnProof];
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-s text-text-muted font-figtree hover:text-text-dark transition-colors"
          >
            <ArrowLeft size={15} />
            Encomendas
          </button>
          <span className="text-text-label text-s">/</span>
          <span className="text-s text-text-dark font-figtree">{order.id}</span>
        </div>

        {/* Title + status badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-bold text-text-dark font-lato">
            Detalhes da encomenda {shortId(order.id)}
          </h1>
          <span
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-s font-semibold font-lato ${cfg.className} ${cfg.bg}`}
          >
            {cfg.icon}
            {cfg.label}
          </span>
        </div>

        {/* Products table card */}
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light">
            <p className="text-md font-bold text-text-dark font-lato">
              Produtos
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="bg-navy">
                  <th className="px-4 py-3 first:rounded-l-md text-left text-s font-medium text-white font-figtree w-28">
                    Nr. produto
                  </th>
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree">
                    Produto
                  </th>
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree w-32">
                    Preço unitário
                  </th>
                  <th className="px-4 py-3 text-left text-s font-medium text-white font-figtree w-24">
                    Unidades
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 last:rounded-r-md text-left text-s font-medium text-white font-figtree w-32">
                      Ação
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    orderId={order.id}
                    onMutated={invalidate}
                  />
                ))}
                {order.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={canEdit ? 5 : 4}
                      className="px-4 py-8 text-center text-text-muted text-sm"
                    >
                      Nenhum produto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes / proof section — shown when any field has a value */}
        {(order.proofNotes ||
          order.returnReason ||
          order.cancellationReason ||
          returnProofUrls.length > 0) && (
          <div className="bg-card rounded-lg shadow-card px-5 py-4 flex flex-col gap-4">
            <p className="text-md font-bold text-text-dark font-lato">
              Informação adicional
            </p>

            {order.proofNotes && (
              <div className="flex flex-col gap-1">
                <span className="text-xxs font-semibold text-text-subtle font-figtree uppercase tracking-wide">
                  Notas de pagamento
                </span>
                <p className="text-s text-text-dark font-figtree leading-relaxed bg-bg rounded-lg px-3 py-2 border border-border-light">
                  {order.proofNotes}
                </p>
              </div>
            )}

            {order.returnReason && (
              <div className="flex flex-col gap-1">
                <span className="text-xxs font-semibold text-text-subtle font-figtree uppercase tracking-wide">
                  Motivo da devolução
                </span>
                <p className="text-s text-text-dark font-figtree leading-relaxed bg-bg rounded-lg px-3 py-2 border border-border-light">
                  {order.returnReason}
                </p>
              </div>
            )}

            {returnProofUrls.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xxs font-semibold text-text-subtle font-figtree uppercase tracking-wide">
                  Prova de devolução
                </span>
                <div className="flex gap-2 flex-wrap">
                  {returnProofUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image
                        src={url}
                        alt={`Prova ${i + 1}`}
                        width={80}
                        height={80}
                        className="w-20 h-20 object-cover rounded-lg border border-border-light hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {order.cancellationReason && (
              <div className="flex flex-col gap-1">
                <span className="text-xxs font-semibold text-text-subtle font-figtree uppercase tracking-wide">
                  Motivo do cancelamento
                </span>
                <p className="text-s text-text-dark font-figtree leading-relaxed bg-bg rounded-lg px-3 py-2 border border-border-light">
                  {order.cancellationReason}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right sidebar ──────────────────────────────────────────────── */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
        {/* Client card */}
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-light">
            <p className="text-s font-bold text-text-dark font-lato">Cliente</p>
          </div>
          <div className="flex flex-col">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border-light">
              <AvatarCircle
                name={order.user.name}
                avatarUrl={order.user.avatarUrl}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-text-dark font-lato truncate">
                  {order.user.name}
                </span>
                <span className="text-[12px] text-text-muted font-figtree truncate">
                  {order.user.email}
                </span>
              </div>
            </div>
            {/* Contact info */}
            <div className="px-4">
              <PanelRow
                icon={<Phone size={14} />}
                label="Telefone"
                value={order.user.phone}
              />
              <PanelRow
                icon={<MessageCircle size={14} />}
                label="WhatsApp"
                value={order.user.whatsappNumber}
              />
              <PanelRow
                icon={<Mail size={14} />}
                label="Email"
                value={order.user.email}
              />
            </div>
            {/* Activity */}
            <div className="px-4 py-3 border-t border-border-light">
              <p className="text-2xs text-text-subtle font-figtree uppercase tracking-wide mb-1">
                Atividade
              </p>
              <div className="flex items-center gap-1.5 text-[12px] text-text-muted font-figtree">
                <Calendar size={12} />
                Feita em: {formatDateTime(order.createdAt)}
              </div>
              {order.processedBy && (
                <div className="flex items-center gap-1.5 text-[12px] text-text-muted font-figtree mt-1">
                  <Package size={12} />
                  Processada por: {order.processedBy.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-card rounded-lg shadow-card px-4 py-4 flex flex-col gap-3">
          <p className="text-s font-bold text-text-dark font-lato">Estado</p>
          {/* Current */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}
          >
            <span className={cfg.className}>{cfg.icon}</span>
            <span className={`text-s font-semibold font-lato ${cfg.className}`}>
              {cfg.label}
            </span>
          </div>

          {/* Transition selector */}
          {showStatusTransitionUi && nextOptions.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xxs text-text-subtle font-figtree uppercase tracking-wide">
                Atualizar para
              </label>
              <StatusSelect
                options={nextOptions.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                }))}
                value={pendingStatus}
                onChange={(v) => setPendingStatus(v as OrderStatus | "")}
                placeholder="Selecionar novo estado…"
              />
              <button
                onClick={handleApply}
                disabled={!pendingStatus}
                className="w-full h-10 rounded-lg bg-navy text-white text-s font-lato font-semibold disabled:opacity-40 hover:bg-primary transition-colors"
              >
                Aplicar
              </button>
            </div>
          )}

          {showStatusTransitionUi && nextOptions.length === 0 && (
            <p className="text-[12px] text-text-muted font-figtree">
              Nenhuma transição disponível para este estado.
            </p>
          )}
        </div>

        {/* Summary card */}
        <div className="bg-card rounded-lg shadow-card px-4 py-4 flex flex-col gap-2">
          <p className="text-s font-bold text-text-dark font-lato mb-1">
            Resumo
          </p>
          <div className="flex justify-between text-s font-figtree text-text-body">
            <span>Subtotal</span>
            <span className="font-inter">
              {formatPrice(order.subtotal)} MZN
            </span>
          </div>
          <div className="flex justify-between items-center text-s font-figtree text-text-body">
            <span>Envio</span>
            {canEdit && editingShipping ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={shippingInput}
                  onChange={(e) => setShippingInput(e.target.value)}
                  className="w-24 rounded border border-border px-2 py-0.5 text-s font-inter text-text-dark bg-bg outline-none focus:border-accent"
                />
                <button
                  onClick={saveShipping}
                  disabled={savingShipping}
                  className="text-[12px] text-success font-lato font-semibold hover:underline disabled:opacity-50"
                >
                  {savingShipping ? "…" : "Guardar"}
                </button>
                <button
                  onClick={() => setEditingShipping(false)}
                  disabled={savingShipping}
                  className="text-[12px] text-text-muted font-lato hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-inter">
                  {formatPrice(order.shippingCost)} MZN
                </span>
                {canEdit && showEditDeliveryPrice && (
                  <button
                    onClick={() => {
                      setShippingInput(String(Number(order.shippingCost)));
                      setEditingShipping(true);
                    }}
                    className="text-accent hover:text-primary transition-colors"
                    title="Editar custo de envio"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between text-sm font-bold text-text-dark font-lato border-t border-border-light pt-2 mt-1">
            <span>Total</span>
            <span className="font-inter text-primary">
              {formatPrice(order.total)} MZN
            </span>
          </div>
        </div>
      </div>

      {/* ── Status change modal ────────────────────────────────────────── */}
      {showModal && pendingStatus && (
        <StatusChangeModal
          currentStatus={order.status}
          targetStatus={pendingStatus as OrderStatus}
          onConfirm={applyStatusChange}
          onCancel={() => {
            setShowModal(false);
            setPendingStatus("");
          }}
        />
      )}
    </div>
  );
}
