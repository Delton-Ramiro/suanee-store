"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type MostSearchedCategory = {
  id: string;
  name: string;
  level: number;
  parent: { id: string; name: string } | null;
};

export type MostSearchedItem = {
  id: string;
  categoryId: string;
  position: number;
  createdAt: string;
  category: MostSearchedCategory;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useMostSearched() {
  return useQuery<MostSearchedItem[]>({
    queryKey: ["most-searched"],
    queryFn: () => apiFetch<MostSearchedItem[]>("/admin/most-searched"),
  });
}

export function useCreateMostSearched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoryId: string; position?: number }) =>
      apiFetch<MostSearchedItem>("/admin/most-searched", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["most-searched"] });
      toast.success("Item adicionado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteMostSearched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/most-searched/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["most-searched"] });
      toast.success("Item removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderMostSearched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<{ success: boolean }>("/admin/most-searched/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["most-searched"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
