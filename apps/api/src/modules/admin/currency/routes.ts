import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateCurrencyRateSchema,
  UpdateCurrencyRateSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";

export default async function adminCurrencyRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Currency"],
      security: [{ bearerAuth: [] }],
      description: "List all currency exchange rates ordered by creation date.",
      response: {
        200: {
          description: "Currency rates",
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
      const rates = await prisma.currencyRate.findMany({
        orderBy: { createdAt: "desc" },
      });
      return reply.send(rates);
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.CURRENCY_EDIT)],
    schema: {
      tags: ["Admin Currency"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new currency exchange rate entry (e.g. USD to MZN).",
      body: {
        type: "object",
        required: ["code", "name", "symbol", "rate"],
        properties: {
          code: { type: "string", example: "USD" },
          name: { type: "string", example: "US Dollar" },
          symbol: { type: "string", example: "$" },
          rate: {
            type: "number",
            description: "Exchange rate to MZN",
            example: 63.5,
          },
        },
      },
      response: {
        201: { description: "Rate created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateCurrencyRateSchema.parse(req.body);
      const rate = await prisma.currencyRate.create({ data: body });
      await audit({
        adminId: req.user.sub,
        action: "currency_rate.created",
        resourceType: "currency_rate",
        resourceId: rate.id,
        after: body,
      });
      return reply.status(201).send(rate);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.CURRENCY_EDIT)],
    schema: {
      tags: ["Admin Currency"],
      security: [{ bearerAuth: [] }],
      description: "Update a currency exchange rate.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          symbol: { type: "string" },
          rate: { type: "number" },
        },
      },
      response: {
        200: { description: "Rate updated", type: "object" },
        404: {
          description: "Currency rate not found",
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
      const body = UpdateCurrencyRateSchema.parse(req.body);
      const before = await prisma.currencyRate.findUnique({
        where: { id: req.params.id },
      });
      if (!before)
        return reply.status(404).send({ error: "Currency rate not found" });
      const rate = await prisma.currencyRate.update({
        where: { id: req.params.id },
        data: body,
      });
      await audit({
        adminId: req.user.sub,
        action: "currency_rate.updated",
        resourceType: "currency_rate",
        resourceId: rate.id,
        before,
        after: body,
      });
      return reply.send(rate);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.CURRENCY_EDIT)],
    schema: {
      tags: ["Admin Currency"],
      security: [{ bearerAuth: [] }],
      description: "Delete a currency exchange rate.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Rate deleted" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      await prisma.currencyRate.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "currency_rate.deleted",
        resourceType: "currency_rate",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
