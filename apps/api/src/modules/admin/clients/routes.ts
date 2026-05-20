import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { Permissions } from "@ecommerce/types";
import { offsetPaginate } from "../../../lib/utils.js";

const ClientQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  segment: z.enum(["all", "buyers", "visitors"]).default("all"),
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "totalSpent"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminClientsRoutes(fastify: FastifyInstance) {
  // GET /admin/clients
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.CLIENTS_VIEW)],
    schema: {
      tags: ["Admin Clients"],
      security: [{ bearerAuth: [] }],
      description:
        "List registered clients with aggregate spend data. Supports filtering by segment (all / buyers / visitors), free-text search, and sorting by name, registration date, or total spend.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          segment: {
            type: "string",
            enum: ["all", "buyers", "visitors"],
            default: "all",
          },
          search: { type: "string" },
          sortBy: {
            type: "string",
            enum: ["name", "createdAt", "totalSpent"],
            default: "createdAt",
          },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      },
      response: {
        200: {
          description: "Client list with summary stats",
          type: "object",
          properties: {
            stats: {
              type: "object",
              properties: {
                totalClients: { type: "integer" },
                lastMonthClients: { type: "integer" },
                newClientsToday: { type: "integer" },
                newClientsYesterday: { type: "integer" },
                visitsToday: { type: "integer" },
                visitsYesterday: { type: "integer" },
              },
            },
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const q = ClientQuerySchema.parse(req.query);

      // Date boundaries
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const yesterdayStart = new Date(
        todayStart.getTime() - 24 * 60 * 60 * 1000,
      );
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalClients,
        lastMonthClients,
        newClientsToday,
        newClientsYesterday,
        visitsToday,
        visitsYesterday,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.user.count({
          where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
        }),
        prisma.visitorSession.count({
          where: { firstSeenAt: { gte: todayStart } },
        }),
        prisma.visitorSession.count({
          where: { firstSeenAt: { gte: yesterdayStart, lt: todayStart } },
        }),
      ]);

      const searchClause = q.search
        ? Prisma.sql`WHERE (u.name ILIKE ${`%${q.search}%`} OR u.email ILIKE ${`%${q.search}%`} OR u.phone LIKE ${`%${q.search}%`} OR u."whatsappNumber" LIKE ${`%${q.search}%`})`
        : Prisma.empty;

      // Compradores: pelo menos uma encomenda com paidAt
      // Visitantes com conta: nenhuma encomenda com paidAt
      const segmentHaving =
        q.segment === "buyers"
          ? Prisma.sql`HAVING COUNT(DISTINCT CASE WHEN o."paidAt" IS NOT NULL THEN o.id END) > 0`
          : q.segment === "visitors"
            ? Prisma.sql`HAVING COUNT(DISTINCT CASE WHEN o."paidAt" IS NOT NULL THEN o.id END) = 0`
            : Prisma.empty;

      const sortDir =
        q.sortOrder === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      const sortCol =
        q.sortBy === "totalSpent"
          ? Prisma.sql`COALESCE(SUM(o.total), 0)`
          : q.sortBy === "name"
            ? Prisma.sql`u.name`
            : Prisma.sql`u."createdAt"`;

      const offset = (q.page - 1) * q.limit;

      type RawRow = {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        whatsappNumber: string | null;
        totalOrders: bigint;
        paidOrders: bigint;
        pendingOrders: bigint;
        totalSpent: string;
        pendingOrdersAmount: string;
        createdAt: Date;
      };

      type CountRow = { cnt: bigint };

      const [countRows, rows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*) AS cnt
          FROM (
            SELECT u.id
            FROM users u
            LEFT JOIN orders o ON o."userId" = u.id
            ${searchClause}
            GROUP BY u.id
            ${segmentHaving}
          ) sub
        `,
        prisma.$queryRaw<RawRow[]>`
          SELECT
            u.id, u.name, u.email, u.phone, u."whatsappNumber", u."createdAt",
            COUNT(DISTINCT o.id) AS "totalOrders",
            COUNT(DISTINCT CASE WHEN o."paidAt" IS NOT NULL THEN o.id END) AS "paidOrders",
            COUNT(DISTINCT CASE WHEN o."paidAt" IS NULL AND o.status NOT IN ('cancelled', 'returned') THEN o.id END) AS "pendingOrders",
            COALESCE(SUM(CASE WHEN o."paidAt" IS NOT NULL THEN o.total ELSE 0 END), 0)::text AS "totalSpent",
            COALESCE(SUM(CASE WHEN o."paidAt" IS NULL AND o.status NOT IN ('cancelled', 'returned') THEN o.total ELSE 0 END), 0)::text AS "pendingOrdersAmount"
          FROM users u
          LEFT JOIN orders o ON o."userId" = u.id
          ${searchClause}
          GROUP BY u.id
          ${segmentHaving}
          ORDER BY ${sortCol} ${sortDir}
          LIMIT ${q.limit}
          OFFSET ${offset}
        `,
      ]);

      const total = Number(countRows[0]?.cnt ?? 0);
      const items = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        whatsappNumber: r.whatsappNumber,
        totalOrders: Number(r.totalOrders),
        paidOrders: Number(r.paidOrders),
        pendingOrders: Number(r.pendingOrders),
        totalSpent: parseFloat(r.totalSpent),
        pendingOrdersAmount: parseFloat(r.pendingOrdersAmount),
        createdAt: r.createdAt,
      }));

      return reply.send({
        stats: {
          totalClients,
          lastMonthClients,
          newClientsToday,
          newClientsYesterday,
          visitsToday,
          visitsYesterday,
        },
        ...offsetPaginate(items, total, q.page, q.limit),
      });
    },
  });

  // GET /admin/clients/:id — client details
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.CLIENTS_VIEW)],
    schema: {
      tags: ["Admin Clients"],
      security: [{ bearerAuth: [] }],
      description:
        "Get a single client's profile including total orders, total spend, last purchase date, and their active chat conversation ID.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Client profile", type: "object" },
        404: {
          description: "Client not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          _count: { select: { orders: true } },
          conversations: { select: { id: true }, take: 1 },
        },
      });
      if (!user) return reply.status(404).send({ error: "Client not found" });

      const [paidAggregate, pendingAggregate, paidOrders, pendingOrders] =
        await Promise.all([
          prisma.order.aggregate({
            where: { userId: req.params.id, paidAt: { not: null } },
            _sum: { total: true },
          }),
          prisma.order.aggregate({
            where: {
              userId: req.params.id,
              paidAt: null,
              status: { notIn: ["cancelled", "returned"] },
            },
            _sum: { total: true },
          }),
          prisma.order.count({
            where: { userId: req.params.id, paidAt: { not: null } },
          }),
          prisma.order.count({
            where: {
              userId: req.params.id,
              paidAt: null,
              status: { notIn: ["cancelled", "returned"] },
            },
          }),
        ]);

      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        whatsappNumber: user.whatsappNumber,
        birthDate: user.birthDate,
        createdAt: user.createdAt,
        lastPurchaseAt: user.orders[0]?.createdAt ?? null,
        totalOrders: user._count.orders,
        paidOrders,
        totalSpent: Number(paidAggregate._sum.total ?? 0),
        pendingOrders,
        pendingOrdersAmount: Number(pendingAggregate._sum.total ?? 0),
        conversationId: user.conversations[0]?.id ?? null,
      });
    },
  });

  // GET /admin/clients/:id/cart — view a client's current cart items
  fastify.get<{ Params: { id: string } }>("/:id/cart", {
    preHandler: [fastify.requirePermission(Permissions.CLIENTS_VIEW)],
    schema: {
      tags: ["Admin Clients"],
      security: [{ bearerAuth: [] }],
      description:
        "View the current cart contents of a specific client, including full product and variant details.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Cart items",
          type: "array",
          items: { type: "object" },
        },
        404: {
          description: "Client not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!user) return reply.status(404).send({ error: "Client not found" });

      const items = await prisma.cartItem.findMany({
        where: { userId: req.params.id },
        include: {
          variant: {
            include: {
              product: {
                include: {
                  media: { take: 1, orderBy: { position: "asc" } },
                  brand: { select: { id: true, name: true } },
                },
              },
              color: true,
              size: true,
            },
          },
        },
        orderBy: { addedAt: "asc" },
      });

      const subtotal = items.reduce((sum, item) => {
        const price =
          item.variant.product.discountPrice ?? item.variant.product.basePrice;
        return sum + Number(price) * item.quantity;
      }, 0);

      return reply.send({ items, subtotal });
    },
  });
}
