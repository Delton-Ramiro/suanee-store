import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const MAX_ITEMS = 6;

const RecordSchema = z.object({ productId: z.string().uuid() });

export default async function clientRecentlyViewedRoutes(
  fastify: FastifyInstance,
) {
  // POST /recently-viewed — upsert a product view, keep only the latest MAX_ITEMS
  fastify.post("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Recently Viewed"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["productId"],
        properties: { productId: { type: "string", format: "uuid" } },
      },
      response: {
        200: { type: "array", items: { type: "object" } },
        400: { type: "object" },
      },
    },
    handler: async (req, reply) => {
      const { productId } = RecordSchema.parse(req.body);
      const userId = req.user.sub;

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) return reply.status(400).send({ error: "Product not found" });

      // Upsert: update viewedAt if exists, otherwise create
      await prisma.userRecentlyViewed.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: { viewedAt: new Date() },
      });

      // Trim to MAX_ITEMS — delete oldest entries beyond the limit
      const all = await prisma.userRecentlyViewed.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        select: { id: true },
      });
      if (all.length > MAX_ITEMS) {
        const toDelete = all.slice(MAX_ITEMS).map((r) => r.id);
        await prisma.userRecentlyViewed.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Return latest items with product data
      const items = await prisma.userRecentlyViewed.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        take: MAX_ITEMS,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              basePrice: true,
              isIndicativePrice: true,
              hasDiscount: true,
              discountPrice: true,
              brand: { select: { name: true } },
              media: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      });

      return reply.send(items.map((r) => ({ ...r.product, viewedAt: r.viewedAt })));
    },
  });

  // GET /recently-viewed — return the latest MAX_ITEMS for the authenticated user
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Recently Viewed"],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: "array", items: { type: "object" } },
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.sub;

      const items = await prisma.userRecentlyViewed.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        take: MAX_ITEMS,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              basePrice: true,
              isIndicativePrice: true,
              hasDiscount: true,
              discountPrice: true,
              brand: { select: { name: true } },
              media: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      });

      return reply.send(items.map((r) => ({ ...r.product, viewedAt: r.viewedAt })));
    },
  });
}
