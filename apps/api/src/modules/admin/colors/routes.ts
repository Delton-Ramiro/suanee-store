import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateColorSchema,
  UpdateColorSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";

const ColorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminColorsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Colors"],
      security: [{ bearerAuth: [] }],
      description:
        "List colors with optional text search. Supports offset pagination.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          search: { type: "string", description: "Search by name or hex code" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      },
      response: {
        200: {
          description: "Color list",
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  hexCode: { type: "string" },
                  slug: { type: "string" },
                },
              },
            },
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
      const q = ColorQuerySchema.parse(req.query);
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { hexCode: { contains: q.search } },
            ],
          }
        : {};
      const [total, colors] = await Promise.all([
        prisma.color.count({ where }),
        prisma.color.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { createdAt: q.sortOrder },
        }),
      ]);
      return reply.send(offsetPaginate(colors, total, q.page, q.limit));
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.COLORS_EDIT)],
    schema: {
      tags: ["Admin Colors"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new color. The hex code must be unique across all colors.",
      body: {
        type: "object",
        required: ["name", "hexCode"],
        properties: {
          name: { type: "string", example: "Midnight Blue" },
          hexCode: { type: "string", example: "#191970" },
        },
      },
      response: {
        201: { description: "Color created", type: "object" },
        409: {
          description: "Hex code already in use",
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
      const body = CreateColorSchema.parse(req.body);

      const hexConflict = await prisma.color.findFirst({
        where: { hexCode: body.hexCode },
      });
      if (hexConflict) {
        return reply.status(409).send({
          error: `Hex code ${body.hexCode} is already used by color "${hexConflict.name}"`,
        });
      }

      const slug = body.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const color = await prisma.color.create({ data: { ...body, slug } });
      await audit({
        adminId: req.user.sub,
        action: "color.created",
        resourceType: "color",
        resourceId: color.id,
        after: body,
      });
      return reply.status(201).send(color);
    },
  });

  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Colors"],
      security: [{ bearerAuth: [] }],
      description: "Get a single color by ID.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Color",
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            hexCode: { type: "string" },
            slug: { type: "string" },
          },
        },
        404: {
          description: "Color not found",
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
      const color = await prisma.color.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, hexCode: true, slug: true },
      });
      if (!color) return reply.status(404).send({ error: "Color not found" });
      return reply.send(color);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.COLORS_EDIT)],
    schema: {
      tags: ["Admin Colors"],
      security: [{ bearerAuth: [] }],
      description:
        "Update a color. Changing the hex code will fail if the new value is already used by another color.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          hexCode: { type: "string" },
        },
      },
      response: {
        200: { description: "Color updated", type: "object" },
        404: {
          description: "Color not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Hex code conflict",
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
      const body = UpdateColorSchema.parse(req.body);
      const before = await prisma.color.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Color not found" });

      if (body.hexCode && body.hexCode !== before.hexCode) {
        const hexConflict = await prisma.color.findFirst({
          where: { hexCode: body.hexCode },
        });
        if (hexConflict) {
          return reply.status(409).send({
            error: `Hex code ${body.hexCode} is already used by color "${hexConflict.name}"`,
          });
        }
      }

      const color = await prisma.color.update({
        where: { id: req.params.id },
        data: body,
      });
      await audit({
        adminId: req.user.sub,
        action: "color.updated",
        resourceType: "color",
        resourceId: color.id,
        before,
        after: body,
      });
      return reply.send(color);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.COLORS_EDIT)],
    schema: {
      tags: ["Admin Colors"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a color. Returns 409 if any product variants use this color.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Color deleted" },
        409: {
          description: "Color used by product variants",
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
      const count = await prisma.productVariant.count({
        where: { colorId: req.params.id },
      });
      if (count > 0)
        return reply.status(409).send({
          error: `Cannot delete: ${count} product variants use this color`,
        });
      await prisma.color.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "color.deleted",
        resourceType: "color",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
