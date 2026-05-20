import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { Permissions } from "@ecommerce/types";

// Statuses that count as "confirmed" revenue (not pending/cancelled/returned)
const REVENUE_STATUSES: Array<
  "paid" | "in_process" | "in_transit" | "delivered"
> = ["paid", "in_process", "in_transit", "delivered"];

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /admin/dashboard — main KPI snapshot
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.DASHBOARD_VIEW)],
    schema: {
      tags: ["Admin Dashboard"],
      security: [{ bearerAuth: [] }],
      description:
        "7-day KPI stats, latest 5 orders, top 10 products by order count, top 10 best sellers by qty, 3 latest categories, 3 latest products.",
      response: {
        200: { description: "Dashboard data", type: "object" },
        401: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (_req, reply) => {
      const now = new Date();

      const last7Start = new Date(now);
      last7Start.setDate(last7Start.getDate() - 7);
      last7Start.setHours(0, 0, 0, 0);

      const prev7Start = new Date(now);
      prev7Start.setDate(prev7Start.getDate() - 14);
      prev7Start.setHours(0, 0, 0, 0);

      const prev7End = new Date(last7Start);

      const [
        sales7dRaw,
        salesPrev7dRaw,
        bruteMargin7dRaw,
        bruteMarginPrev7dRaw,
        orders7d,
        ordersPrev7d,
        newUsers7d,
        newUsersPrev7d,
        returnedSales7dRaw,
        cancelledSales7dRaw,
        latestOrders,
        topProductsRaw,
        bestSellersRaw,
        latestCategories,
        latestProducts,
      ] = await Promise.all([
        // Revenue last 7 days (confirmed orders only)
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: last7Start },
          },
        }),

        // Revenue prev 7 days
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: prev7Start, lt: prev7End },
          },
        }),

        prisma.order.aggregate({
          _sum: { bruteMargin: true },
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: last7Start },
          },
        }),

        prisma.order.aggregate({
          _sum: { bruteMargin: true },
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: prev7Start, lt: prev7End },
          },
        }),

        // Orders last 7 days count
        prisma.order.count({
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: last7Start },
          },
        }),

        // Orders prev 7 days count
        prisma.order.count({
          where: {
            status: { in: REVENUE_STATUSES },
            paidAt: { gte: prev7Start, lt: prev7End },
          },
        }),

        // New users last 7 days
        prisma.user.count({ where: { createdAt: { gte: last7Start } } }),

        // New users prev 7 days
        prisma.user.count({
          where: { createdAt: { gte: prev7Start, lt: prev7End } },
        }),

        // Returned orders value last 7 days
        prisma.order.aggregate({
          _sum: { total: true },
          where: { status: "returned", returnedAt: { gte: last7Start } },
        }),

        // Cancelled orders value last 7 days
        prisma.order.aggregate({
          _sum: { total: true },
          where: { status: "cancelled", cancelledAt: { gte: last7Start } },
        }),

        // Latest 5 orders (any status)
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
        }),

        // Top 10 products by order count (distinct orders containing the product)
        prisma.$queryRaw<
          {
            productId: string;
            name: string;
            thumbnailUrl: string | null;
            orderCount: number;
            revenue: number;
          }[]
        >`
          SELECT
            oi."productId",
            p.name,
            (SELECT pm.url FROM product_media pm
             WHERE pm."productId" = oi."productId"
             ORDER BY pm.position ASC LIMIT 1) AS "thumbnailUrl",
            COUNT(DISTINCT oi."orderId")::int AS "orderCount",
            SUM(oi.quantity * oi."unitPrice")::float AS revenue
          FROM order_items oi
          JOIN products p ON p.id = oi."productId"
          JOIN orders o ON o.id = oi."orderId"
          WHERE o."paidAt" IS NOT NULL
            AND o.status IN ('paid', 'in_process', 'in_transit', 'delivered')
          GROUP BY oi."productId", p.name
          ORDER BY "orderCount" DESC
          LIMIT 10
        `,

        // Top 10 best sellers by total quantity sold
        prisma.$queryRaw<
          {
            productId: string;
            name: string;
            thumbnailUrl: string | null;
            basePrice: number;
            stockStatus: string;
            totalQuantity: number;
          }[]
        >`
          SELECT
            oi."productId",
            p.name,
            (SELECT pm.url FROM product_media pm
             WHERE pm."productId" = oi."productId"
             ORDER BY pm.position ASC LIMIT 1) AS "thumbnailUrl",
            p."basePrice"::float AS "basePrice",
            p."stockStatus",
            SUM(oi.quantity)::int AS "totalQuantity"
          FROM order_items oi
          JOIN products p ON p.id = oi."productId"
          JOIN orders o ON o.id = oi."orderId"
          WHERE o."paidAt" IS NOT NULL
            AND o.status IN ('paid', 'in_process', 'in_transit', 'delivered')
          GROUP BY oi."productId", p.name, p."basePrice", p."stockStatus"
          ORDER BY "totalQuantity" DESC
          LIMIT 10
        `,

        // 3 latest categories
        prisma.category.findMany({
          take: 3,
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, imageUrl: true },
        }),

        // 3 latest published products
        prisma.product.findMany({
          take: 3,
          where: { status: "published" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            basePrice: true,
            media: {
              take: 1,
              orderBy: { position: "asc" },
              select: { url: true },
            },
          },
        }),
      ]);

      return reply.send({
        stats: {
          sales7d: Number(sales7dRaw._sum?.total ?? 0),
          salesPrev7d: Number(salesPrev7dRaw._sum?.total ?? 0),
          bruteMargin7d: Number(bruteMargin7dRaw._sum?.bruteMargin ?? 0),
          bruteMarginPrev7d: Number(
            bruteMarginPrev7dRaw._sum?.bruteMargin ?? 0,
          ),
          orders7d,
          ordersPrev7d,
          newUsers7d,
          newUsersPrev7d,
          returnedSales7d: Number(returnedSales7dRaw._sum?.total ?? 0),
          cancelledSales7d: Number(cancelledSales7dRaw._sum?.total ?? 0),
        },
        latestOrders,
        topProducts: topProductsRaw,
        bestSellingProducts: bestSellersRaw,
        latestCategories,
        latestProducts: latestProducts.map((p) => ({
          ...p,
          basePrice: Number(p.basePrice),
          thumbnailUrl: p.media[0]?.url ?? null,
        })),
      });
    },
  });

  // GET /admin/dashboard/revenue?month=1&year=2026
  fastify.get("/revenue", {
    preHandler: [fastify.requirePermission(Permissions.DASHBOARD_VIEW)],
    schema: {
      tags: ["Admin Dashboard"],
      security: [{ bearerAuth: [] }],
      description: "Daily revenue for the given month and year.",
      querystring: {
        type: "object",
        required: ["month", "year"],
        properties: {
          month: { type: "integer", minimum: 1, maximum: 12 },
          year: { type: "integer", minimum: 2026 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "integer" },
                  revenue: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const query = z
        .object({
          month: z.coerce.number().int().min(1).max(12),
          year: z.coerce.number().int().min(2026),
        })
        .parse(req.query);

      const start = new Date(query.year, query.month - 1, 1);
      const end = new Date(query.year, query.month, 1);

      const rows = await prisma.$queryRaw<{ day: number; revenue: number }[]>`
        SELECT
          EXTRACT(DAY FROM "paidAt")::int AS day,
          COALESCE(SUM(total)::float, 0) AS revenue
        FROM orders
        WHERE "paidAt" >= ${start}
          AND "paidAt" < ${end}
          AND status IN ('paid', 'in_process', 'in_transit', 'delivered')
        GROUP BY EXTRACT(DAY FROM "paidAt")
        ORDER BY day ASC
      `;

      // Fill in missing days with 0
      const daysInMonth = new Date(query.year, query.month, 0).getDate();
      const map = new Map(rows.map((r) => [r.day, r.revenue]));
      const days = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: map.get(i + 1) ?? 0,
      }));

      return reply.send({ days });
    },
  });
}
