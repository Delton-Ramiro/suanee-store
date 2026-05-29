import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  ReorderSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";

import { offsetPaginate } from "../../../lib/utils.js";

const CollectionListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const CollectionProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  view: z.enum(["all", "available", "importation", "draft"]).default("all"),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminCollectionsRoutes(fastify: FastifyInstance) {
  // GET /admin/collections — paginated list with optional search
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description:
        "List product collections with optional pagination and search.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20 },
          search: { type: "string" },
          isActive: { type: "boolean" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
        },
      },
      response: {
        200: {
          description: "Collection list",
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
      const q = CollectionListQuery.parse(req.query);
      const where: Prisma.CollectionWhereInput = {
        ...(q.search
          ? { name: { contains: q.search, mode: "insensitive" as const } }
          : {}),
        ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
      };
      const [total, collections] = await Promise.all([
        prisma.collection.count({ where }),
        prisma.collection.findMany({
          where,
          orderBy: { position: q.sortOrder },
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          include: { _count: { select: { products: true } } },
        }),
      ]);
      return reply.send(offsetPaginate(collections, total, q.page, q.limit));
    },
  });

  // GET /admin/collections/next-position — returns next available position for a group
  fastify.get("/next-position", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns the next available position for a collection group (categoryId = null → global; categoryId = uuid → category-scoped).",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "string", format: "uuid" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { nextPosition: { type: "integer" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { categoryId } = z
        .object({ categoryId: z.string().uuid().optional() })
        .parse(req.query);

      const last = await prisma.collection.findFirst({
        where: { categoryId: categoryId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      return reply.send({ nextPosition: (last?.position ?? -1) + 1 });
    },
  });

  // GET /admin/collections/:id — single collection
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description: "Get a single collection by ID.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Collection detail", type: "object" },
        404: {
          description: "Not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const collection = await prisma.collection.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { products: true } } },
      });
      if (!collection)
        return reply.status(404).send({ error: "Collection not found" });
      return reply.send(collection);
    },
  });

  // GET /admin/collections/:id/products — products in collection
  fastify.get<{ Params: { id: string } }>("/:id/products", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description: "List products belonging to a collection with filters.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20 },
          view: {
            type: "string",
            enum: ["all", "available", "importation", "draft"],
            default: "all",
          },
          search: { type: "string" },
          sortBy: {
            type: "string",
            enum: ["createdAt", "name"],
            default: "createdAt",
          },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      },
      response: {
        200: {
          description: "Products in collection",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        404: {
          description: "Collection not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const q = CollectionProductsQuery.parse(req.query);
      const collectionExists = await prisma.collection.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!collectionExists)
        return reply.status(404).send({ error: "Collection not found" });

      const where: Prisma.ProductWhereInput = {
        collections: { some: { collectionId: req.params.id } },
        ...(q.view === "available" ? { stockStatus: "in_stock" } : {}),
        ...(q.view === "importation" ? { stockStatus: "by_importation" } : {}),
        ...(q.view === "draft" ? { status: "draft" } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" as const } },
                { id: { contains: q.search } },
              ],
            }
          : {}),
      };

      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { [q.sortBy]: q.sortOrder },
          include: {
            brand: { select: { id: true, name: true } },
            media: {
              select: { url: true, mediaType: true },
              orderBy: { position: "asc" },
              take: 1,
            },
          },
        }),
      ]);

      return reply.send(offsetPaginate(products, total, q.page, q.limit));
    },
  });

  // POST /admin/collections/:id/products — add products to collection
  fastify.post<{ Params: { id: string } }>("/:id/products", {
    preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description: "Add one or more products to a collection.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["productIds"],
        properties: {
          productIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            minItems: 1,
          },
        },
      },
      response: {
        200: {
          description: "Products added",
          type: "object",
          properties: { count: { type: "integer" } },
        },
        404: {
          description: "Collection not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { productIds } = z
        .object({ productIds: z.array(z.string().uuid()).min(1) })
        .parse(req.body);

      const collectionExists = await prisma.collection.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!collectionExists)
        return reply.status(404).send({ error: "Collection not found" });

      const result = await prisma.productCollection.createMany({
        data: productIds.map((productId) => ({
          productId,
          collectionId: req.params.id,
        })),
        skipDuplicates: true,
      });

      await audit({
        adminId: req.user.sub,
        action: "collection.products_added",
        resourceType: "collection",
        resourceId: req.params.id,
        after: { productIds },
      });
      return reply.send({ count: result.count });
    },
  });

  // DELETE /admin/collections/:id/products/:productId — remove a product from collection
  fastify.delete<{ Params: { id: string; productId: string } }>(
    "/:id/products/:productId",
    {
      preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
      schema: {
        tags: ["Admin Collections"],
        security: [{ bearerAuth: [] }],
        description: "Remove a product from a collection.",
        params: {
          type: "object",
          required: ["id", "productId"],
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: { description: "Product removed from collection" },
          404: {
            description: "Not found",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        const existing = await prisma.productCollection.findUnique({
          where: {
            productId_collectionId: {
              productId: req.params.productId,
              collectionId: req.params.id,
            },
          },
        });
        if (!existing)
          return reply.status(404).send({ error: "Product not in collection" });

        await prisma.productCollection.delete({
          where: {
            productId_collectionId: {
              productId: req.params.productId,
              collectionId: req.params.id,
            },
          },
        });
        await audit({
          adminId: req.user.sub,
          action: "collection.product_removed",
          resourceType: "collection",
          resourceId: req.params.id,
          after: { productId: req.params.productId },
        });
        return reply.status(204).send();
      },
    },
  );

  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description: "Create a new product collection.",
      body: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string", example: "Summer 2025" },
          slug: { type: "string", example: "summer-2025" },
          coverImageUrl: { type: "string", nullable: true },
          position: { type: "integer", default: 0 },
          isActive: { type: "boolean", default: true },
          categoryId: { type: "string", format: "uuid", nullable: true },
        },
      },
      response: {
        201: { description: "Collection created", type: "object" },
        400: {
          description: "Invalid categoryId",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Position already occupied",
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
      const body = CreateCollectionSchema.parse(req.body);

      if (body.categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: body.categoryId },
          select: { id: true, level: true },
        });
        if (!cat)
          return reply.status(400).send({ error: "Categoria não encontrada" });
        if (cat.level !== 0)
          return reply.status(400).send({
            error:
              "Apenas categorias de primeiro nível podem ser associadas a coleções",
          });
      }

      // Duplicate position check within the same group
      const positionConflict = await prisma.collection.findFirst({
        where: { position: body.position ?? 0, categoryId: body.categoryId ?? null },
        select: { id: true, name: true },
      });
      if (positionConflict)
        return reply.status(409).send({
          error: `Posição ${body.position ?? 0} já está ocupada pela coleção "${positionConflict.name}". Escolha outro índice.`,
        });

      const collection = await prisma.collection.create({ data: body });
      await audit({
        adminId: req.user.sub,
        action: "collection.created",
        resourceType: "collection",
        resourceId: collection.id,
        after: body,
      });
      return reply.status(201).send(collection);
    },
  });

  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description: "Update a collection.",
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
          imageUrl: { type: "string", nullable: true },
          position: { type: "integer" },
          categoryId: { type: "string", format: "uuid", nullable: true },
        },
      },
      response: {
        200: { description: "Collection updated", type: "object" },
        400: {
          description: "Invalid categoryId",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Position already occupied",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Collection not found",
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
      const body = UpdateCollectionSchema.parse(req.body);

      if (body.categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: body.categoryId },
          select: { id: true, level: true },
        });
        if (!cat)
          return reply.status(400).send({ error: "Categoria não encontrada" });
        if (cat.level !== 0)
          return reply
            .status(400)
            .send({
              error:
                "Apenas categorias de nível 0 podem ser associadas a coleções",
            });
      }

      const before = await prisma.collection.findUnique({
        where: { id: req.params.id },
      });
      if (!before)
        return reply.status(404).send({ error: "Collection not found" });

      // Resolve effective values after the patch
      const effectivePosition = body.position !== undefined ? body.position : before.position;
      const effectiveCategoryId =
        body.categoryId !== undefined ? body.categoryId : before.categoryId;

      // Duplicate position check — only if position or group is changing
      const positionChanging = effectivePosition !== before.position || effectiveCategoryId !== before.categoryId;
      if (positionChanging) {
        const positionConflict = await prisma.collection.findFirst({
          where: {
            position: effectivePosition,
            categoryId: effectiveCategoryId ?? null,
            NOT: { id: req.params.id },
          },
          select: { id: true, name: true },
        });
        if (positionConflict)
          return reply.status(409).send({
            error: `Posição ${effectivePosition} já está ocupada pela coleção "${positionConflict.name}". Escolha outro índice.`,
          });
      }

      const collection = await prisma.collection.update({
        where: { id: req.params.id },
        data: body,
      });

      await audit({
        adminId: req.user.sub,
        action: "collection.updated",
        resourceType: "collection",
        resourceId: collection.id,
        before,
        after: body,
      });
      return reply.send(collection);
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a collection. Products that belong to this collection are not deleted; they simply lose the association.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Collection deleted" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      await prisma.productCollection.deleteMany({
        where: { collectionId: req.params.id },
      });
      await prisma.collection.delete({ where: { id: req.params.id } });

      await audit({
        adminId: req.user.sub,
        action: "collection.deleted",
        resourceType: "collection",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });

  fastify.patch("/reorder", {
    preHandler: [fastify.requirePermission(Permissions.COLLECTIONS_EDIT)],
    schema: {
      tags: ["Admin Collections"],
      security: [{ bearerAuth: [] }],
      description:
        "Reorder collections by providing an ordered array of collection IDs.",
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
          prisma.collection.update({ where: { id }, data: { position } }),
        ),
      );
      return reply.send({ success: true });
    },
  });
}
