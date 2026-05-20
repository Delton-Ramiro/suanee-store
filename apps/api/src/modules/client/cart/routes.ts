import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const AddToCartSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});

const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(100),
});

export default async function clientCartRoutes(fastify: FastifyInstance) {
  // GET /cart
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Cart"],
      security: [{ bearerAuth: [] }],
      description:
        "Retrieve the current user's cart with all items and a computed subtotal.",
      response: {
        200: {
          description: "Cart contents",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            subtotal: { type: "number", example: 149.99 },
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
      const items = await prisma.cartItem.findMany({
        where: { userId: req.user.sub },
        select: {
          id: true,
          quantity: true,
          addedAt: true,
          variant: {
            select: {
              id: true,
              sku: true,
              stockQuantity: true,
              price: true,
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
                  stockStatus: true,
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

  // POST /cart/items
  fastify.post("/items", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Cart"],
      security: [{ bearerAuth: [] }],
      description:
        "Add a product variant to the cart. Returns 409 if the variant is already in the cart (use PATCH to update quantity) or if stock is insufficient.",
      body: {
        type: "object",
        required: ["productVariantId", "quantity"],
        properties: {
          productVariantId: { type: "string", format: "uuid" },
          quantity: { type: "integer", minimum: 1, maximum: 100, example: 1 },
        },
      },
      response: {
        201: { description: "Item added to cart", type: "object" },
        404: {
          description: "Product variant not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Out of stock or already in cart",
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
      const body = AddToCartSchema.parse(req.body);

      // Verify variant exists and has stock
      const variant = await prisma.productVariant.findUnique({
        where: { id: body.productVariantId },
      });
      if (!variant)
        return reply.status(404).send({ error: "Product variant not found" });
      if (variant.stockQuantity <= 0)
        return reply.status(409).send({ error: "Out of stock" });

      const existing = await prisma.cartItem.findUnique({
        where: {
          userId_productVariantId: {
            userId: req.user.sub,
            productVariantId: body.productVariantId,
          },
        },
      });

      const alreadyInCart = existing?.quantity ?? 0;
      if (alreadyInCart + body.quantity > variant.stockQuantity) {
        return reply.status(409).send({
          error: `Cannot add ${body.quantity} unit(s): only ${variant.stockQuantity - alreadyInCart} available`,
        });
      }

      if (existing) {
        return reply.status(409).send({
          error:
            "Variant already in cart. Use PATCH /cart/items/:id to update the quantity.",
        });
      }

      const item = await prisma.cartItem.create({
        data: {
          userId: req.user.sub,
          productVariantId: body.productVariantId,
          productId: variant.productId,
          quantity: body.quantity,
        },
      });
      return reply.status(201).send(item);
    },
  });

  // PATCH /cart/items/:id
  fastify.patch<{ Params: { id: string } }>("/items/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Cart"],
      security: [{ bearerAuth: [] }],
      description:
        "Update the quantity of an existing cart item. Returns 409 if the requested quantity exceeds available stock.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: { type: "integer", minimum: 1, maximum: 100, example: 2 },
        },
      },
      response: {
        200: { description: "Cart item updated", type: "object" },
        403: {
          description: "Forbidden",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Cart item not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Insufficient stock",
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
      const body = UpdateCartItemSchema.parse(req.body);
      const item = await prisma.cartItem.findUnique({
        where: { id: req.params.id },
        include: { variant: { select: { stockQuantity: true } } },
      });
      if (!item)
        return reply.status(404).send({ error: "Cart item not found" });
      if (item.userId !== req.user.sub)
        return reply.status(403).send({ error: "Forbidden" });
      if (body.quantity > item.variant.stockQuantity) {
        return reply.status(409).send({
          error: `Only ${item.variant.stockQuantity} unit(s) available`,
        });
      }

      const updated = await prisma.cartItem.update({
        where: { id: req.params.id },
        data: { quantity: body.quantity },
      });
      return reply.send(updated);
    },
  });

  // DELETE /cart/items/:id
  fastify.delete<{ Params: { id: string } }>("/items/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Cart"],
      security: [{ bearerAuth: [] }],
      description: "Remove a single item from the cart.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Item removed" },
        403: {
          description: "Forbidden",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Cart item not found",
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
      const item = await prisma.cartItem.findUnique({
        where: { id: req.params.id },
      });
      if (!item)
        return reply.status(404).send({ error: "Cart item not found" });
      if (item.userId !== req.user.sub)
        return reply.status(403).send({ error: "Forbidden" });
      await prisma.cartItem.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  });

  // DELETE /cart — clear entire cart
  fastify.delete("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Cart"],
      security: [{ bearerAuth: [] }],
      description: "Remove all items from the current user's cart.",
      response: {
        204: { description: "Cart cleared" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      await prisma.cartItem.deleteMany({ where: { userId: req.user.sub } });
      return reply.status(204).send();
    },
  });
}
