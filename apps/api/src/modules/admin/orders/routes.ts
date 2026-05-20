import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  UpdateOrderItemSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { emitToUser } from "../../../lib/socket.js";
import { sendOrderStatusEmail } from "../../../lib/resend.js";
import {
  canCreateAdminOrder,
  resolveAdminRoleKey,
  canEditAdminOrderDetails,
  canTransitionOrderToStatus,
} from "../../../lib/admin-roles.js";
import { calculateSupplierMargin } from "../../../lib/brute-margin.js";

const OrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "pending",
      "paid",
      "in_process",
      "in_transit",
      "delivered",
      "returned",
      "cancelled",
      "all",
    ])
    .default("all"),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "total"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminOrderRoutes(fastify: FastifyInstance) {
  // GET /admin/orders — list with filters, search, pagination
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.ORDERS_VIEW)],
    schema: {
      tags: ["Admin Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "List all orders with today's revenue/count stats. Supports filtering by status, client, and text search. Returns offset-paginated results.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          status: {
            type: "string",
            enum: [
              "pending",
              "paid",
              "in_process",
              "in_transit",
              "delivered",
              "returned",
              "cancelled",
              "all",
            ],
            default: "all",
          },
          search: {
            type: "string",
            description: "Search by order ID or client name",
          },
          clientId: { type: "string", format: "uuid" },
          sortBy: {
            type: "string",
            enum: ["createdAt", "updatedAt", "total"],
            default: "createdAt",
          },
          sortOrder: {
            type: "string",
            enum: ["asc", "desc"],
            default: "desc",
          },
        },
      },
      response: {
        200: {
          description: "Paginated order list with stats",
          type: "object",
          properties: {
            stats: {
              type: "object",
              properties: {
                todaySales: { type: "number" },
                lastWeekSameDaySales: { type: "number" },
                last7DaysSales: { type: "number" },
                newOrdersToday: { type: "integer" },
                newOrdersLastWeekSameDay: { type: "integer" },
                newOrdersLast7Days: { type: "integer" },
                deliveredToday: { type: "integer" },
                inTransitNow: { type: "integer" },
                returnedSalesToday: { type: "number" },
                cancelledSalesToday: { type: "number" },
                returnedSalesLast7Days: { type: "number" },
                cancelledSalesLast7Days: { type: "number" },
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
      const q = OrderQuerySchema.parse(req.query);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const last7DaysStart = new Date(todayStart);
      last7DaysStart.setDate(last7DaysStart.getDate() - 7);

      // Same weekday last week for trend comparison
      const lastWeekSameDay = new Date(todayStart);
      lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 7);
      const lastWeekSameDayEnd = new Date(lastWeekSameDay);
      lastWeekSameDayEnd.setHours(23, 59, 59, 999);

      const where = {
        ...(q.status !== "all" ? { status: q.status as never } : {}),
        ...(q.clientId ? { userId: q.clientId } : {}),
        ...(q.search
          ? {
              OR: [
                { id: { contains: q.search, mode: "insensitive" as const } },
                {
                  user: {
                    name: { contains: q.search, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };

      const include = {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { items: true } },
        items: {
          take: 1,
          include: {
            product: {
              select: {
                name: true,
                media: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
            variant: { include: { color: true, size: true } },
          },
        },
      };

      const [statsArr, total, orders] = await Promise.all([
        Promise.all([
          // Today's sales (paid orders paid today)
          prisma.order.aggregate({
            where: { paidAt: { gte: todayStart } },
            _sum: { total: true },
          }),
          // Last week same day sales
          prisma.order.aggregate({
            where: {
              paidAt: { gte: lastWeekSameDay, lte: lastWeekSameDayEnd },
            },
            _sum: { total: true },
          }),
          // Last 7 days total sales
          prisma.order.aggregate({
            where: { paidAt: { gte: last7DaysStart } },
            _sum: { total: true },
          }),
          // New paid orders today
          prisma.order.count({ where: { paidAt: { gte: todayStart } } }),
          // New paid orders last week same day
          prisma.order.count({
            where: {
              paidAt: { gte: lastWeekSameDay, lte: lastWeekSameDayEnd },
            },
          }),
          // New paid orders last 7 days
          prisma.order.count({ where: { paidAt: { gte: last7DaysStart } } }),
          // Delivered today
          prisma.order.count({ where: { deliveredAt: { gte: todayStart } } }),
          // Currently in transit
          prisma.order.count({ where: { status: "in_transit" } }),
          // Returned orders value today
          prisma.order.aggregate({
            where: { status: "returned", returnedAt: { gte: todayStart } },
            _sum: { total: true },
          }),
          // Cancelled orders value today
          prisma.order.aggregate({
            where: { status: "cancelled", cancelledAt: { gte: todayStart } },
            _sum: { total: true },
          }),
          // Returned orders value last 7 days
          prisma.order.aggregate({
            where: { status: "returned", returnedAt: { gte: last7DaysStart } },
            _sum: { total: true },
          }),
          // Cancelled orders value last 7 days
          prisma.order.aggregate({
            where: {
              status: "cancelled",
              cancelledAt: { gte: last7DaysStart },
            },
            _sum: { total: true },
          }),
        ]),
        prisma.order.count({ where }),
        prisma.order.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { [q.sortBy]: q.sortOrder },
          include,
        }),
      ]);

      const [
        todaySalesAgg,
        lastWeekAgg,
        last7DaysAgg,
        newToday,
        newLastWeek,
        newLast7Days,
        deliveredToday,
        inTransit,
        returnedTodayAgg,
        cancelledTodayAgg,
        returnedLast7Agg,
        cancelledLast7Agg,
      ] = statsArr;

      return reply.send({
        stats: {
          todaySales: Number(todaySalesAgg._sum.total ?? 0),
          lastWeekSameDaySales: Number(lastWeekAgg._sum.total ?? 0),
          last7DaysSales: Number(last7DaysAgg._sum.total ?? 0),
          newOrdersToday: newToday,
          newOrdersLastWeekSameDay: newLastWeek,
          newOrdersLast7Days: newLast7Days,
          deliveredToday,
          inTransitNow: inTransit,
          returnedSalesToday: Number(returnedTodayAgg._sum.total ?? 0),
          cancelledSalesToday: Number(cancelledTodayAgg._sum.total ?? 0),
          returnedSalesLast7Days: Number(returnedLast7Agg._sum.total ?? 0),
          cancelledSalesLast7Days: Number(cancelledLast7Agg._sum.total ?? 0),
        },
        ...offsetPaginate(orders, total, q.page, q.limit),
      });
    },
  });

  // GET /admin/orders/:id — order detail
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.ORDERS_VIEW)],
    schema: {
      tags: ["Admin Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Get full order detail including client info, all order items with product/variant data, and the processing admin.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Order detail", type: "object" },
        404: {
          description: "Order not found",
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
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              phone: true,
              whatsappNumber: true,
              createdAt: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  basePrice: true,
                  media: { where: { isPrimary: true }, take: 1 },
                },
              },
              variant: { include: { color: true, size: true } },
            },
          },
          processedBy: { select: { id: true, name: true } },
        },
      });
      if (!order) return reply.status(404).send({ error: "Order not found" });
      return reply.send(order);
    },
  });

  // POST /admin/orders — create a pending order from a conversation (no stock deduction yet)
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.ORDERS_EDIT)],
    schema: {
      tags: ["Admin Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new pending order for a client, typically from a chat conversation. Stock is not deducted until the order transitions to 'paid'.",
      body: {
        type: "object",
        required: ["userId", "items"],
        properties: {
          userId: { type: "string", format: "uuid" },
          conversationId: {
            type: "string",
            format: "uuid",
            description: "Associated chat conversation",
          },
          shippingCost: { type: "number", default: 0 },
          items: {
            type: "array",
            items: {
              type: "object",
              required: [
                "productId",
                "productVariantId",
                "quantity",
                "unitPrice",
              ],
              properties: {
                productId: { type: "string", format: "uuid" },
                productVariantId: { type: "string", format: "uuid" },
                quantity: { type: "integer", minimum: 1 },
                unitPrice: { type: "number" },
              },
            },
          },
        },
      },
      response: {
        201: { description: "Order created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      if (!canCreateAdminOrder(resolveAdminRoleKey(req.user))) {
        return reply.status(403).send({ error: "This role cannot create orders" });
      }

      const body = CreateOrderSchema.parse(req.body);

      const subtotal = body.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const total = subtotal + (body.shippingCost ?? 0);

      const order = await prisma.order.create({
        data: {
          conversationId: body.conversationId,
          userId: body.userId,
          processedById: req.user.sub,
          status: "pending",
          subtotal,
          shippingCost: body.shippingCost ?? 0,
          total,
          items: {
            create: body.items.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      emitToUser(body.userId, "order:created", {
        orderId: order.id,
        status: "pending",
      });

      await audit({
        adminId: req.user.sub,
        action: "order.created",
        resourceType: "order",
        resourceId: order.id,
        after: { status: "pending", total },
      });

      return reply.status(201).send(order);
    },
  });

  // PATCH /admin/orders/:id/status — update order status
  // When transitioning from pending → paid, stock is automatically deducted.
  // Invalid transitions are rejected with 409.
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ["paid", "cancelled"],
    paid: ["in_process", "cancelled"],
    in_process: ["in_transit", "cancelled"],
    in_transit: ["delivered", "returned"],
    delivered: ["returned"],
    returned: [],
    cancelled: [],
  };

  fastify.patch<{ Params: { id: string } }>("/:id/status", {
    preHandler: [fastify.requirePermission(Permissions.ORDERS_EDIT)],
    schema: {
      tags: ["Admin Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Advance or update an order's status. Valid transitions: pending→paid/cancelled, paid→in_process/cancelled, in_process→in_transit/cancelled, in_transit→delivered/returned, delivered→returned. Stock is deducted automatically when transitioning pending→paid.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: [
              "paid",
              "in_process",
              "in_transit",
              "delivered",
              "returned",
              "cancelled",
            ],
          },
          shippingCost: {
            type: "number",
            description:
              "Update the shipping cost. Only applied when transitioning pending→paid.",
          },
          proofNotes: { type: "string" },
          returnReason: { type: "string" },
          returnProof: {
            type: "array",
            items: { type: "string", format: "uri" },
          },
          cancellationReason: { type: "string" },
        },
      },
      response: {
        200: { description: "Order updated", type: "object" },
        404: {
          description: "Order not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Invalid status transition or insufficient stock",
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
      const body = UpdateOrderStatusSchema.parse(req.body);

      if (!canTransitionOrderToStatus(resolveAdminRoleKey(req.user), body.status)) {
        return reply.status(403).send({
          error: "This role cannot update the order to that status",
        });
      }

      const existing = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          items: true,
          user: { select: { email: true, name: true } },
        },
      });
      if (!existing)
        return reply.status(404).send({ error: "Order not found" });

      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.status)) {
        return reply.status(409).send({
          error: `Cannot transition order from '${existing.status}' to '${body.status}'. Allowed: ${allowed.length ? allowed.join(", ") : "none"}`,
        });
      }

      let nextBruteMargin = Number(existing.bruteMargin ?? 0);
      const itemBruteMargins = new Map<string, number>();

      if (existing.status === "pending" && body.status === "paid") {
        const variantIds = existing.items.map((i) => i.productVariantId);
        const variants = await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, stockQuantity: true },
        });
        const stockMap = new Map(variants.map((v) => [v.id, v.stockQuantity]));
        for (const item of existing.items) {
          const available = stockMap.get(item.productVariantId) ?? 0;
          if (available < item.quantity) {
            return reply.status(409).send({
              error: `Insufficient stock for variant ${item.productVariantId}: available ${available}, required ${item.quantity}`,
            });
          }
        }

        const supplierRows = await prisma.productSupplier.findMany({
          where: {
            productId: { in: Array.from(new Set(existing.items.map((i) => i.productId))) },
            isDefault: true,
          },
          include: { currencyRate: true },
        });
        const supplierMap = new Map(supplierRows.map((row) => [row.productId, row]));

        nextBruteMargin = 0;
        for (const item of existing.items) {
          const supplier = supplierMap.get(item.productId) ?? null;
          const unitMargin = supplier ? calculateSupplierMargin(supplier) : 0;
          const itemMargin = Math.round(unitMargin * item.quantity * 100) / 100;
          itemBruteMargins.set(item.id, itemMargin);
          nextBruteMargin += itemMargin;
        }

        await prisma.$transaction([
          prisma.order.update({
            where: { id: req.params.id },
            data: {
              status: body.status,
              ...(body.proofNotes ? { proofNotes: body.proofNotes } : {}),
              ...(body.returnReason ? { returnReason: body.returnReason } : {}),
              ...(body.returnProof && body.returnProof.length > 0
                ? { returnProof: JSON.stringify(body.returnProof) }
                : {}),
              ...(body.cancellationReason
                ? { cancellationReason: body.cancellationReason }
                : {}),
              paidAt: new Date(),
              bruteMargin: nextBruteMargin,
              ...(body.shippingCost !== undefined
                ? {
                    shippingCost: body.shippingCost,
                    total: Number(existing.subtotal) + body.shippingCost,
                  }
                : {}),
            } as never,
          }),
          ...existing.items.map((item) =>
            prisma.orderItem.update({
              where: { id: item.id },
              data: { bruteMargin: itemBruteMargins.get(item.id) ?? 0 } as never,
            }),
          ),
          ...existing.items.map((item) =>
            prisma.productVariant.update({
              where: { id: item.productVariantId },
              data: { stockQuantity: { decrement: item.quantity } },
            }),
          ),
        ]);

        const order = await prisma.order.findUnique({
          where: { id: req.params.id },
        });

        emitToUser(existing.userId, "order:status_changed", {
          orderId: req.params.id,
          status: body.status,
        });

        if (existing.user?.email) {
          sendOrderStatusEmail({
            to: existing.user.email,
            userName: existing.user.name ?? "Customer",
            orderId: req.params.id,
            status: body.status,
          }).catch(() => {
            /* Non-critical — do not fail the request */
          });
        }

        await audit({
          adminId: req.user.sub,
          action: "order.status_changed",
          resourceType: "order",
          resourceId: req.params.id,
          before: { status: existing.status },
          after: { status: body.status },
        });

        return reply.send(order ?? existing);
      }

      const updateData: Record<string, unknown> = {
        status: body.status,
        ...(body.proofNotes ? { proofNotes: body.proofNotes } : {}),
        ...(body.returnReason ? { returnReason: body.returnReason } : {}),
        ...(body.returnProof && body.returnProof.length > 0
          ? { returnProof: JSON.stringify(body.returnProof) }
          : {}),
        ...(body.cancellationReason
          ? { cancellationReason: body.cancellationReason }
          : {}),
        // Auto-set status timestamps
        ...(body.status === "paid" ? { paidAt: new Date() } : {}),
        ...(body.status === "in_process" ? { inProcessAt: new Date() } : {}),
        ...(body.status === "in_transit" ? { inTransitAt: new Date() } : {}),
        ...(body.status === "delivered" ? { deliveredAt: new Date() } : {}),
        ...(body.status === "returned" ? { returnedAt: new Date() } : {}),
        ...(body.status === "cancelled" ? { cancelledAt: new Date() } : {}),
        // Allow updating shippingCost when confirming payment (pending→paid)
        ...(existing.status === "pending" &&
        body.status === "paid" &&
        body.shippingCost !== undefined
          ? {
              shippingCost: body.shippingCost,
              total: Number(existing.subtotal) + body.shippingCost,
            }
          : {}),
      };

      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: updateData as never,
      });

      emitToUser(existing.userId, "order:status_changed", {
        orderId: order.id,
        status: order.status,
      });

      // Send email notification to the user — fire-and-forget
      if (existing.user?.email) {
        sendOrderStatusEmail({
          to: existing.user.email,
          userName: existing.user.name ?? "Customer",
          orderId: order.id,
          status: body.status,
        }).catch(() => {
          /* Non-critical — do not fail the request */
        });
      }

      await audit({
        adminId: req.user.sub,
        action: "order.status_changed",
        resourceType: "order",
        resourceId: order.id,
        before: { status: existing.status },
        after: { status: body.status },
      });

      return reply.send(order);
    },
  });

  // PATCH /admin/orders/:id/items/:itemId — edit order item (only while pending)
  fastify.patch<{ Params: { id: string; itemId: string } }>(
    "/:id/items/:itemId",
    {
      preHandler: [fastify.requirePermission(Permissions.ORDERS_EDIT)],
      schema: {
        tags: ["Admin Orders"],
        security: [{ bearerAuth: [] }],
        description:
          "Edit an order item's quantity or unit price. Only allowed while the order is in 'pending' status. Setting quantity to 0 removes the item and recalculates the order total.",
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            quantity: {
              type: "integer",
              minimum: 0,
              description: "Set to 0 to remove the item",
            },
            unitPrice: { type: "number" },
          },
        },
        response: {
          200: { description: "Item updated", type: "object" },
          204: { description: "Item removed (quantity was 0)" },
          409: {
            description: "Order not in pending status or stock exceeded",
            type: "object",
            properties: { error: { type: "string" } },
          },
          404: {
            description: "Order not found",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        if (!canEditAdminOrderDetails(resolveAdminRoleKey(req.user))) {
          return reply.status(403).send({
            error: "This role cannot edit order items",
          });
        }

        const body = UpdateOrderItemSchema.parse(req.body);
        const order = await prisma.order.findUnique({
          where: { id: req.params.id },
        });
        if (!order) return reply.status(404).send({ error: "Order not found" });
        if (order.status !== "pending") {
          return reply.status(409).send({
            error: "Order items can only be edited while the order is pending",
          });
        }

        // quantity: 0 removes the item completely
        if (body.quantity === 0) {
          await prisma.orderItem.delete({ where: { id: req.params.itemId } });
          const allItems = await prisma.orderItem.findMany({
            where: { orderId: req.params.id },
          });
          const subtotal = allItems.reduce(
            (sum, i) => sum + Number(i.unitPrice) * i.quantity,
            0,
          );
          await prisma.order.update({
            where: { id: req.params.id },
            data: { subtotal, total: subtotal + Number(order.shippingCost) },
          });
          await audit({
            adminId: req.user.sub,
            action: "order_item.deleted",
            resourceType: "order_item",
            resourceId: req.params.itemId,
          });
          return reply.status(204).send();
        }

        // Enforce stock cap when changing quantity
        if (body.quantity !== undefined) {
          const currentItem = await prisma.orderItem.findUnique({
            where: { id: req.params.itemId },
            select: { productVariantId: true },
          });
          if (currentItem) {
            const variant = await prisma.productVariant.findUnique({
              where: { id: currentItem.productVariantId },
              select: { stockQuantity: true },
            });
            if (variant && body.quantity > variant.stockQuantity) {
              return reply.status(409).send({
                error: `Only ${variant.stockQuantity} unit(s) available for this variant`,
              });
            }
          }
        }

        const item = await prisma.orderItem.update({
          where: { id: req.params.itemId },
          data: {
            ...(body.quantity ? { quantity: body.quantity } : {}),
            ...(body.unitPrice ? { unitPrice: body.unitPrice } : {}),
          },
        });

        // Recalculate order total
        const allItems = await prisma.orderItem.findMany({
          where: { orderId: req.params.id },
        });
        const subtotal = allItems.reduce(
          (sum, i) => sum + Number(i.unitPrice) * i.quantity,
          0,
        );
        await prisma.order.update({
          where: { id: req.params.id },
          data: { subtotal, total: subtotal + Number(order.shippingCost) },
        });

        await audit({
          adminId: req.user.sub,
          action: "order_item.edited",
          resourceType: "order_item",
          resourceId: item.id,
        });
        return reply.send(item);
      },
    },
  );

  // PATCH /admin/orders/:id/shipping — update shipping cost (only while pending)
  fastify.patch<{ Params: { id: string } }>("/:id/shipping", {
    preHandler: [fastify.requirePermission(Permissions.ORDERS_EDIT)],
    schema: {
      tags: ["Admin Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Update the shipping cost of a pending order. Recalculates the order total.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["shippingCost"],
        properties: { shippingCost: { type: "number", minimum: 0 } },
      },
      response: {
        200: { description: "Shipping cost updated", type: "object" },
        409: {
          description: "Order not in pending status",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Order not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      if (!canEditAdminOrderDetails(resolveAdminRoleKey(req.user))) {
        return reply.status(403).send({
          error: "This role cannot edit order shipping",
        });
      }

      const { shippingCost } = req.body as { shippingCost: number };
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
      });
      if (!order) return reply.status(404).send({ error: "Order not found" });
      if (order.status !== "pending") {
        return reply.status(409).send({
          error: "Shipping cost can only be edited while the order is pending",
        });
      }
      const updated = await prisma.order.update({
        where: { id: req.params.id },
        data: {
          shippingCost,
          total: Number(order.subtotal) + shippingCost,
        },
      });
      await audit({
        adminId: req.user.sub,
        action: "order.shipping_updated",
        resourceType: "order",
        resourceId: order.id,
        before: { shippingCost: Number(order.shippingCost) },
        after: { shippingCost },
      });
      return reply.send(updated);
    },
  });

  // DELETE /admin/orders/:id/items/:itemId — delete order item (only while pending)
  fastify.delete<{ Params: { id: string; itemId: string } }>(
    "/:id/items/:itemId",
    {
      preHandler: [fastify.requirePermission(Permissions.ORDERS_EDIT)],
      schema: {
        tags: ["Admin Orders"],
        security: [{ bearerAuth: [] }],
        description:
          "Remove an order item entirely. Only allowed while the order is in 'pending' status.",
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: { description: "Item deleted" },
          409: {
            description: "Order not in pending status",
            type: "object",
            properties: { error: { type: "string" } },
          },
          404: {
            description: "Order not found",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        if (!canEditAdminOrderDetails(resolveAdminRoleKey(req.user))) {
          return reply.status(403).send({
            error: "This role cannot delete order items",
          });
        }

        const order = await prisma.order.findUnique({
          where: { id: req.params.id },
        });
        if (!order) return reply.status(404).send({ error: "Order not found" });
        if (order.status !== "pending") {
          return reply.status(409).send({
            error: "Order items can only be deleted while the order is pending",
          });
        }

        await prisma.orderItem.delete({ where: { id: req.params.itemId } });
        await audit({
          adminId: req.user.sub,
          action: "order_item.deleted",
          resourceType: "order_item",
          resourceId: req.params.itemId,
        });
        return reply.status(204).send();
      },
    },
  );
}
