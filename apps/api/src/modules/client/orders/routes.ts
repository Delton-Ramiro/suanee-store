import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { decodeCursor, paginate } from "../../../lib/utils.js";

const OrderListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum([
      "paid",
      "in_process",
      "in_transit",
      "delivered",
      "returned",
      "cancelled",
    ])
    .optional(),
});

export default async function clientOrdersRoutes(fastify: FastifyInstance) {
  // GET /orders
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns the current user's orders paginated by cursor. Optionally filter by status.",
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", default: 10 },
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
        },
      },
      response: {
        200: {
          description: "Orders page",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
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
      const q = OrderListQuery.parse(req.query);

      const orders = await prisma.order.findMany({
        take: q.limit + 1,
        ...(q.cursor
          ? { cursor: { id: decodeCursor(q.cursor) }, skip: 1 }
          : {}),
        where: {
          userId: req.user.sub,
          ...(q.status ? { status: q.status as never } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              variant: {
                select: {
                  id: true,
                  sku: true,
                  color: { select: { id: true, name: true, hexCode: true } },
                  size: { select: { id: true, name: true, label: true } },
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      basePrice: true,
                      hasDiscount: true,
                      discountPrice: true,
                      brand: { select: { id: true, name: true } },
                      media: {
                        take: 1,
                        orderBy: { position: "asc" as const },
                        select: { id: true, url: true, mediaType: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const { items, nextCursor } = paginate(orders, q.limit);
      return reply.send({ items, nextCursor });
    },
  });

  // GET /orders/:id
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Get a single order by ID with full item details. Returns 404 if the order belongs to a different user.",
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
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              variant: {
                select: {
                  id: true,
                  sku: true,
                  color: { select: { id: true, name: true, hexCode: true } },
                  size: { select: { id: true, name: true, label: true } },
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      basePrice: true,
                      hasDiscount: true,
                      discountPrice: true,
                      brand: { select: { id: true, name: true } },
                      media: {
                        take: 1,
                        orderBy: { position: "asc" as const },
                        select: { id: true, url: true, mediaType: true },
                      },
                    },
                  },
                },
              },
            },
          },
          conversation: { select: { id: true } },
        },
      });

      if (!order || order.userId !== req.user.sub)
        return reply.status(404).send({ error: "Order not found" });
      return reply.send(order);
    },
  });
}
