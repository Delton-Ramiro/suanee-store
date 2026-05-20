"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type StorySlideProduct = {
  product: {
    id: string;
    name: string;
    basePrice: number;
    media: { url: string }[];
  };
};

export type StorySlide = {
  id: string;
  storyId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  position: number;
  products: StorySlideProduct[];
};

export type Story = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  _count?: { slides: number };
  slides?: StorySlide[];
};

export type StorySlidePayload = {
  mediaUrl: string;
  mediaType: "image" | "video";
  position: number;
  productIds: string[];
};

export type StoryPayload = {
  name: string;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  position?: number;
  slides: StorySlidePayload[];
};

export type StoryUpdatePayload = {
  name?: string;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  position?: number;
  slides?: StorySlidePayload[];
};

/* ── Hooks ─────────────────────────────────────────────────────────────────── */

export function useStories(options: { enabled?: boolean } = {}) {
  return useQuery<Story[]>({
    queryKey: ["stories"],
    queryFn: () => apiFetch<Story[]>("/admin/stories"),
    enabled: options.enabled ?? true,
  });
}

export function useStory(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery<Story>({
    queryKey: ["story", id],
    queryFn: () => apiFetch<Story>(`/admin/stories/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StoryPayload) =>
      apiFetch<Story>("/admin/stories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story criada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoryUpdatePayload }) =>
      apiFetch<Story>(`/admin/stories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["story", id] });
      toast.success("Story atualizada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/stories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story eliminada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
