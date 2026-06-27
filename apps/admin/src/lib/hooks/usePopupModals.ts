"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type PopupModal = {
  id: string;
  name: string;
  imageUrl: string;
  redirectUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PopupModalsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

type PopupModalsResponse = {
  items: PopupModal[];
  total: number;
  page: number;
  totalPages: number;
};

export type PopupModalPayload = {
  name: string;
  imageUrl: string;
  redirectUrl?: string | null;
  isActive?: boolean;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function usePopupModals(
  params: PopupModalsParams = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return useQuery<PopupModalsResponse>({
    queryKey: ["popup-modals", params],
    queryFn: () =>
      apiFetch<PopupModalsResponse>(`/admin/popup-modals?${qs.toString()}`),
    enabled: options.enabled ?? true,
  });
}

export function useCreatePopupModal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PopupModalPayload) =>
      apiFetch<PopupModal>("/admin/popup-modals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["popup-modals"] });
      toast.success("Modal criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePopupModal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PopupModalPayload>;
    }) =>
      apiFetch<PopupModal>(`/admin/popup-modals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["popup-modals"] });
      toast.success("Modal atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePopupModal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/popup-modals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["popup-modals"] });
      toast.success("Modal eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
