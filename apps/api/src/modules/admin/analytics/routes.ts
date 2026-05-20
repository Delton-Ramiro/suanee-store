import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { Permissions } from "@ecommerce/types";

const AnalyticsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  platform: z.enum(["web", "android", "ios"]).optional(),
});

export default async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  // GET /admin/analytics/visitors
  fastify.get("/visitors", {
    preHandler: [fastify.requirePermission(Permissions.ANALYTICS_VIEW)],
    schema: {
      tags: ["Admin Analytics"],
      security: [{ bearerAuth: [] }],
      description:
        "Visitor session counts grouped by platform. Returns total sessions, new visitors today, and a platform breakdown for the specified date range.",
      querystring: {
        type: "object",
        properties: {
          from: {
            type: "string",
            format: "date-time",
            description:
              "Start of range (ISO 8601). Defaults to start of today.",
          },
          to: {
            type: "string",
            format: "date-time",
            description: "End of range (ISO 8601). Defaults to now.",
          },
          platform: {
            type: "string",
            enum: ["web", "android", "ios"],
            description: "Filter by platform",
          },
        },
      },
      response: {
        200: {
          description: "Visitor analytics",
          type: "object",
          properties: {
            totalSessions: { type: "integer" },
            newToday: { type: "integer" },
            platformBreakdown: {
              type: "object",
              additionalProperties: { type: "integer" },
            },
            range: {
              type: "object",
              properties: { from: { type: "string" }, to: { type: "string" } },
            },
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
      const q = AnalyticsQuery.parse(req.query);
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const from = q.from ? new Date(q.from) : todayStart;
      const to = q.to ? new Date(q.to) : now;

      const [totalSessions, newToday, platformBreakdown] = await Promise.all([
        prisma.visitorSession.count({
          where: { firstSeenAt: { gte: from, lte: to } },
        }),
        prisma.visitorSession.count({
          where: { firstSeenAt: { gte: todayStart } },
        }),
        prisma.visitorSession.groupBy({
          by: ["platform"],
          where: { firstSeenAt: { gte: from, lte: to } },
          _count: true,
        }),
      ]);

      return reply.send({
        totalSessions,
        newToday,
        platformBreakdown: Object.fromEntries(
          platformBreakdown.map((p) => [p.platform, p._count]),
        ),
        range: { from, to },
      });
    },
  });

  // GET /admin/analytics/search-terms — top search queries from most-searched or could be extended
  fastify.get("/search-terms", {
    preHandler: [fastify.requirePermission(Permissions.ANALYTICS_VIEW)],
    schema: {
      tags: ["Admin Analytics"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns all entries from the most-searched keyword list, ordered by position. Each entry may include an associated category.",
      response: {
        200: {
          description: "Search terms",
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              term: { type: "string" },
              position: { type: "integer" },
              category: { type: "object", nullable: true },
            },
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
      const terms = await prisma.mostSearched.findMany({
        orderBy: { position: "asc" },
        include: {
          category: { select: { id: true, name: true, level: true } },
        },
      });
      return reply.send(terms);
    },
  });
}
