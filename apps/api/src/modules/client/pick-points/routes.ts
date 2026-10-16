import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { MOZAMBIQUE_PROVINCES } from "@ecommerce/types";

const PickPointQuerySchema = z.object({
  search: z.string().optional(),
  province: z.enum(MOZAMBIQUE_PROVINCES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

export default async function clientPickPointsRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      tags: ["Pick Points"],
      description: "Returns all active pick-up points, optionally filtered by province or search term.",
      querystring: {
        type: "object",
        properties: {
          search: { type: "string" },
          province: { type: "string" },
          limit: { type: "integer", default: 200 },
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
                },
              },
            },
          },
        },
      },
    },
    handler: async (req, reply) => {
      const q = PickPointQuerySchema.parse(req.query);
      const where: Record<string, unknown> = { isActive: true };
      if (q.province) where.province = q.province;
      if (q.search) {
        where.OR = [
          { name: { contains: q.search, mode: "insensitive" } },
          { address: { contains: q.search, mode: "insensitive" } },
          { province: { contains: q.search, mode: "insensitive" } },
        ];
      }
      const items = await prisma.pickPoint.findMany({
        where,
        take: q.limit,
        orderBy: [{ province: "asc" }, { name: "asc" }],
        select: { id: true, province: true, name: true, address: true },
      });
      return reply.send({ items });
    },
  });
}
