import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateMostSearchedSchema,
  ReorderSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { cacheDel, CacheKeys } from "../../../lib/redis.js";

export default async function adminMostSearchedRoutes(
  fastify: FastifyInstance,
) {
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Most Searched"],
      security: [{ bearerAuth: [] }],
      description:
        "List all most-searched keyword entries ordered by position, each with its linked category.",
      response: {
        200: {
          description: "Most searched items",
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
      const items = await prisma.mostSearched.findMany({
        orderBy: { position: "asc" },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              level: true,
              parent: { select: { id: true, name: true } },
            },
          },
        },
      });
      return reply.send(items);
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.MOST_SEARCHED_EDIT)],
    schema: {
      tags: ["Admin Most Searched"],
      security: [{ bearerAuth: [] }],
      description:
        "Add a most-searched keyword item. The linked category must be level 1 or 2.",
      body: {
        type: "object",
        required: ["categoryId"],
        properties: {
          categoryId: { type: "string", format: "uuid" },
          position: { type: "integer", default: 0 },
        },
      },
      response: {
        201: { description: "Entry created", type: "object" },
        404: {
          description: "Category not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        422: {
          description: "Category level must be 1 or 2",
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
      const body = CreateMostSearchedSchema.parse(req.body);

      // Validate category is level 1 or 2 only
      const category = await prisma.category.findUnique({
        where: { id: body.categoryId },
      });
      if (!category)
        return reply.status(404).send({ error: "Category not found" });
      if (category.level > 2)
        return reply.status(422).send({
          error: "Most searched can only reference level 1 or 2 categories",
        });

      const item = await prisma.mostSearched.create({ data: body });
      await cacheDel(CacheKeys.mostSearched());
      await audit({
        adminId: req.user.sub,
        action: "most_searched.created",
        resourceType: "most_searched",
        resourceId: item.id,
      });
      return reply.status(201).send(item);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.MOST_SEARCHED_EDIT)],
    schema: {
      tags: ["Admin Most Searched"],
      security: [{ bearerAuth: [] }],
      description: "Delete a most-searched entry.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Deleted" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      await prisma.mostSearched.delete({ where: { id: req.params.id } });
      await cacheDel(CacheKeys.mostSearched());
      await audit({
        adminId: req.user.sub,
        action: "most_searched.deleted",
        resourceType: "most_searched",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });

  fastify.patch("/reorder", {
    preHandler: [fastify.requirePermission(Permissions.MOST_SEARCHED_EDIT)],
    schema: {
      tags: ["Admin Most Searched"],
      security: [{ bearerAuth: [] }],
      description:
        "Reorder most-searched entries by providing an ordered array of IDs.",
      body: {
        type: "object",
        required: ["orderedIds"],
        properties: {
          orderedIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      response: {
        200: {
          description: "Reordered",
          type: "object",
          properties: { success: { type: "boolean" } },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { orderedIds } = ReorderSchema.parse(req.body);
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.mostSearched.update({ where: { id }, data: { position } }),
        ),
      );
      await cacheDel(CacheKeys.mostSearched());
      return reply.send({ success: true });
    },
  });
}
