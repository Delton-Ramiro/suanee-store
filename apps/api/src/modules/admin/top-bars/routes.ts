import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateTopBarSchema,
  UpdateTopBarSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminTopBarsRoutes(fastify: FastifyInstance) {
  // GET /admin/top-bars
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Top Bars"],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          search: { type: "string" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const q = QuerySchema.parse(req.query);
      const where = q.search
        ? { text: { contains: q.search, mode: "insensitive" as const } }
        : {};
      const [total, items] = await Promise.all([
        prisma.topBar.count({ where }),
        prisma.topBar.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: { createdAt: q.sortOrder },
        }),
      ]);
      return reply.send(offsetPaginate(items, total, q.page, q.limit));
    },
  });

  // POST /admin/top-bars
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Top Bars"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" },
          linkUrl: { type: ["string", "null"] },
          linkLabel: { type: ["string", "null"] },
          timerMode: { type: ["string", "null"] },
          timerSeconds: { type: ["integer", "null"] },
          timerDeadline: { type: ["string", "null"] },
          isActive: { type: "boolean", default: false },
        },
      },
      response: { 201: { type: "object" } },
    },
    handler: async (req, reply) => {
      const body = CreateTopBarSchema.parse(req.body);
      const bar = await prisma.topBar.create({ data: body as never });
      await audit({
        adminId: req.user.sub,
        action: "top_bar.created",
        resourceType: "top_bar",
        resourceId: bar.id,
        after: body,
      });
      return reply.status(201).send(bar);
    },
  });

  // PATCH /admin/top-bars/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Top Bars"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          text: { type: "string" },
          linkUrl: { type: ["string", "null"] },
          linkLabel: { type: ["string", "null"] },
          timerMode: { type: ["string", "null"] },
          timerSeconds: { type: ["integer", "null"] },
          timerDeadline: { type: ["string", "null"] },
          isActive: { type: "boolean" },
        },
      },
      response: {
        200: { type: "object" },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const body = UpdateTopBarSchema.parse(req.body);
      const before = await prisma.topBar.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Top bar not found" });

      const bar = await prisma.topBar.update({
        where: { id: req.params.id },
        data: body as never,
      });

      await audit({
        adminId: req.user.sub,
        action: "top_bar.updated",
        resourceType: "top_bar",
        resourceId: req.params.id,
        before,
        after: body,
      });
      return reply.send(bar);
    },
  });

  // DELETE /admin/top-bars/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Top Bars"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: { 204: { description: "Top bar deleted" } },
    },
    handler: async (req, reply) => {
      await prisma.topBar.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "top_bar.deleted",
        resourceType: "top_bar",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
