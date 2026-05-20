import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/* ── Types ───────────────────────────────────────────────────────────────── */

export type DashboardStats = {
  sales7d: number;
  salesPrev7d: number;
  orders7d: number;
  ordersPrev7d: number;
  newUsers7d: number;
  newUsersPrev7d: number;
  returnedSales7d: number;
  cancelledSales7d: number;
};

export type DashboardOrder = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  user: { id: string; name: string };
};

export type TopProduct = {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  orderCount: number;
  revenue: number;
};

export type BestSellingProduct = {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  basePrice: number;
  stockStatus: "in_stock" | "by_importation";
  totalQuantity: number;
};

export type LatestCategory = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type LatestProduct = {
  id: string;
  name: string;
  basePrice: number;
  thumbnailUrl: string | null;
};

export type DashboardData = {
  stats: DashboardStats;
  latestOrders: DashboardOrder[];
  topProducts: TopProduct[];
  bestSellingProducts: BestSellingProduct[];
  latestCategories: LatestCategory[];
  latestProducts: LatestProduct[];
};

export type RevenueDay = { day: number; revenue: number };

/* ── Hooks ───────────────────────────────────────────────────────────────── */

export function useDashboard(options: { enabled?: boolean } = {}) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/admin/dashboard"),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}

export function useDashboardRevenue(
  month: number,
  year: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery<{ days: RevenueDay[] }>({
    queryKey: ["dashboard-revenue", month, year],
    queryFn: () =>
      apiFetch<{ days: RevenueDay[] }>(
        `/admin/dashboard/revenue?month=${month}&year=${year}`,
      ),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}
