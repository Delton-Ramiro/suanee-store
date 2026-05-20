import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateStorySchema,
  UpdateStorySchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { cacheDel, CacheKeys } from "../../../lib/redis.js";

export default async function adminStoriesRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Stories"],
      security: [{ bearerAuth: [] }],
      description:
        "List all stories ordered by position, with the count of slides per story.",
      response: {
        200: {
          description: "Stories list",
          type: "array",
          items: { type: "object" },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (_req, reply) => {
      const stories = await prisma.story.findMany({
        orderBy: { position: "asc" },
        include: { _count: { select: { slides: true } } },
      });
      return reply.send(stories);
    },
  });

  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Stories"],
      security: [{ bearerAuth: [] }],
      description:
        "Get a single story with all its slides and linked products.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Story detail", type: "object" },
        404: {
          description: "Story not found",
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
      const story = await prisma.story.findUnique({
        where: { id: req.params.id },
        include: {
          slides: {
            orderBy: { position: "asc" },
            include: {
              products: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      basePrice: true,
                      media: { where: { isPrimary: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!story) return reply.status(404).send({ error: "Story not found" });
      return reply.send(story);
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.STORIES_EDIT)],
    schema: {
      tags: ["Admin Stories"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new story with slides. Each slide can optionally reference product IDs.",
      body: {
        type: "object",
        required: ["name", "slides"],
        properties: {
          name: { type: "string", example: "Summer Collection" },
          thumbnailUrl: { type: "string", nullable: true },
          position: { type: "integer", default: 0 },
          slides: {
            type: "array",
            items: {
              type: "object",
              required: ["mediaUrl", "mediaType", "position", "productIds"],
              properties: {
                mediaUrl: { type: "string" },
                mediaType: { type: "string", enum: ["image", "video"] },
                position: { type: "integer" },
                productIds: {
                  type: "array",
                  items: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
      },
      response: {
        201: { description: "Story created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateStorySchema.parse(req.body);

      const story = await prisma.story.create({
        data: {
          name: body.name,
          thumbnailUrl: body.thumbnailUrl,
          position: body.position,
          slides: {
            create: body.slides.map((slide) => ({
              mediaUrl: slide.mediaUrl,
              mediaType: slide.mediaType,
              position: slide.position,
              products: slide.productIds.length
                ? {
                    create: slide.productIds.map((productId) => ({
                      productId,
                    })),
                  }
                : undefined,
            })),
          },
        },
        include: { slides: { include: { products: true } } },
      });

      await cacheDel(CacheKeys.storyList());
      await audit({
        adminId: req.user.sub,
        action: "story.created",
        resourceType: "story",
        resourceId: story.id,
      });
      return reply.status(201).send(story);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.STORIES_EDIT)],
    schema: {
      tags: ["Admin Stories"],
      security: [{ bearerAuth: [] }],
      description:
        "Update a story. If slides are provided, all existing slides are replaced.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          thumbnailUrl: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          position: { type: "integer" },
          slides: {
            type: "array",
            items: { type: "object" },
            description: "Replaces all existing slides if provided",
          },
        },
      },
      response: {
        200: { description: "Story updated", type: "object" },
        404: {
          description: "Story not found",
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
      const body = UpdateStorySchema.parse(req.body);
      const before = await prisma.story.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Story not found" });

      // Replace all slides if provided
      if (body.slides !== undefined) {
        await prisma.storySlide.deleteMany({
          where: { storyId: req.params.id },
        });
      }

      const story = await prisma.story.update({
        where: { id: req.params.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.thumbnailUrl !== undefined
            ? { thumbnailUrl: body.thumbnailUrl }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
          ...(body.slides !== undefined
            ? {
                slides: {
                  create: body.slides.map((slide) => ({
                    mediaUrl: slide.mediaUrl,
                    mediaType: slide.mediaType,
                    position: slide.position,
                    products: slide.productIds.length
                      ? {
                          create: slide.productIds.map((productId) => ({
                            productId,
                          })),
                        }
                      : undefined,
                  })),
                },
              }
            : {}),
        },
        include: { slides: { include: { products: true } } },
      });

      await cacheDel(CacheKeys.storyList());
      await audit({
        adminId: req.user.sub,
        action: "story.updated",
        resourceType: "story",
        resourceId: story.id,
      });
      return reply.send(story);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.STORIES_EDIT)],
    schema: {
      tags: ["Admin Stories"],
      security: [{ bearerAuth: [] }],
      description: "Delete a story and all its slides.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Story deleted" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      await prisma.story.delete({ where: { id: req.params.id } });
      await cacheDel(CacheKeys.storyList());
      await audit({
        adminId: req.user.sub,
        action: "story.deleted",
        resourceType: "story",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
