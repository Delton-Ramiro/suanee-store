"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  use,
} from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Paperclip,
  Send,
  X,
  FileText,
  Loader2,
  ShoppingBag,
  AlertTriangle,
  PackagePlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canViewChats, hasAdminPermission } from "@/lib/admin-access";
import { Permissions } from "@ecommerce/types";
import AccessDeniedState from "@/components/AccessDeniedState";
import { apiFetch } from "@/lib/api";
import {
  useConversationMessages,
  useConversationCart,
  type ChatMessage,
  type MediaType,
  type CartItem,
} from "@/lib/hooks/useChats";

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

// ── Media rendering ────────────────────────────────────────────────────────

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

// ── Cart modal ─────────────────────────────────────────────────────────────

function CartModal({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useConversationCart(conversationId);
  const cartItems = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white h-full w-full max-w-[400px] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light shrink-0">
          <h3 className="text-sm font-semibold text-brand flex items-center gap-2">
            <ShoppingBag size={16} />
            Carrinho do cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-brand/40 hover:text-brand transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-brand/30" />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
              <ShoppingBag size={28} className="opacity-30" />
              <p className="text-sm">Carrinho vazio.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-14 h-14 shrink-0 rounded bg-muted-bg overflow-hidden">
                    {item.product.media[0] ? (
                      <img
                        src={item.product.media[0].url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted-bg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-brand/60 mt-0.5">
                      {[
                        item.variant.color?.name,
                        item.variant.size?.label ?? item.variant.size?.name,
                        `× ${item.quantity}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs font-semibold text-brand mt-1">
                      {fmtPrice(
                        Number(item.variant.price ?? item.product.basePrice) *
                          item.quantity,
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create order confirmation modal ────────────────────────────────────────

function CreateOrderModal({
  conversationId,
  userId,
  cartItems,
  onClose,
  onSuccess,
}: {
  conversationId: string;
  userId: string;
  cartItems: CartItem[];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = confirmText.trim().toLowerCase() === "confirmo";

  const total = cartItems.reduce(
    (s, i) => s + Number(i.variant.price ?? i.product.basePrice) * i.quantity,
    0,
  );

  async function handleSubmit() {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const order = await apiFetch<{ id: string }>("/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          userId,
          items: cartItems.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: Number(item.variant.price ?? item.product.basePrice),
          })),
        }),
      });
      onSuccess(order.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar encomenda");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md flex flex-col gap-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light">
          <p className="text-md font-bold text-text-dark font-lato">
            Criar encomenda
          </p>
          <p className="text-s text-text-muted font-figtree mt-0.5">
            {cartItems.length} artigo{cartItems.length !== 1 ? "s" : ""} ·{" "}
            Total MZN {Math.round(total).toLocaleString("pt-PT")}
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Items summary */}
          <div className="flex flex-col gap-3 max-h-48 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded bg-muted-bg overflow-hidden">
                  {item.product.media[0] ? (
                    <img
                      src={item.product.media[0].url}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted-bg" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-dark truncate">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {[
                      item.variant.color?.name,
                      item.variant.size?.label ?? item.variant.size?.name,
                      `× ${item.quantity}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="text-xs font-semibold text-text-dark shrink-0">
                  MZN{" "}
                  {Math.round(
                    Number(item.variant.price ?? item.product.basePrice) *
                      item.quantity,
                  ).toLocaleString("pt-PT")}
                </span>
              </div>
            ))}
          </div>

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

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-light flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? "A criar…" : "Criar encomenda"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);
  const { user, token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clientName, setClientName] = useState<string>("");
  const [cartOpen, setCartOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File;
    preview: string | null;
    mediaType: MediaType;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: msgData, isLoading } = useConversationMessages(conversationId);
  const { data: cartData } = useConversationCart(conversationId);

  // Populate messages from query
  useEffect(() => {
    if (msgData?.items) {
      setMessages(msgData.items);
    }
  }, [msgData?.items]);

  // Get client name from conversations cache
  useEffect(() => {
    const cache = queryClient.getQueryData<{ items: Array<{ id: string; user: { name: string } }> }>(
      ["conversations", { page: 1, limit: 100, filter: "all" }],
    );
    const conv = cache?.items.find((c) => c.id === conversationId);
    if (conv) setClientName(conv.user.name);
  }, [conversationId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Socket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(getSocketUrl(), {
      auth: { adminToken: token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.emit("join:conversation", conversationId);

    socket.on("message:new", ({ message }: { message: ChatMessage }) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });

    // Mark messages as read when admin joins
    socket.emit("admin:mark_read", { conversationId });

    return () => {
      socket.emit("leave:conversation", conversationId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, conversationId]);

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
          "Tipo não suportado. Use imagem, vídeo ou PDF.",
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
          reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
          reader.onerror = reject;
          reader.readAsDataURL(attachment.file);
        });

        const { publicUrl } = await apiFetch<{ publicUrl: string }>(
          "/admin/media/upload",
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

      const msg = await apiFetch<ChatMessage>(
        `/admin/chats/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: text.trim() || undefined,
            mediaUrl: mediaUrl ?? undefined,
            mediaType: mediaType ?? undefined,
          }),
        },
      );

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      setText("");
      setAttachment(null);
      setUploadProgress(null);

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      setFileError("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }, [text, attachment, sending, conversationId, queryClient]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!canViewChats(user)) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às conversas." />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/chats")}
            className="text-brand/40 hover:text-brand transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <span className="text-sm font-bold text-[#202325]">
            {clientName || "Cliente"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
        >
          <ShoppingBag size={14} />
          Ver carrinho
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-brand/20" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Sem mensagens ainda.
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderType === "admin";
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isAdmin ? "flex-row" : "flex-row-reverse"}`}
              >
                {isAdmin && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    A
                  </div>
                )}
                <div
                  className={`flex flex-col gap-1 max-w-[70%] ${isAdmin ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`px-4 py-3 text-sm leading-relaxed ${
                      isAdmin
                        ? "bg-[#f2f4f5] text-[#303437] rounded-br-3xl rounded-tr-3xl rounded-bl-3xl"
                        : "bg-primary text-white rounded-bl-3xl rounded-tl-3xl rounded-tr-3xl"
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
      <div className="shrink-0 border-t border-border-light px-5 py-3">
        {fileError && (
          <p className="text-xs text-danger mb-2">{fileError}</p>
        )}
        {attachment && (
          <div className="relative inline-flex items-center gap-2 bg-bg rounded-lg p-2 mb-2 max-w-[200px]">
            {attachment.mediaType === "image" && attachment.preview ? (
              <img
                src={attachment.preview}
                alt="Preview"
                className="w-10 h-10 rounded object-cover"
              />
            ) : attachment.mediaType === "video" ? (
              <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">
                VID
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                <FileText size={18} className="text-primary" />
              </div>
            )}
            <span className="text-xs text-brand/60 truncate flex-1">
              {attachment.file.name}
            </span>
            <button
              type="button"
              onClick={() => {
                if (attachment.preview) URL.revokeObjectURL(attachment.preview);
                setAttachment(null);
              }}
              className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center"
            >
              <X size={10} />
            </button>
          </div>
        )}
        {uploadProgress !== null && (
          <div className="h-1 bg-border rounded-full mb-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
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
            aria-label="Anexar"
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
              className="flex-1 bg-transparent text-sm outline-none resize-none max-h-28 leading-relaxed"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={(!text.trim() && !attachment) || sending}
            className="bg-primary text-white w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Create order strip */}
      {hasAdminPermission(user, Permissions.ORDERS_EDIT) && (
        <div className="shrink-0 px-5 pb-4 pt-2">
          <button
            type="button"
            onClick={() => setCreateOrderOpen(true)}
            disabled={!cartData?.items.length}
            className="w-full h-10 rounded-lg bg-navy text-white text-sm font-semibold font-lato flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PackagePlus size={16} />
            Criar Encomenda
          </button>
        </div>
      )}

      {/* Cart modal */}
      {cartOpen && (
        <CartModal
          conversationId={conversationId}
          onClose={() => setCartOpen(false)}
        />
      )}

      {/* Create order modal */}
      {createOrderOpen && cartData && (
        <CreateOrderModal
          conversationId={conversationId}
          userId={cartData.userId}
          cartItems={cartData.items}
          onClose={() => setCreateOrderOpen(false)}
          onSuccess={(orderId) => router.push(`/orders/${orderId}`)}
        />
      )}
    </div>
  );
}
