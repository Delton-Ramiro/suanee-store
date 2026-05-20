"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

export type Color = {
  id: string;
  name: string;
  hexCode: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

type ColorsResponse = {
  items: Color[];
  total: number;
  page: number;
  totalPages: number;
};

type ColorsParams = {
  search?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  page?: number;
};

type CreateColorPayload = { name: string; hexCode: string };
type UpdateColorPayload = { name?: string; hexCode?: string };

export function useColors(params: ColorsParams = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.page) qs.set("page", String(params.page));
  qs.set("limit", String(params.limit ?? 10));

  return useQuery<ColorsResponse>({
    queryKey: ["colors", params],
    queryFn: () => apiFetch<ColorsResponse>(`/admin/colors?${qs}`),
  });
}

export function useCreateColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateColorPayload) =>
      apiFetch<Color>("/admin/colors", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colors"] });
      toast.success("Cor criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateColorPayload }) =>
      apiFetch<Color>(`/admin/colors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colors"] });
      toast.success("Cor atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/colors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colors"] });
      toast.success("Cor eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
