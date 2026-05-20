import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import { cacheGet, cacheSet, CacheKeys } from "../../../lib/redis.js";

export default async function clientStoriesRoutes(fastify: FastifyInstance) {
  // GET /stories — public list (cached)
  fastify.get("/", {
    schema: {
      tags: ["Stories"],
      description:
        "Returns all active, non-expired stories ordered by position. Includes slides (media only, no products). Cached for 2 minutes.",
      response: {
        200: {
          description: "Stories list",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const cacheKey = CacheKeys.storyList();
      const cached = await cacheGet<unknown>(cacheKey);
      if (cached) return reply.send(cached);

      const stories = await prisma.story.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { position: "asc" },
        include: {
          slides: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              mediaUrl: true,
              mediaType: true,
              position: true,
            },
          },
        },
      });

      await cacheSet(cacheKey, stories, 120);
      return reply.send(stories);
    },
  });

  // GET /stories/:id — story detail with slide products
  fastify.get<{ Params: { id: string } }>("/:id", {
    schema: {
      tags: ["Stories"],
      description:
        "Get a single story with all slides and any linked products on each slide.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Story detail with slides and products",
          type: "object",
        },
        404: {
          description: "Story not found or not active",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const story = await prisma.story.findUnique({
        where: { id: req.params.id },
        include: {
          slides: {
            orderBy: { position: "asc" },
            include: {
              products: {
                select: {
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
                          color: {
                            select: { id: true, name: true, hexCode: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!story || !story.isActive)
        return reply.status(404).send({ error: "Story not found" });
      return reply.send(story);
    },
  });
}
