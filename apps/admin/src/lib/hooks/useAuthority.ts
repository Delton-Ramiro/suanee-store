"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RoleKey } from "@ecommerce/types";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleKey: RoleKey | null;
  permissions: number;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type AdminsResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

type CreateAdminPayload = {
  name: string;
  email: string;
  password: string;
  roleKey: RoleKey;
  avatarUrl?: string | null;
};

type UpdateAdminPayload = {
  name?: string;
  roleKey?: RoleKey;
  avatarUrl?: string | null;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useAdmins(
  params: { page?: number; limit?: number } = {},
  options: { enabled?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("limit", String(params.limit ?? 20));

  return useQuery<AdminsResponse>({
    queryKey: ["admins", params],
    queryFn: () => apiFetch<AdminsResponse>(`/admin/authority?${qs}`),
    enabled: options.enabled ?? true,
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdminPayload) =>
      apiFetch<AdminUser>("/admin/authority", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Administrador criado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminPayload }) =>
      apiFetch<AdminUser>(`/admin/authority/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Administrador atualizado com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/admin/authority/${id}/deactivate`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Conta desativada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/admin/authority/${id}/activate`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Conta ativada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
