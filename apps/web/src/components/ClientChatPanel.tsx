"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Paperclip,
  Send,
  X,
  FileText,
  Loader2,
  ShoppingBag,
  Minus,
  Plus,
  PackagePlus,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Home,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { useChat, chatStore } from "@/lib/stores/chatStore";
import { useCart, cartStore, type CartItem } from "@/lib/stores/cartStore";
import { useAuth } from "@/lib/auth";
import { authFetch, apiFetch } from "@/lib/api";
import { ordersStore } from "@/lib/stores/ordersStore";
import { DrawerItemRow } from "./DrawerPanel";

// ── Types ──────────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "pdf";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "user" | "admin";
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isRead: boolean;
  createdAt: string;
};

type Conversation = {
  id: string;
  userId: string;
};

type Attachment = {
  file: File;
  preview: string | null;
  mediaType: MediaType;
};

type PickPoint = {
  id: string;
  province: string;
  name: string;
  address: string;
};

type StockViolation = {
  cartItemId: string;
  productVariantId: string;
  productName: string;
  variantLabel: string;
  requested: number;
  available: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getSocketUrl(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  return apiUrl.replace(/\/api\/v\d+.*$/, "");
}

function detectMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPrice(v: number) {
  return `MZN ${Math.round(v).toLocaleString("pt-PT")}`;
}

// ── Media bubble rendering ─────────────────────────────────────────────────

function MediaBubble({
  mediaUrl,
  mediaType,
}: {
  mediaUrl: string;
  mediaType: MediaType;
}) {
  if (mediaType === "image") {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer">
        <img
          src={mediaUrl}
          alt="Imagem"
          className="max-w-[220px] max-h-[280px] rounded-lg object-cover block"
        />
      </a>
    );
  }
  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        controls
        className="max-w-[220px] rounded-lg block"
      />
    );
  }
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 text-sm hover:bg-white/30 transition-colors"
    >
      <FileText size={18} />
      <span className="truncate max-w-[160px]">Documento PDF</span>
    </a>
  );
}

// ── Attachment preview in compose ──────────────────────────────────────────

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className="relative inline-flex items-center gap-2 bg-bg rounded-lg p-2 mb-2 max-w-[200px]">
      {attachment.mediaType === "image" && attachment.preview ? (
        <img
          src={attachment.preview}
          alt="Preview"
          className="w-12 h-12 rounded object-cover"
        />
      ) : attachment.mediaType === "video" ? (
        <div className="w-12 h-12 rounded bg-brand/10 flex items-center justify-center">
          <span className="text-[10px] font-bold text-brand">VID</span>
        </div>
      ) : (
        <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
          <FileText size={20} className="text-primary" />
        </div>
      )}
      <span className="text-xs text-brand/70 truncate flex-1">
        {attachment.file.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ── Encomendar Modal ───────────────────────────────────────────────────────

function EncomendarModal({
  cartItems,
  onClose,
  onSuccess,
}: {
  cartItems: CartItem[];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [ppSearch, setPpSearch] = useState("");
  const [ppResults, setPpResults] = useState<PickPoint[]>([]);
  const [ppLoading, setPpLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const [deliveryType, setDeliveryType] = useState<"pickup" | "home" | null>(null);
  const [selectedPickPoint, setSelectedPickPoint] = useState<PickPoint | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<StockViolation[]>([]);

  const [localQty, setLocalQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(cartItems.map((i) => [i.key, i.quantity])),
  );

  const flaggedKeys = new Set(
    cartItems
      .filter((i) => (localQty[i.key] ?? i.quantity) > i.stockQuantity)
      .map((i) => i.key),
  );

  const canProceed =
    flaggedKeys.size === 0 &&
    cartItems.length > 0 &&
    deliveryType !== null &&
    (deliveryType === "pickup"
      ? selectedPickPoint !== null
      : deliveryAddress.trim().length > 0);

  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.price * (localQty[i.key] ?? i.quantity),
    0,
  );

  // Lazy search — debounced 350ms
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePpSearchChange(val: string) {
    setPpSearch(val);
    setListOpen(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) {
      setPpResults([]);
      setPpLoading(false);
      return;
    }
    setPpLoading(true);
    searchTimerRef.current = setTimeout(() => {
      apiFetch<{ items: PickPoint[] }>(
        `/pick-points?search=${encodeURIComponent(val.trim())}&limit=30`,
      )
        .then(({ items }) => setPpResults(items))
        .catch(() => setPpResults([]))
        .finally(() => setPpLoading(false));
    }, 350);
  }

  function handleSelectPickPoint(pp: PickPoint) {
    setSelectedPickPoint(pp);
    setListOpen(false);
    setPpSearch("");
    setPpResults([]);
  }

  function handleReduceQty(item: CartItem) {
    setLocalQty((prev) => ({ ...prev, [item.key]: item.stockQuantity }));
  }

  function handleRemoveItem(item: CartItem) {
    cartStore.remove(item.key);
  }

  async function handleSubmit() {
    if (!canProceed || submitting) return;
    setSubmitting(true);
    setError(null);
    setViolations([]);

    for (const item of cartItems) {
      const newQty = localQty[item.key] ?? item.quantity;
      if (newQty !== item.quantity) {
        cartStore.updateQty(item.key, newQty - item.quantity);
      }
    }

    try {
      const body: Record<string, unknown> = { deliveryType };
      if (deliveryType === "pickup" && selectedPickPoint) {
        body.pickPointId = selectedPickPoint.id;
      }
      if (deliveryType === "home") {
        body.deliveryAddress = deliveryAddress.trim();
      }

      const order = await authFetch<{ id: string }>("/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Clear cart after successful order
      cartStore.setItems([]);

      onSuccess(order.id);
    } catch (e) {
      if (e && typeof e === "object" && "violations" in e) {
        setViolations((e as { violations: StockViolation[] }).violations);
        setError("Alguns artigos não têm stock suficiente.");
      } else {
        setError(
          e instanceof Error ? e.message : "Erro ao criar encomenda. Tenta novamente.",
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white w-full sm:max-w-[480px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-brand">Encomendar</p>
            <button
              type="button"
              onClick={onClose}
              className="text-brand/40 hover:text-brand transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {cartItems.length} artigo{cartItems.length !== 1 ? "s" : ""} ·{" "}
            {fmtPrice(subtotal)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Items section */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
              Artigos no carrinho
            </p>
            <div className="flex flex-col gap-3">
              {cartItems.map((item) => {
                const qty = localQty[item.key] ?? item.quantity;
                const isFlagged = qty > item.stockQuantity;
                const isOutOfStock = item.stockQuantity === 0;

                return (
                  <div
                    key={item.key}
                    className={`flex gap-3 p-2 rounded-xl ${isFlagged ? "bg-red-50 border border-red-200" : "bg-surface-hover/40"}`}
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-muted-bg">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted-bg" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {[item.colorName, item.sizeName].filter(Boolean).join(" · ")} · {qty}×
                      </p>
                      <p className="text-xs font-semibold text-brand mt-0.5">
                        {fmtPrice(item.price * qty)}
                      </p>
                      {isFlagged && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle size={11} />
                            {isOutOfStock
                              ? "Sem stock"
                              : `Apenas ${item.stockQuantity} disponível${item.stockQuantity !== 1 ? "is" : ""}`}
                          </span>
                          {!isOutOfStock && (
                            <button
                              type="button"
                              onClick={() => handleReduceQty(item)}
                              className="text-xs text-red-600 underline"
                            >
                              Reduzir para {item.stockQuantity}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item)}
                            className="text-xs text-text-muted underline"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Server violations */}
          {violations.length > 0 && (
            <div className="mx-5 mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-semibold text-red-700 mb-1">
                Stock insuficiente:
              </p>
              {violations.map((v) => (
                <p key={v.productVariantId} className="text-xs text-red-600">
                  {v.productName}
                  {v.variantLabel ? ` (${v.variantLabel})` : ""} — pedido{" "}
                  {v.requested}, disponível {v.available}
                </p>
              ))}
            </div>
          )}

          {/* Delivery section */}
          <div className="px-5 pt-5 pb-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
              Entrega
            </p>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setDeliveryType("pickup");
                  setSelectedPickPoint(null);
                  setPpSearch("");
                  setPpResults([]);
                  setListOpen(false);
                  setDeliveryAddress("");
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                  deliveryType === "pickup"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-text-muted hover:border-brand/30"
                }`}
              >
                <MapPin size={16} />
                Ponto de recolha
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeliveryType("home");
                  setSelectedPickPoint(null);
                  setPpSearch("");
                  setPpResults([]);
                  setListOpen(false);
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                  deliveryType === "home"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-text-muted hover:border-brand/30"
                }`}
              >
                <Home size={16} />
                Domicílio
              </button>
            </div>

            {/* Pickup point selector */}
            {deliveryType === "pickup" && (
              <div className="flex flex-col gap-2">
                {/* Selected pick point — shows instead of search when chosen */}
                {selectedPickPoint && !listOpen ? (
                  <div className="flex items-start gap-3 px-3 py-3 bg-primary/8 border border-primary/25 rounded-xl">
                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">
                        {selectedPickPoint.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {selectedPickPoint.province} · {selectedPickPoint.address}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CheckCircle2 size={12} className="text-success shrink-0" />
                        <span className="text-xs font-semibold text-success">
                          Entrega gratuita
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPickPoint(null);
                        setListOpen(true);
                      }}
                      className="text-xs text-text-muted hover:text-brand underline shrink-0 mt-0.5"
                    >
                      Alterar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Search input */}
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        value={ppSearch}
                        onChange={(e) => handlePpSearchChange(e.target.value)}
                        onFocus={() => ppSearch.trim() && setListOpen(true)}
                        placeholder="Pesquisar por nome, província ou morada…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm bg-bg outline-none focus:border-primary transition-colors"
                        autoFocus
                      />
                      {ppLoading && (
                        <Loader2
                          size={14}
                          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand/40"
                        />
                      )}
                    </div>

                    {/* Results list */}
                    {listOpen && ppSearch.trim() && (
                      <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5 border border-border rounded-xl overflow-hidden">
                        {ppLoading ? (
                          <div className="flex items-center justify-center h-20">
                            <Loader2 size={18} className="animate-spin text-brand/30" />
                          </div>
                        ) : ppResults.length === 0 ? (
                          <p className="text-xs text-text-muted text-center py-6 px-4">
                            Nenhum ponto encontrado para "{ppSearch}".
                          </p>
                        ) : (
                          ppResults.map((pp) => (
                            <button
                              key={pp.id}
                              type="button"
                              onClick={() => handleSelectPickPoint(pp)}
                              className="flex items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
                            >
                              <MapPin
                                size={14}
                                className="mt-0.5 shrink-0 text-text-muted"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-brand truncate">
                                  {pp.name}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                  {pp.province} · {pp.address}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {!ppSearch.trim() && (
                      <p className="text-xs text-text-muted px-1">
                        Pesquise um ponto de recolha próximo de si.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Home delivery — address input + warning */}
            {deliveryType === "home" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand">
                    Morada de entrega
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Ex: Av. Eduardo Mondlane, nº 123, 3º andar, Maputo"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-bg outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
                <div className="flex items-start gap-2 px-3 py-3 bg-warning/10 border border-warning/30 rounded-xl">
                  <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>Atenção:</strong> A entrega ao domicílio pode ter
                    custos adicionais. Um assistente irá entrar em contacto para
                    confirmar os detalhes e o custo de entrega.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-light shrink-0">
          {error && <p className="text-xs text-danger mb-3">{error}</p>}
          {flaggedKeys.size > 0 && (
            <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
              <AlertTriangle size={12} />
              Resolve os artigos com stock insuficiente para continuar.
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed || submitting}
            className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <PackagePlus size={16} />
                Confirmar encomenda
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order success panel ────────────────────────────────────────────────────

function OrderSuccessView({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white w-full sm:max-w-[400px] rounded-t-2xl sm:rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-success" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-brand">Encomenda criada!</p>
          <p className="text-sm text-text-muted mt-1">
            A tua encomenda foi registada com sucesso e está a aguardar
            confirmação.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            onClick={() => { ordersStore.open(); onClose(); }}
            className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold flex items-center justify-center hover:bg-primary transition-colors"
          >
            Ver encomenda
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl border border-border text-sm font-semibold text-text-body hover:bg-surface-hover transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ClientChatPanel() {
  const { isOpen } = useChat();
  const { user } = useAuth();
  const { items: cartItems } = useCart();

  const [view, setView] = useState<"chat" | "cart">("chat");
  const [encomendarOpen, setEncomendarOpen] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  // Reset to chat view when panel closes
  useEffect(() => {
    if (!isOpen) setView("chat");
  }, [isOpen]);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<Conversation | null>(null);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // ── Load conversation when panel opens ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || !user) return;
    if (conversation) return;

    setInitialLoading(true);
    authFetch<{ items: Conversation[] }>("/chats/conversations")
      .then(({ items }) => {
        if (items.length > 0) {
          setConversation(items[0]!);
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [isOpen, user, conversation]);

  // ── Load messages when conversation is established ─────────────────────
  useEffect(() => {
    if (!conversation) return;

    authFetch<{ items: Message[] }>(
      `/chats/conversations/${conversation.id}/messages`,
    )
      .then(({ items }) => setMessages(items))
      .catch(() => {});
  }, [conversation?.id]);

  // ── Socket.io connection ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const socket = io(getSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("message:new", ({ message }: { message: Message }) => {
      if (message.conversationId === conversationRef.current?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    if (conversation && socketRef.current) {
      socketRef.current.emit("join:conversation", conversation.id);
    }
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File handling ──────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      setFileError(null);

      if (file.size > 10 * 1024 * 1024) {
        setFileError("O ficheiro não pode exceder 10 MB.");
        return;
      }

      const mediaType = detectMediaType(file);
      if (!mediaType) {
        setFileError(
          "Tipo de ficheiro não suportado. Use imagem, vídeo ou PDF.",
        );
        return;
      }

      const preview =
        mediaType === "image" ? URL.createObjectURL(file) : null;
      setAttachment({ file, preview, mediaType });
    },
    [],
  );

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!user) return;
    if (!text.trim() && !attachment) return;
    if (sending) return;

    setSending(true);
    setFileError(null);

    try {
      let mediaUrl: string | null = null;
      let mediaType: MediaType | null = null;

      if (attachment) {
        setUploadProgress(0);
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1] ?? "");
          reader.onerror = reject;
          reader.readAsDataURL(attachment.file);
        });

        const { publicUrl } = await authFetch<{ publicUrl: string }>(
          "/media/upload",
          {
            method: "POST",
            body: JSON.stringify({
              context: "chat",
              filename: attachment.file.name,
              contentType: attachment.file.type,
              data,
            }),
          },
        );

        setUploadProgress(100);
        mediaUrl = publicUrl;
        mediaType = attachment.mediaType;
      }

      const body = {
        content: text.trim() || undefined,
        mediaUrl: mediaUrl ?? undefined,
        mediaType: mediaType ?? undefined,
      };

      if (!conversationRef.current) {
        const conv = await authFetch<Conversation>("/chats/conversations", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setConversation(conv);
        const { items } = await authFetch<{ items: Message[] }>(
          `/chats/conversations/${conv.id}/messages`,
        );
        setMessages(items);
        socketRef.current?.emit("join:conversation", conv.id);
      } else {
        const msg = await authFetch<Message>(
          `/chats/conversations/${conversationRef.current.id}/messages`,
          { method: "POST", body: JSON.stringify(body) },
        );
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      setText("");
      setAttachment(null);
      setUploadProgress(null);
    } catch {
      setFileError("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }, [user, text, attachment, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") chatStore.close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={chatStore.close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chat Suanee"
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[540px] bg-white flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light shrink-0">
          <button
            type="button"
            onClick={
              view === "cart" ? () => setView("chat") : chatStore.close
            }
            className="text-brand/50 hover:text-brand transition-colors"
            aria-label={view === "cart" ? "Voltar ao chat" : "Fechar chat"}
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>

          {view === "chat" ? (
            <>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-bold text-brand">SUANEE</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                  <span className="text-xs text-text-muted">
                    Sempre activo
                  </span>
                </div>
              </div>
              {/* Encomendar button */}
              {user && cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEncomendarOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-primary transition-colors shrink-0"
                  aria-label="Encomendar"
                >
                  <PackagePlus size={14} />
                  Encomendar
                </button>
              )}
              {/* Cart icon */}
              <button
                type="button"
                onClick={() => setView("cart")}
                aria-label="Ver carrinho"
                className="relative text-brand/50 hover:text-brand transition-colors"
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <span className="text-sm font-bold text-brand flex-1">
              Carrinho
            </span>
          )}
        </div>

        {/* ── Chat view ─────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {initialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2
                    size={24}
                    className="animate-spin text-brand/30"
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-12">
                  <p className="text-sm text-text-muted">
                    Inicie a conversa enviando uma mensagem.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isClient = msg.senderType === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${
                        isClient ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {!isClient && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          S
                        </div>
                      )}
                      <div
                        className={`flex flex-col gap-1 max-w-[75%] ${
                          isClient ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-4 py-3 text-sm leading-relaxed ${
                            isClient
                              ? "bg-primary text-white rounded-bl-3xl rounded-tl-3xl rounded-tr-3xl"
                              : "bg-[#f2f4f5] text-[#303437] rounded-br-3xl rounded-tr-3xl rounded-bl-3xl"
                          }`}
                        >
                          {msg.mediaUrl && msg.mediaType && (
                            <div className={msg.content ? "mb-2" : ""}>
                              <MediaBubble
                                mediaUrl={msg.mediaUrl}
                                mediaType={msg.mediaType}
                              />
                            </div>
                          )}
                          {msg.content && <p>{msg.content}</p>}
                        </div>
                        <span className="text-[10px] text-text-muted px-1">
                          {fmtTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="shrink-0 border-t border-border-light px-4 py-3">
              {fileError && (
                <p className="text-xs text-danger mb-2">{fileError}</p>
              )}
              {attachment && (
                <AttachmentPreview
                  attachment={attachment}
                  onRemove={() => {
                    if (attachment.preview)
                      URL.revokeObjectURL(attachment.preview);
                    setAttachment(null);
                    setFileError(null);
                  }}
                />
              )}
              {uploadProgress !== null && (
                <div className="h-1 bg-border rounded-full mb-2 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!attachment || sending}
                  className="text-brand/40 hover:text-brand transition-colors disabled:opacity-30 shrink-0 mb-1"
                  aria-label="Anexar ficheiro"
                >
                  <Paperclip size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex-1 bg-bg rounded-3xl px-4 py-2.5 min-h-[42px] flex items-end">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite a sua mensagem..."
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-brand placeholder:text-brand/40 outline-none resize-none max-h-28 leading-relaxed"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!text.trim() && !attachment) || sending}
                  className="bg-primary text-white w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Enviar mensagem"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Cart view ─────────────────────────────────────────────────────── */}
        {view === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cartItems.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-16">
                  O teu carrinho está vazio.
                </p>
              ) : (
                cartItems.map((item) => (
                  <DrawerItemRow
                    key={item.key}
                    imageUrl={item.imageUrl}
                    name={item.name}
                    price={fmtPrice(item.price)}
                    indicativePrice={item.isIndicativePrice}
                    meta={[
                      item.brandName,
                      item.colorName,
                      item.sizeName,
                      item.categoryName,
                    ]}
                    actions={
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 h-7 border border-border rounded px-2">
                          <button
                            type="button"
                            onClick={() =>
                              cartStore.updateQty(item.key, -1)
                            }
                            disabled={item.quantity <= 1}
                            aria-label="Diminuir"
                            className="text-brand/50 hover:text-brand disabled:opacity-30 transition-colors"
                          >
                            <Minus size={12} strokeWidth={2} />
                          </button>
                          <span className="text-xs font-semibold text-brand min-w-[14px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              cartStore.updateQty(item.key, 1)
                            }
                            disabled={item.quantity >= item.stockQuantity}
                            aria-label="Aumentar"
                            className="text-brand/50 hover:text-brand disabled:opacity-30 transition-colors"
                          >
                            <Plus size={12} strokeWidth={2} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => cartStore.remove(item.key)}
                          className="text-xs border border-brand rounded-lg px-3 py-1 text-brand/50 hover:text-brand transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    }
                  />
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="shrink-0 border-t border-border-light px-4 py-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand">
                      {fmtPrice(cartTotal)}
                    </p>
                    <p className="text-xs text-brand/50 mt-0.5">
                      * Preço indicativo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("chat")}
                    className="bg-brand text-white text-sm font-semibold px-6 h-11 hover:bg-primary transition-colors"
                  >
                    Conversar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Encomendar modal */}
      {encomendarOpen && !successOrderId && (
        <EncomendarModal
          cartItems={cartItems}
          onClose={() => setEncomendarOpen(false)}
          onSuccess={(orderId) => {
            setEncomendarOpen(false);
            setSuccessOrderId(orderId);
          }}
        />
      )}

      {/* Order success */}
      {successOrderId && (
        <OrderSuccessView
          orderId={successOrderId}
          onClose={() => {
            setSuccessOrderId(null);
            chatStore.close();
          }}
        />
      )}
    </>
  );
}
