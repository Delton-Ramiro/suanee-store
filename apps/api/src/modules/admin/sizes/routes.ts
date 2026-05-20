import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateSizeSchema,
  UpdateSizeSchema,
  CreateSizeGuideSchema,
  UpdateSizeGuideSchema,
  ReorderSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { deleteR2Objects } from "../../../lib/r2.js";

const SizeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  categoryIds: z.string().optional(), // comma-separated UUIDs
});

export default async function adminSizesRoutes(fastify: FastifyInstance) {
  // ─── Sizes ────────────────────────────────────────────────────────────────

  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "List sizes with their associated categories.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 50, minimum: 1, maximum: 100 },
          search: { type: "string" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
        },
      },
      response: {
        200: {
          description: "Size list",
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
      const q = SizeQuerySchema.parse(req.query);
      const categoryIdList = q.categoryIds
        ? q.categoryIds.split(",").filter(Boolean)
        : null;
      const where = {
        ...(categoryIdList?.length
          ? {
              sizeCategories: {
                some: { categoryId: { in: categoryIdList } },
              },
            }
          : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" as const } },
                { label: { contains: q.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const include = {
        sizeCategories: {
          include: {
            category: {
              select: { id: true, name: true, level: true, parentId: true },
            },
          },
        },
        _count: { select: { productVariants: true } },
      };
      const [total, sizes] = await Promise.all([
        prisma.size.count({ where }),
        prisma.size.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: { name: q.sortOrder },
          include,
        }),
      ]);
      return reply.send(offsetPaginate(sizes, total, q.page, q.limit));
    },
  });

  // ─── GET by id ────────────────────────────────────────────────────────────

  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Get a single size with its category associations.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Size detail", type: "object" },
        404: {
          description: "Not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const size = await prisma.size.findUnique({
        where: { id: req.params.id },
        include: {
          sizeCategories: {
            include: {
              category: {
                select: { id: true, name: true, level: true, parentId: true },
              },
            },
          },
          _count: { select: { productVariants: true } },
        },
      });
      if (!size) return reply.status(404).send({ error: "Size not found" });
      return reply.send(size);
    },
  });

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Create a new size. Optionally associate with categories.",
      body: {
        type: "object",
        required: ["name", "label"],
        properties: {
          name: { type: "string", example: "Medium" },
          label: { type: "string", example: "M" },
          position: { type: "integer", default: 0 },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      response: {
        201: { description: "Size created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateSizeSchema.parse(req.body);
      const { categoryIds, ...sizeData } = body;
      const slug = sizeData.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      // Check for duplicate name
      const existing = await prisma.size.findUnique({
        where: { name: sizeData.name },
      });
      if (existing) {
        return reply.status(409).send({
          error: `Já existe um tamanho com o nome "${sizeData.name}"`,
        });
      }
      const size = await prisma.size.create({
        data: {
          ...sizeData,
          slug,
          sizeCategories: categoryIds?.length
            ? {
                create: categoryIds.map((id) => ({ categoryId: id, level: 1 })),
              }
            : undefined,
        },
        include: { sizeCategories: true },
      });
      await audit({
        adminId: req.user.sub,
        action: "size.created",
        resourceType: "size",
        resourceId: size.id,
        after: body,
      });
      return reply.status(201).send(size);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description:
        "Update a size. Passing categoryIds replaces the full category association list.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          label: { type: "string" },
          position: { type: "integer" },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      response: {
        200: { description: "Size updated", type: "object" },
        404: {
          description: "Size not found",
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
      const body = UpdateSizeSchema.parse(req.body);
      const { categoryIds, ...sizeData } = body;
      // BUG-10: Regenerate slug when name changes
      const slug =
        sizeData.name !== undefined
          ? sizeData.name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "")
          : undefined;
      const before = await prisma.size.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Size not found" });

      await prisma.$transaction(async (tx) => {
        if (categoryIds !== undefined) {
          await tx.sizeCategory.deleteMany({
            where: { sizeId: req.params.id },
          });
          if (categoryIds.length) {
            await tx.sizeCategory.createMany({
              data: categoryIds.map((id) => ({
                sizeId: req.params.id,
                categoryId: id,
                level: 1,
              })),
            });
          }
        }
        await tx.size.update({
          where: { id: req.params.id },
          data: { ...sizeData, ...(slug !== undefined ? { slug } : {}) },
        });
      });

      const size = await prisma.size.findUnique({
        where: { id: req.params.id },
        include: { sizeCategories: true },
      });
      await audit({
        adminId: req.user.sub,
        action: "size.updated",
        resourceType: "size",
        resourceId: req.params.id,
        before,
        after: body,
      });
      return reply.send(size);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a size. Returns 409 if product variants use this size.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Size deleted" },
        409: {
          description: "Size used by variants",
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
        where: { sizeId: req.params.id },
      });
      if (count > 0)
        return reply.status(409).send({
          error: `Cannot delete: ${count} product variants use this size`,
        });
      await prisma.size.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "size.deleted",
        resourceType: "size",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });

  fastify.patch("/reorder", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Reorder sizes by providing an ordered array of size IDs.",
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
          prisma.size.update({ where: { id }, data: { position } }),
        ),
      );
      return reply.send({ success: true });
    },
  });

  // ─── Size Guides ──────────────────────────────────────────────────────────

  const GuideQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });

  fastify.get("/guides", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "List size guides with pagination and search.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 50, minimum: 1, maximum: 100 },
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
      const query = GuideQuerySchema.parse(req.query);
      const where = query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {};
      const [guides, total] = await Promise.all([
        prisma.sizeGuide.findMany({
          where,
          orderBy: { createdAt: query.sortOrder },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.sizeGuide.count({ where }),
      ]);
      return reply.send({
        items: guides,
        total,
        page: query.page,
        totalPages: Math.ceil(total / query.limit),
      });
    },
  });

  fastify.get<{ Params: { guideId: string } }>("/guides/:guideId", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Get a single size guide by ID.",
      params: {
        type: "object",
        required: ["guideId"],
        properties: { guideId: { type: "string", format: "uuid" } },
      },
      response: {
        200: { type: "object" },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const guide = await prisma.sizeGuide.findUnique({
        where: { id: req.params.guideId },
      });
      if (!guide)
        return reply.status(404).send({ error: "Guia não encontrado" });
      return reply.send(guide);
    },
  });

  fastify.post("/guides", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Create a size guide with optional images.",
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          images: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                position: { type: "integer" },
              },
            },
          },
        },
      },
      response: {
        201: { description: "Size guide created", type: "object" },
      },
    },
    handler: async (req, reply) => {
      const body = CreateSizeGuideSchema.parse(req.body);
      const guide = await prisma.sizeGuide.create({ data: body });
      await audit({
        adminId: req.user.sub,
        action: "size_guide.created",
        resourceType: "size_guide",
        resourceId: guide.id,
      });
      return reply.status(201).send(guide);
    },
  });

  fastify.patch<{ Params: { guideId: string } }>("/guides/:guideId", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description: "Update a size guide. Removed images are deleted from R2.",
      params: {
        type: "object",
        required: ["guideId"],
        properties: { guideId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          images: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                position: { type: "integer" },
              },
            },
          },
        },
      },
      response: {
        200: { description: "Guide updated", type: "object" },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const body = UpdateSizeGuideSchema.parse(req.body);

      const existing = await prisma.sizeGuide.findUnique({
        where: { id: req.params.guideId },
      });
      if (!existing)
        return reply.status(404).send({ error: "Guia não encontrado" });

      // R2 cleanup: delete images that were removed
      if (body.images !== undefined) {
        const oldImages = (existing.images as Array<{ url: string }>) ?? [];
        const newUrls = new Set(body.images.map((img) => img.url));
        const removedUrls = oldImages
          .filter((img) => !newUrls.has(img.url))
          .map((img) => img.url);
        if (removedUrls.length > 0) {
          const baseUrl = process.env["R2_PUBLIC_URL"] ?? "";
          const keys = removedUrls
            .map((url) => (baseUrl ? url.replace(`${baseUrl}/`, "") : url))
            .filter((k) => k.length > 0 && !k.startsWith("http"));
          if (keys.length > 0) await deleteR2Objects(keys);
        }
      }

      const guide = await prisma.sizeGuide.update({
        where: { id: req.params.guideId },
        data: body,
      });
      await audit({
        adminId: req.user.sub,
        action: "size_guide.updated",
        resourceType: "size_guide",
        resourceId: guide.id,
      });
      return reply.send(guide);
    },
  });

  fastify.delete<{ Params: { guideId: string } }>("/guides/:guideId", {
    preHandler: [fastify.requirePermission(Permissions.SIZES_EDIT)],
    schema: {
      tags: ["Admin Sizes"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a size guide. Returns 409 if any products reference it.",
      params: {
        type: "object",
        required: ["guideId"],
        properties: { guideId: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Guide deleted" },
        409: {
          description: "Guide referenced by products",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const existing = await prisma.sizeGuide.findUnique({
        where: { id: req.params.guideId },
      });
      if (!existing)
        return reply.status(404).send({ error: "Guia não encontrado" });

      const count = await prisma.product.count({
        where: { sizeGuideId: req.params.guideId },
      });
      if (count > 0)
        return reply.status(409).send({
          error: `Não é possível eliminar: ${count} produto(s) referenciam este guia`,
        });

      // Delete all guide images from R2
      const images = (existing.images as Array<{ url: string }>) ?? [];
      if (images.length > 0) {
        const baseUrl = process.env["R2_PUBLIC_URL"] ?? "";
        const keys = images
          .map((img) =>
            baseUrl ? img.url.replace(`${baseUrl}/`, "") : img.url,
          )
          .filter((k) => k.length > 0 && !k.startsWith("http"));
        if (keys.length > 0) await deleteR2Objects(keys);
      }

      await prisma.sizeGuide.delete({ where: { id: req.params.guideId } });
      return reply.status(204).send();
    },
  });
}
