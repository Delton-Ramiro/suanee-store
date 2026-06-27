"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

// ── Types ──────────────────────────────────────────────────────────────────

export type MediaType = "image" | "video" | "pdf";

export type ChatMessage = {
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

export type ConversationListItem = {
  id: string;
  userId: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  messages: ChatMessage[];
  unreadCount: number;
};

export type ConversationsResponse = {
  items: ConversationListItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type MessagesResponse = {
  items: ChatMessage[];
  total: number;
  page: number;
  totalPages: number;
};

export type CartItem = {
  id: string;
  productId: string;
  productVariantId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    isIndicativePrice: boolean;
    media: Array<{ url: string }>;
  };
  variant: {
    id: string;
    price: number | null;
    color: { id: string; name: string; hexCode: string } | null;
    size: { id: string; name: string; label: string } | null;
  };
};

export type CartResponse = {
  userId: string;
  items: CartItem[];
};

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useConversations(
  params: { page?: number; limit?: number; filter?: "all" | "unread" | "read" } = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.filter && params.filter !== "all") qs.set("filter", params.filter);

  return useQuery<ConversationsResponse>({
    queryKey: ["conversations", params],
    queryFn: () =>
      apiFetch<ConversationsResponse>(`/admin/chats?${qs.toString()}`),
    enabled: options.enabled ?? true,
    refetchInterval: false,
  });
}

export function useConversationMessages(
  conversationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<MessagesResponse>({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () =>
      apiFetch<MessagesResponse>(
        `/admin/chats/${conversationId}/messages?limit=50`,
      ),
    enabled: !!conversationId && (options.enabled ?? true),
    refetchInterval: false,
  });
}

export function useConversationCart(
  conversationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<CartResponse>({
    queryKey: ["conversation-cart", conversationId],
    queryFn: () =>
      apiFetch<CartResponse>(`/admin/chats/${conversationId}/cart`),
    enabled: !!conversationId && (options.enabled ?? true),
  });
}
