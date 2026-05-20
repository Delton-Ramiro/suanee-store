import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateBrandSchema,
  UpdateBrandSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { cacheDel } from "../../../lib/redis.js";
import { CacheKeys } from "../../../lib/redis.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { deleteR2Objects } from "../../../lib/r2.js";

const BrandQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export default async function adminBrandsRoutes(fastify: FastifyInstance) {
  // GET /admin/brands
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Brands"],
      security: [{ bearerAuth: [] }],
      description:
        "List brands with their associated categories and product counts. Supports cursor pagination and text search.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          search: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Brand list",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
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
      const q = BrandQuerySchema.parse(req.query);
      const where = q.search
        ? { name: { contains: q.search, mode: "insensitive" as const } }
        : {};
      const include = {
        brandCategories: {
          include: { category: { select: { id: true, name: true } } },
        },
        _count: { select: { products: true } },
      };
      const [total, brands] = await Promise.all([
        prisma.brand.count({ where }),
        prisma.brand.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { createdAt: "desc" },
          include,
        }),
      ]);
      return reply.send(offsetPaginate(brands, total, q.page, q.limit));
    },
  });

  // GET /admin/brands/:id
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Brands"],
      security: [{ bearerAuth: [] }],
      description: "Get a single brand with its category associations.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Brand detail", type: "object" },
        404: {
          description: "Not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const brand = await prisma.brand.findUnique({
        where: { id: req.params.id },
        include: {
          brandCategories: {
            include: {
              category: { select: { id: true, name: true, level: true } },
            },
          },
          _count: { select: { products: true } },
        },
      });
      if (!brand) return reply.status(404).send({ error: "Not found" });
      return reply.send(brand);
    },
  });

  // GET /admin/brands/:id/categories/:categoryId/affected-products
  fastify.get<{ Params: { id: string; categoryId: string } }>(
    "/:id/categories/:categoryId/affected-products",
    {
      preHandler: [fastify.authenticateAdmin],
      schema: {
        tags: ["Admin Brands"],
        security: [{ bearerAuth: [] }],
        description:
          "Returns the count and top 10 products that belong to both this brand and the given category. Use before removing a brand-category association to warn about affected products.",
        params: {
          type: "object",
          required: ["id", "categoryId"],
          properties: {
            id: { type: "string", format: "uuid" },
            categoryId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "Affected products",
            type: "object",
            properties: {
              total: { type: "integer" },
              products: { type: "array", items: { type: "object" } },
            },
          },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        const { id: brandId, categoryId } = req.params;

        const brand = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) return reply.status(404).send({ error: "Brand not found" });

        const where = {
          brandId,
          categories: { some: { categoryId } },
        };

        const [total, products] = await Promise.all([
          prisma.product.count({ where }),
          prisma.product.findMany({
            where,
            take: 10,
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              name: true,
              slug: true,
              media: {
                take: 1,
                orderBy: { position: "asc" as const },
                select: { url: true, mediaType: true },
              },
            },
          }),
        ]);

        return reply.send({ total, products });
      },
    },
  );

  // POST /admin/brands
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.BRANDS_EDIT)],
    schema: {
      tags: ["Admin Brands"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new brand. Optionally associate with categories by passing categoryIds.",
      body: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string", example: "Nike" },
          slug: { type: "string", example: "nike" },
          logoUrl: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: ["draft", "published"],
            default: "published",
          },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      response: {
        201: { description: "Brand created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateBrandSchema.parse(req.body);
      const { categoryIds, ...brandData } = body;
      const brand = await prisma.brand.create({
        data: {
          ...brandData,
          brandCategories: categoryIds?.length
            ? { create: categoryIds.map((id) => ({ categoryId: id })) }
            : undefined,
        },
        include: { brandCategories: true },
      });
      await cacheDel(CacheKeys.brandList());
      await audit({
        adminId: req.user.sub,
        action: "brand.created",
        resourceType: "brand",
        resourceId: brand.id,
        after: body,
      });
      return reply.status(201).send(brand);
    },
  });

  // PATCH /admin/brands/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.BRANDS_EDIT)],
    schema: {
      tags: ["Admin Brands"],
      security: [{ bearerAuth: [] }],
      description:
        "Update brand details. Passing categoryIds replaces the full category association list.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          logoUrl: { type: "string", nullable: true },
          status: { type: "string", enum: ["draft", "published"] },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      response: {
        200: { description: "Brand updated", type: "object" },
        404: {
          description: "Brand not found",
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
      const body = UpdateBrandSchema.parse(req.body);
      const { categoryIds, ...brandData } = body;
      const before = await prisma.brand.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Brand not found" });

      // Delete old R2 logo when replaced with a different one
      if (
        brandData.logoUrl !== undefined &&
        before.logoUrl &&
        before.logoUrl !== brandData.logoUrl
      ) {
        try {
          const key = new URL(before.logoUrl).pathname.replace(/^\//, "");
          await deleteR2Objects([key]).catch(() => undefined);
        } catch {
          // invalid URL — skip
        }
      }

      await prisma.$transaction(async (tx) => {
        if (categoryIds !== undefined) {
          await tx.brandCategory.deleteMany({
            where: { brandId: req.params.id },
          });
          if (categoryIds.length) {
            await tx.brandCategory.createMany({
              data: categoryIds.map((id) => ({
                brandId: req.params.id,
                categoryId: id,
              })),
            });
          }
        }
        await tx.brand.update({
          where: { id: req.params.id },
          data: brandData,
        });
      });

      const brand = await prisma.brand.findUnique({
        where: { id: req.params.id },
        include: { brandCategories: true },
      });
      await cacheDel(CacheKeys.brandList());
      await audit({
        adminId: req.user.sub,
        action: "brand.updated",
        resourceType: "brand",
        resourceId: req.params.id,
        before,
        after: body,
      });
      return reply.send(brand);
    },
  });

  // DELETE /admin/brands/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.BRANDS_EDIT)],
    schema: {
      tags: ["Admin Brands"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a brand. Returns 409 if any products are still associated with it.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Brand deleted" },
        409: {
          description: "Brand has associated products",
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
      const count = await prisma.product.count({
        where: { brandId: req.params.id },
      });
      if (count > 0)
        return reply
          .status(409)
          .send({ error: `Cannot delete: ${count} products use this brand` });
      await prisma.brand.delete({ where: { id: req.params.id } });
      await cacheDel(CacheKeys.brandList());
      await audit({
        adminId: req.user.sub,
        action: "brand.deleted",
        resourceType: "brand",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
