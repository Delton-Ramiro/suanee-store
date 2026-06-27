"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type TopBar = {
  id: string;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  timerMode: "duration" | "deadline" | null;
  timerSeconds: number | null;
  timerDeadline: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TopBarsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type TopBarsResponse = {
  items: TopBar[];
  total: number;
  page: number;
  totalPages: number;
};

export type TopBarPayload = {
  text: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  timerMode?: "duration" | "deadline" | null;
  timerSeconds?: number | null;
  timerDeadline?: string | null;
  isActive?: boolean;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useTopBars(
  params: TopBarsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<TopBarsResponse>({
    queryKey: ["top-bars", params],
    queryFn: () =>
      apiFetch<TopBarsResponse>(`/admin/top-bars?${qs.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export function useCreateTopBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TopBarPayload) =>
      apiFetch<TopBar>("/admin/top-bars", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["top-bars"] });
      toast.success("Barra criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTopBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TopBarPayload>;
    }) =>
      apiFetch<TopBar>(`/admin/top-bars/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["top-bars"] });
      toast.success("Barra atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTopBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/top-bars/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["top-bars"] });
      toast.success("Barra eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
