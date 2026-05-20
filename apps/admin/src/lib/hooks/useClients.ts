"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type ClientStats = {
  totalClients: number;
  lastMonthClients: number;
  newClientsToday: number;
  newClientsYesterday: number;
  visitsToday: number;
  visitsYesterday: number;
};

export type ClientListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappNumber: string | null;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  totalSpent: number;
  pendingOrdersAmount: number;
  createdAt: string;
};

export type ClientDetail = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  birthDate: string | null;
  createdAt: string;
  lastPurchaseAt: string | null;
  totalOrders: number;
  paidOrders: number;
  totalSpent: number;
  pendingOrders: number;
  pendingOrdersAmount: number;
  conversationId: string | null;
};

export type ClientsResponse = {
  stats: ClientStats;
  items: ClientListItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type ClientSegment = "all" | "buyers" | "visitors";
export type ClientSortBy = "name" | "createdAt" | "totalSpent";

type ClientsParams = {
  page?: number;
  limit?: number;
  segment?: ClientSegment;
  search?: string;
  sortBy?: ClientSortBy;
  sortOrder?: "asc" | "desc";
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useClients(
  params: ClientsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.segment && params.segment !== "all")
    qs.set("segment", params.segment);
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);

  return useQuery<ClientsResponse>({
    queryKey: ["clients", params],
    queryFn: () => apiFetch<ClientsResponse>(`/admin/clients?${qs.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export function useClientDetail(id: string | null) {
  return useQuery<ClientDetail>({
    queryKey: ["client", id],
    queryFn: () => apiFetch<ClientDetail>(`/admin/clients/${id}`),
    enabled: !!id,
  });
}
