import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const AdminSearchQuery = z.object({
  q: z.string().min(1).max(200),
});

export default async function adminSearchRoutes(fastify: FastifyInstance) {
  // GET /admin/search?q=... — top 10 mixed results (products + clients)
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Search"],
      security: [{ bearerAuth: [] }],
      description:
        "Global admin search. Returns up to 5 matching products and 5 matching clients (total ≤ 10 results).",
      querystring: {
        type: "object",
        required: ["q"],
        properties: {
          q: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
      response: {
        200: {
          description: "Search results",
          type: "object",
          properties: {
            products: { type: "array", items: { type: "object" } },
            clients: { type: "array", items: { type: "object" } },
          },
        },
        401: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { q } = AdminSearchQuery.parse(req.query);
      const term = `%${q}%`;

      const [products, clients] = await Promise.all([
        prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              {
                brand: { name: { contains: q, mode: "insensitive" } },
              },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            basePrice: true,
            brand: { select: { name: true } },
            media: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        }),

        prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        }),
      ]);

      // Suppress unused variable warning — term is for documentation intent
      void term;

      return reply.send({ products, clients });
    },
  });
}
