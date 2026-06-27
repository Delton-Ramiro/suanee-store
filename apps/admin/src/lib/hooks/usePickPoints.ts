"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";
import type { MozambiqueProvince } from "@ecommerce/types";

export type PickPoint = {
  id: string;
  province: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PickPointsResponse = {
  items: PickPoint[];
  total: number;
  page: number;
  totalPages: number;
};

type PickPointsParams = {
  search?: string;
  province?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

type CreatePickPointPayload = {
  province: MozambiqueProvince;
  name: string;
  address: string;
  isActive?: boolean;
};

type UpdatePickPointPayload = Partial<CreatePickPointPayload>;

export function usePickPoints(params: PickPointsParams = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.province) qs.set("province", params.province);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.page) qs.set("page", String(params.page));
  qs.set("limit", String(params.limit ?? 20));

  return useQuery<PickPointsResponse>({
    queryKey: ["pick-points", params],
    queryFn: () => apiFetch<PickPointsResponse>(`/admin/pick-points?${qs}`),
  });
}

export function useCreatePickPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePickPointPayload) =>
      apiFetch<PickPoint>("/admin/pick-points", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pick-points"] });
      toast.success("Ponto de recolha criado");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePickPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePickPointPayload }) =>
      apiFetch<PickPoint>(`/admin/pick-points/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pick-points"] });
      toast.success("Ponto de recolha atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePickPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/pick-points/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pick-points"] });
      toast.success("Ponto de recolha eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
