import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { decodeCursor, paginate } from "../../../lib/utils.js";

const AddFavoriteSchema = z.object({ productId: z.string().uuid() });

export default async function clientFavoritesRoutes(fastify: FastifyInstance) {
  // GET /favorites
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Favorites"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns the current user's favorited products, paginated via cursor.",
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", default: 24 },
        },
      },
      response: {
        200: {
          description: "Favorites page",
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
      const q = z
        .object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(24),
        })
        .parse(req.query);

      const favorites = await prisma.favorite.findMany({
        take: q.limit + 1,
        ...(q.cursor
          ? { cursor: { id: decodeCursor(q.cursor) }, skip: 1 }
          : {}),
        where: { userId: req.user.sub },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
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
              variants: {
                take: 10,
                select: {
                  id: true,
                  color: { select: { id: true, name: true, hexCode: true } },
                },
              },
            },
          },
        },
      });

      const { items, nextCursor } = paginate(favorites, q.limit);
      return reply.send({ items, nextCursor });
    },
  });

  // POST /favorites
  fastify.post("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Favorites"],
      security: [{ bearerAuth: [] }],
      description:
        "Add a product to the current user's favorites. Idempotent — no error if already favorited.",
      body: {
        type: "object",
        required: ["productId"],
        properties: { productId: { type: "string", format: "uuid" } },
      },
      response: {
        201: { description: "Favorite created", type: "object" },
        404: {
          description: "Product not found",
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
      const { productId } = AddFavoriteSchema.parse(req.body);

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product)
        return reply.status(404).send({ error: "Product not found" });

      const favorite = await prisma.favorite.upsert({
        where: { userId_productId: { userId: req.user.sub, productId } },
        create: { userId: req.user.sub, productId },
        update: {},
      });
      return reply.status(201).send(favorite);
    },
  });

  // DELETE /favorites/:productId
  fastify.delete<{ Params: { productId: string } }>("/:productId", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Favorites"],
      security: [{ bearerAuth: [] }],
      description: "Remove a product from the current user's favorites.",
      params: {
        type: "object",
        required: ["productId"],
        properties: { productId: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Favorite removed" },
        404: {
          description: "Favorite not found",
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
      const deleted = await prisma.favorite.deleteMany({
        where: { userId: req.user.sub, productId: req.params.productId },
      });
      if (!deleted.count)
        return reply.status(404).send({ error: "Favorite not found" });
      return reply.status(204).send();
    },
  });
}
