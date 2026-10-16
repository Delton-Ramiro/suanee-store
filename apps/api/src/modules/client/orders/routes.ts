import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { decodeCursor, paginate } from "../../../lib/utils.js";

const OrderListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum([
      "pending",
      "paid",
      "in_process",
      "in_transit",
      "delivered",
      "returned",
      "cancelled",
    ])
    .optional(),
});

const CreateClientOrderSchema = z.object({
  pickPointId: z.string().uuid().optional(),
  deliveryType: z.enum(["pickup", "home"]),
  deliveryAddress: z.string().min(1).max(500).optional(),
});

const UpdateClientOrderDeliverySchema = z.object({
  pickPointId: z.string().uuid().optional().nullable(),
  deliveryType: z.enum(["pickup", "home"]),
  deliveryAddress: z.string().min(1).max(500).optional().nullable(),
});

export default async function clientOrdersRoutes(fastify: FastifyInstance) {
  // POST /orders — create a pending order from the client's cart
  fastify.post("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Orders"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a pending order from the authenticated user's server-side cart. Validates stock before creating. Requires an existing conversation.",
      body: {
        type: "object",
        required: ["deliveryType"],
        properties: {
          pickPointId: { type: "string", format: "uuid" },
          deliveryType: { type: "string", enum: ["pickup", "home"] },
          deliveryAddress: { type: "string" },
        },
      },
      response: {
        201: { description: "Order created", type: "object" },
        422: {
          description: "Stock validation failed",
          type: "object",
          properties: {
            error: { type: "string" },
            violations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productName: { type: "string" },
                  variantLabel: { type: "string" },
                  requested: { type: "integer" },
                  available: { type: "integer" },
                  cartItemId: { type: "string" },
                  productVariantId: { type: "string" },
                },
              },
            },
          },
        },
        400: { description: "Bad request", type: "object" },
        401: { description: "Unauthorized", type: "object" },
      },
    },
    handler: async (req, reply) => {
      const body = CreateClientOrderSchema.parse(req.body);
      const userId = req.user.sub;

      if (body.deliveryType === "pickup" && !body.pickPointId) {
        return reply.status(400).send({ error: "pickPointId é obrigatório para recolha num ponto" });
      }
      if (body.deliveryType === "home" && !body.deliveryAddress?.trim()) {
        return reply.status(400).send({ error: "Morada de entrega é obrigatória para entrega ao domicílio" });
      }
      if (body.deliveryType === "pickup" && body.pickPointId) {
        const pp = await prisma.pickPoint.findUnique({
          where: { id: body.pickPointId },
          select: { isActive: true },
        });
        if (!pp?.isActive) {
          return reply.status(400).send({ error: "Ponto de recolha não está activo" });
        }
      }

      // Get user's cart from DB
      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, basePrice: true, media: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } },
              color: { select: { name: true } },
              size: { select: { name: true, label: true } },
            },
          },
        },
      });

      if (cartItems.length === 0) {
        return reply.status(400).send({ error: "O carrinho está vazio" });
      }

      // Validate stock
      const violations = cartItems
        .filter((ci) => ci.variant.stockQuantity < ci.quantity)
        .map((ci) => ({
          cartItemId: ci.id,
          productVariantId: ci.productVariantId,
          productName: ci.variant.product.name,
          variantLabel: [ci.variant.color?.name, ci.variant.size?.label ?? ci.variant.size?.name]
            .filter(Boolean)
            .join(" · "),
          requested: ci.quantity,
          available: ci.variant.stockQuantity,
        }));

      if (violations.length > 0) {
        return reply.status(422).send({
          error: "Alguns artigos não têm stock suficiente",
          violations,
        });
      }

      // Find or ensure the user has a conversation
      const conversation = await prisma.conversation.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (!conversation) {
        return reply.status(400).send({ error: "Não existe conversa associada à sua conta. Inicie um chat primeiro." });
      }

      const subtotal = cartItems.reduce(
        (sum, ci) => sum + Number(ci.variant.price ?? ci.variant.product.basePrice) * ci.quantity,
        0,
      );

      const order = await prisma.order.create({
        data: {
          conversationId: conversation.id,
          userId,
          status: "pending",
          pickPointId: body.deliveryType === "pickup" ? (body.pickPointId ?? null) : null,
          deliveryType: body.deliveryType,
          deliveryAddress: body.deliveryType === "home" ? (body.deliveryAddress ?? null) : null,
          subtotal,
          shippingCost: 0,
          total: subtotal,
          items: {
            create: cartItems.map((ci) => ({
              productId: ci.variant.product.id,
              productVariantId: ci.productVariantId,
              quantity: ci.quantity,
              unitPrice: Number(ci.variant.price ?? ci.variant.product.basePrice),
            })),
          },
        },
        include: {
          items: true,
          pickPoint: { select: { id: true, name: true, province: true, address: true } },
        },
      });

      // Clear the user's server-side cart after order creation
      await prisma.cartItem.deleteMany({ where: { userId } });

      return reply.status(201).send(order);
    },
  });

  // PATCH /orders/:id — edit delivery on a pending order (client can only edit while pending)
  fastify.patch<{ Params: { id: string } }>("/:id/delivery", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Orders"],
      security: [{ bearerAuth: [] }],
      description: "Update delivery details for a pending order. Clears deliveryAddress when switching to pickup and clears pickPointId when switching to home.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["deliveryType"],
        properties: {
          pickPointId: { type: "string", format: "uuid", nullable: true },
          deliveryType: { type: "string", enum: ["pickup", "home"] },
          deliveryAddress: { type: "string", nullable: true },
        },
      },
      response: {
        200: { description: "Updated order", type: "object" },
        400: { description: "Validation error", type: "object" },
        403: { description: "Order cannot be edited", type: "object" },
        404: { description: "Order not found", type: "object" },
      },
    },
    handler: async (req, reply) => {
      const body = UpdateClientOrderDeliverySchema.parse(req.body);
      const userId = req.user.sub;

      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { id: true, userId: true, status: true, subtotal: true },
      });

      if (!order || order.userId !== userId) {
        return reply.status(404).send({ error: "Encomenda não encontrada" });
      }
      if (order.status !== "pending") {
        return reply.status(403).send({ error: "Só é possível editar encomendas em estado pendente" });
      }

      if (body.deliveryType === "pickup" && !body.pickPointId) {
        return reply.status(400).send({ error: "pickPointId é obrigatório para recolha num ponto" });
      }
      if (body.deliveryType === "home" && !body.deliveryAddress?.trim()) {
        return reply.status(400).send({ error: "Morada de entrega é obrigatória para entrega ao domicílio" });
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryType: body.deliveryType,
          pickPointId: body.deliveryType === "pickup" ? (body.pickPointId ?? null) : null,
          deliveryAddress: body.deliveryType === "home" ? (body.deliveryAddress ?? null) : null,
          // pickup orders have no delivery cost; recalculate total accordingly
          ...(body.deliveryType === "pickup" ? { shippingCost: 0, total: order.subtotal } : {}),
        },
        include: {
          pickPoint: { select: { id: true, name: true, province: true, address: true } },
        },
      });

      return reply.send(updated);
    },
  });

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
          pickPoint: { select: { id: true, name: true, province: true, address: true } },
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
