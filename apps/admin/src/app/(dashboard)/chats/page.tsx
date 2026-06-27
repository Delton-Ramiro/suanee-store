"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { Search, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canViewChats } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";
import {
  useConversations,
  type ConversationListItem,
} from "@/lib/hooks/useChats";

// ── Helpers ────────────────────────────────────────────────────────────────

function getSocketUrl(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  return apiUrl.replace(/\/api\/v\d+.*$/, "");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });
}

function lastMessagePreview(conv: ConversationListItem): string {
  const msg = conv.messages[0];
  if (!msg) return "Sem mensagens";
  if (msg.mediaType === "image") return "📷 Imagem";
  if (msg.mediaType === "video") return "🎬 Vídeo";
  if (msg.mediaType === "pdf") return "📄 PDF";
  return msg.content?.slice(0, 80) ?? "—";
}

type FilterKey = "all" | "unread" | "read";

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const socketRef = useRef<Socket | null>(null);

  const { data, isLoading } = useConversations(
    { page: 1, limit: 100, filter },
    { enabled: canViewChats(user) },
  );

  // ── Live inbox updates via Socket.io ──────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(getSocketUrl(), {
      auth: { adminToken: token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

    socket.on("message:new", refresh);
    socket.on("conversation:new", refresh);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, queryClient]);

  if (!canViewChats(user)) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às conversas." />
    );
  }

  const conversations: ConversationListItem[] = (data?.items ?? []).filter(
    (c) =>
      !search.trim() ||
      c.user.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <h1 className="text-[22px] font-bold text-[#023337] mb-6">
        Caixa de entrada
      </h1>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome"
            className="h-10 pl-8 pr-4 rounded-full bg-[#f5f6fa] border border-[#d5d5d5] text-sm outline-none focus:border-primary w-72"
          />
        </div>

        <div className="flex items-center bg-navy rounded-lg p-1 gap-0.5">
          {(["all", "unread", "read"] as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? "bg-white text-navy"
                  : "bg-navy text-white/80 hover:text-navy hover:bg-white"
              }`}
            >
              {f === "all"
                ? `Todas (${data?.total ?? 0})`
                : f === "unread"
                  ? "Não lidas"
                  : "Lidas"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-[2fr_4fr_1fr_1fr] px-6 py-3 border-b border-border-light text-xs font-semibold text-text-muted uppercase tracking-wide shrink-0">
          <span>Cliente</span>
          <span>Última mensagem</span>
          <span>Estado</span>
          <span className="text-right">Hora</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border-light">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-10 px-6 flex items-center gap-6 animate-pulse"
              >
                <div className="h-3 w-32 bg-border rounded" />
                <div className="h-3 w-64 bg-border rounded" />
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
              <MessageCircle size={32} className="opacity-30" />
              <p className="text-sm">Nenhuma conversa encontrada.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const unread = conv.unreadCount > 0;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => router.push(`/chats/${conv.id}`)}
                  className="w-full grid grid-cols-[2fr_4fr_1fr_1fr] items-center px-6 py-2.5 text-left text-[14px] hover:bg-surface-hover transition-colors"
                >
                  <span
                    className={`${unread ? "font-bold" : "font-normal"} text-[#202224] truncate`}
                  >
                    {conv.user.name}
                  </span>
                  <span
                    className={`${unread ? "font-bold" : "font-normal"} text-[#202224] opacity-90 truncate pr-4`}
                  >
                    {lastMessagePreview(conv)}
                  </span>
                  <span>
                    {unread && (
                      <span className="text-warning text-xs font-bold">
                        Não lida
                      </span>
                    )}
                  </span>
                  <span className="text-right text-[#202224] opacity-60 text-xs">
                    {timeAgo(conv.updatedAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {data && conversations.length > 0 && (
          <div className="px-6 py-2.5 border-t border-border-light text-xs text-text-muted shrink-0">
            Exibindo {conversations.length} de {data.total}
          </div>
        )}
      </div>
    </div>
  );
}
