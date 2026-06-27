import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreatePopupModalSchema,
  UpdatePopupModalSchema,
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

export default async function adminPopupModalsRoutes(
  fastify: FastifyInstance,
) {
  // GET /admin/popup-modals
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Popup Modals"],
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
        ? { name: { contains: q.search, mode: "insensitive" as const } }
        : {};
      const [total, items] = await Promise.all([
        prisma.popupModal.count({ where }),
        prisma.popupModal.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: { createdAt: q.sortOrder },
        }),
      ]);
      return reply.send(offsetPaginate(items, total, q.page, q.limit));
    },
  });

  // POST /admin/popup-modals
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Popup Modals"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name", "imageUrl"],
        properties: {
          name: { type: "string" },
          imageUrl: { type: "string" },
          redirectUrl: { type: ["string", "null"] },
          isActive: { type: "boolean", default: false },
        },
      },
      response: { 201: { type: "object" } },
    },
    handler: async (req, reply) => {
      const body = CreatePopupModalSchema.parse(req.body);
      const modal = await prisma.$transaction(async (tx) => {
        if (body.isActive) {
          await tx.popupModal.updateMany({ data: { isActive: false } });
        }
        return tx.popupModal.create({ data: body });
      });
      await audit({
        adminId: req.user.sub,
        action: "popup_modal.created",
        resourceType: "popup_modal",
        resourceId: modal.id,
        after: body,
      });
      return reply.status(201).send(modal);
    },
  });

  // PATCH /admin/popup-modals/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Popup Modals"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          imageUrl: { type: "string" },
          redirectUrl: { type: ["string", "null"] },
          isActive: { type: "boolean" },
        },
      },
      response: {
        200: { type: "object" },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const body = UpdatePopupModalSchema.parse(req.body);
      const before = await prisma.popupModal.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Modal not found" });

      const modal = await prisma.$transaction(async (tx) => {
        if (body.isActive) {
          await tx.popupModal.updateMany({
            where: { id: { not: req.params.id } },
            data: { isActive: false },
          });
        }
        return tx.popupModal.update({
          where: { id: req.params.id },
          data: body,
        });
      });

      await audit({
        adminId: req.user.sub,
        action: "popup_modal.updated",
        resourceType: "popup_modal",
        resourceId: req.params.id,
        before,
        after: body,
      });
      return reply.send(modal);
    },
  });

  // DELETE /admin/popup-modals/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.POPUP_MODALS_EDIT)],
    schema: {
      tags: ["Admin Popup Modals"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: { 204: { description: "Modal deleted" } },
    },
    handler: async (req, reply) => {
      await prisma.popupModal.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "popup_modal.deleted",
        resourceType: "popup_modal",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
