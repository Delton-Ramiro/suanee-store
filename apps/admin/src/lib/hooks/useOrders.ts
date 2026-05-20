"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type OrderStats = {
  todaySales: number;
  lastWeekSameDaySales: number;
  last7DaysSales: number;
  newOrdersToday: number;
  newOrdersLastWeekSameDay: number;
  newOrdersLast7Days: number;
  deliveredToday: number;
  inTransitNow: number;
  returnedSalesToday: number;
  cancelledSalesToday: number;
  returnedSalesLast7Days: number;
  cancelledSalesLast7Days: number;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "in_process"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

export type OrderListItem = {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  inProcessAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  _count: { items: number };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: {
      name: string;
      media: Array<{ url: string }>;
    };
    variant: {
      color: { name: string; hexCode: string } | null;
      size: { name: string } | null;
    };
  }>;
};

export type OrdersResponse = {
  stats: OrderStats;
  items: OrderListItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type OrderSegment =
  | "all"
  | "pending"
  | "paid"
  | "in_process"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "returned";

/* ── Order detail (full, from GET /admin/orders/:id) ──────────────────────── */

export type OrderDetail = {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  inProcessAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  proofNotes: string | null;
  returnReason: string | null;
  returnProof: string | null;
  cancellationReason: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    createdAt: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      basePrice: number;
      media: Array<{ url: string }>;
    };
    variant: {
      color: { name: string; hexCode: string } | null;
      size: { name: string } | null;
    };
  }>;
  processedBy: { id: string; name: string } | null;
};

type OrdersParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "total";
  sortOrder?: "asc" | "desc";
  clientId?: string;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useOrders(
  params: OrdersParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.clientId) qs.set("clientId", params.clientId);

  return useQuery<OrdersResponse>({
    queryKey: ["orders", params],
    queryFn: () => apiFetch<OrdersResponse>(`/admin/orders?${qs.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export function useOrderDetail(
  id: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<OrderDetail>({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/admin/orders/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}
