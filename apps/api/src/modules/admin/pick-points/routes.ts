import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreatePickPointSchema,
  UpdatePickPointSchema,
  MOZAMBIQUE_PROVINCES,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";

const PickPointQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  province: z.enum(MOZAMBIQUE_PROVINCES).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export default async function adminPickPointsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Pick Points"],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1 },
          limit: { type: "integer", default: 20 },
          search: { type: "string" },
          province: { type: "string" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  province: { type: "string" },
                  name: { type: "string" },
                  address: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const q = PickPointQuerySchema.parse(req.query);
      const where: Record<string, unknown> = {};
      if (q.province) where.province = q.province;
      if (q.search) {
        where.OR = [
          { name: { contains: q.search, mode: "insensitive" } },
          { address: { contains: q.search, mode: "insensitive" } },
        ];
      }
      const [total, items] = await Promise.all([
        prisma.pickPoint.count({ where }),
        prisma.pickPoint.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: [{ province: q.sortOrder }, { name: "asc" }],
        }),
      ]);
      return reply.send(offsetPaginate(items, total, q.page, q.limit));
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.PICK_POINTS_EDIT)],
    schema: {
      tags: ["Admin Pick Points"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["province", "name", "address"],
        properties: {
          province: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
        },
      },
      response: { 201: { type: "object" } },
    },
    handler: async (req, reply) => {
      const body = CreatePickPointSchema.parse(req.body);
      const point = await prisma.pickPoint.create({ data: body });
      await audit({
        adminId: req.user.sub,
        action: "pick_point.created",
        resourceType: "pick_point",
        resourceId: point.id,
        after: body,
      });
      return reply.status(201).send(point);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.PICK_POINTS_EDIT)],
    schema: {
      tags: ["Admin Pick Points"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        properties: {
          province: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
        },
      },
      response: { 200: { type: "object" } },
    },
    handler: async (req, reply) => {
      const body = UpdatePickPointSchema.parse(req.body);
      const before = await prisma.pickPoint.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Ponto não encontrado" });
      const point = await prisma.pickPoint.update({
        where: { id: req.params.id },
        data: body,
      });
      await audit({
        adminId: req.user.sub,
        action: "pick_point.updated",
        resourceType: "pick_point",
        resourceId: point.id,
        before,
        after: body,
      });
      return reply.send(point);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.PICK_POINTS_EDIT)],
    schema: {
      tags: ["Admin Pick Points"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      response: { 204: { description: "Deleted" } },
    },
    handler: async (req, reply) => {
      const point = await prisma.pickPoint.findUnique({
        where: { id: req.params.id },
      });
      if (!point) return reply.status(404).send({ error: "Ponto não encontrado" });
      await prisma.pickPoint.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "pick_point.deleted",
        resourceType: "pick_point",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
