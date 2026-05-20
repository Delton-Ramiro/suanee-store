"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type CurrencyRate = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
};

type CurrencyPayload = {
  code: string;
  name: string;
  symbol: string;
  rate: number;
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useCurrencyRates(options: { enabled?: boolean } = {}) {
  return useQuery<CurrencyRate[]>({
    queryKey: ["currencies"],
    queryFn: () => apiFetch<CurrencyRate[]>("/admin/currencies"),
    enabled: options.enabled ?? true,
  });
}

export function useCreateCurrencyRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencyPayload) =>
      apiFetch<CurrencyRate>("/admin/currencies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      toast.success("Taxa de câmbio criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCurrencyRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CurrencyPayload>;
    }) =>
      apiFetch<CurrencyRate>(`/admin/currencies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      toast.success("Taxa de câmbio atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCurrencyRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/currencies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      toast.success("Taxa de câmbio eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
