"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type StorySlide = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  position: number;
};

export type Story = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  position: number;
  slides: StorySlide[];
};

export type SlideProduct = {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    hasDiscount: boolean;
    discountPrice: number | null;
    brand: { id: string; name: string } | null;
    media: { id: string; url: string; mediaType: string }[];
  };
};

export type SlideWithProducts = StorySlide & { products: SlideProduct[] };

export type StoryDetail = Omit<Story, "slides"> & {
  slides: SlideWithProducts[];
};

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useStory(id: string | null, options: { enabled?: boolean } = {}) {
  return useQuery<StoryDetail>({
    queryKey: ["story", id],
    queryFn: () => apiFetch<StoryDetail>(`/stories/${id}`),
    enabled: !!id && (options.enabled ?? true),
  });
}
