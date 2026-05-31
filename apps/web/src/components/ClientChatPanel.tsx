"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Paperclip, Send, X, FileText, Loader2 } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { useChat, chatStore } from "@/lib/stores/chatStore";
import { useAuth } from "@/lib/auth";
import { apiFetch, authFetch } from "@/lib/api";

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
  // pdf
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

// ── Main component ─────────────────────────────────────────────────────────

export function ClientChatPanel() {
  const { isOpen } = useChat();
  const { user } = useAuth();

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

  // Keep ref in sync
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // ── Load conversation when panel opens ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || !user) return;
    if (conversation) return; // already loaded

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

  // Join conversation room when conversation becomes available
  useEffect(() => {
    if (conversation && socketRef.current) {
      socketRef.current.emit("join:conversation", conversation.id);
    }
  }, [conversation?.id]);

  // Auto-scroll on new messages
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
        setFileError("Tipo de ficheiro não suportado. Use imagem, vídeo ou PDF.");
        return;
      }

      let preview: string | null = null;
      if (mediaType === "image") {
        preview = URL.createObjectURL(file);
      }

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

      // Upload attachment first (proxied through server to avoid R2 CORS)
      if (attachment) {
        setUploadProgress(0);
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
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

      // Create conversation on first message, append on subsequent ones
      if (!conversationRef.current) {
        const conv = await authFetch<Conversation>("/chats/conversations", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setConversation(conv);
        // Load all messages after creating conversation
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

  // ── Escape to close ────────────────────────────────────────────────────
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
            onClick={chatStore.close}
            className="text-brand/50 hover:text-brand transition-colors"
            aria-label="Fechar chat"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-brand">SUANEE</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span className="text-xs text-text-muted">Sempre activo</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {initialLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-brand/30" />
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
                  className={`flex items-end gap-2 ${isClient ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isClient && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      S
                    </div>
                  )}
                  <div
                    className={`flex flex-col gap-1 max-w-[75%] ${isClient ? "items-end" : "items-start"}`}
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
      </div>
    </>
  );
}
