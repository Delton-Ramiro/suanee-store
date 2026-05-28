import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { getCategoryDescendantIds } from "../../../lib/category-tree.js";
import { deleteR2Objects } from "../../../lib/r2.js";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  ReorderSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { cacheDelPattern } from "../../../lib/redis.js";
import { offsetPaginate } from "../../../lib/utils.js";

const CategoryProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  view: z
    .enum(["all", "available", "importation", "draft", "subcategories"])
    .default("all"),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

type PositionScopeInput = {
  level: number;
  parentId: string | null;
  position: number;
  excludeId?: string;
};

type CategoryValidationError = {
  status: 404 | 409 | 422;
  error: string;
};

export default async function adminCategoriesRoutes(fastify: FastifyInstance) {
  async function ensureParentHierarchy(
    level: number,
    parentId: string | null,
  ): Promise<CategoryValidationError | null> {
    if (level === 0) {
      if (parentId) {
        return {
          status: 422,
          error: "A level 0 category cannot have a parent",
        };
      }
      return null;
    }

    if (!parentId) {
      return {
        status: 422,
        error: `A level ${level} category must have a parent`,
      };
    }

    const parent = await prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      return { status: 404, error: "Parent category not found" };
    }

    if (parent.level !== level - 1) {
      return {
        status: 422,
        error: `A level ${level} category must have a level ${level - 1} parent`,
      };
    }

    return null;
  }

  async function ensurePositionAvailable({
    level,
    parentId,
    position,
    excludeId,
  }: PositionScopeInput): Promise<CategoryValidationError | null> {
    if (position < 1) {
      return {
        status: 422,
        error: "Índice de exibição deve ser maior ou igual a 1.",
      };
    }

    const conflict = await prisma.category.findFirst({
      where: {
        level,
        parentId,
        position,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        status: 409,
        error:
          "Índice de exibição já ocupado para este nível e parente. Escolha outro índice.",
      };
    }

    return null;
  }

  // GET /admin/categories — full tree
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns the full category tree (root categories with nested children). When a search query is provided, returns matching categories from all levels without nesting.",
      querystring: {
        type: "object",
        properties: {
          search: { type: "string", description: "Filter by category name" },
          level: {
            type: "integer",
            minimum: 0,
            maximum: 2,
            description:
              "Return a flat list of categories at this level (0=principal, 1=secondary, 2=tertiary)",
          },
        },
      },
      response: {
        200: {
          description: "Category tree",
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
    handler: async (req, reply) => {
      const { search, level } = z
        .object({
          search: z.string().optional(),
          level: z.coerce.number().int().min(0).max(2).optional(),
        })
        .parse(req.query);

      // When level is specified: return flat list filtered by level
      if (level !== undefined) {
        const cats = await prisma.category.findMany({
          orderBy: { position: "asc" },
          where: {
            level,
            ...(search
              ? { name: { contains: search, mode: "insensitive" as const } }
              : {}),
          },
        });
        return reply.send(cats);
      }

      const categories = await prisma.category.findMany({
        orderBy: { position: "asc" },
        where: {
          // BUG-9: When searching, include all levels. When not searching, show only root.
          ...(search ? {} : { parentId: null }),
          ...(search
            ? { name: { contains: search, mode: "insensitive" } }
            : {}),
        },
        include: {
          children: {
            orderBy: { position: "asc" },
            include: { children: { orderBy: { position: "asc" } } },
          },
        },
      });
      return reply.send(categories);
    },
  });

  // POST /admin/categories
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.CATEGORIES_EDIT)],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new category. Level 1 categories are top-level. Level 2 and 3 require a valid parentId whose level is exactly one less.",
      body: {
        type: "object",
        required: ["name", "slug", "level"],
        properties: {
          name: { type: "string", example: "Footwear" },
          slug: { type: "string", example: "footwear" },
          level: { type: "integer", minimum: 0, maximum: 2, example: 0 },
          parentId: { type: "string", format: "uuid", nullable: true },
          position: { type: "integer", minimum: 1, example: 1 },
          imageUrl: { type: "string", nullable: true },
          genderScope: {
            type: "string",
            enum: ["women", "men", "kids", "unisex"],
            nullable: true,
          },
          isActive: { type: "boolean", default: true },
        },
      },
      response: {
        201: { description: "Category created", type: "object" },
        404: {
          description: "Parent category not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        422: {
          description: "Invalid parent level",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Position already occupied in this scope",
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
      const body = CreateCategorySchema.parse(req.body);
      const parentId = body.parentId ?? null;

      const hierarchyError = await ensureParentHierarchy(body.level, parentId);
      if (hierarchyError) {
        return reply
          .status(hierarchyError.status)
          .send({ error: hierarchyError.error });
      }

      const positionError = await ensurePositionAvailable({
        level: body.level,
        parentId,
        position: body.position,
      });
      if (positionError) {
        return reply
          .status(positionError.status)
          .send({ error: positionError.error });
      }

      const category = await prisma.category.create({ data: body });
      await cacheDelPattern("categories:*");
      await audit({
        adminId: req.user.sub,
        action: "category.created",
        resourceType: "category",
        resourceId: category.id,
        after: body,
      });
      return reply.status(201).send(category);
    },
  });

  // PATCH /admin/categories/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.CATEGORIES_EDIT)],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description: "Update a category's properties.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          level: { type: "integer", minimum: 0, maximum: 2 },
          parentId: { type: "string", format: "uuid", nullable: true },
          name: { type: "string" },
          slug: { type: "string" },
          position: { type: "integer", minimum: 1 },
          imageUrl: { type: "string", nullable: true },
          genderScope: {
            type: "string",
            enum: ["women", "men", "kids", "unisex"],
            nullable: true,
          },
          isActive: { type: "boolean" },
        },
      },
      response: {
        200: { description: "Category updated", type: "object" },
        404: {
          description: "Not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        409: {
          description: "Position already occupied in this scope",
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
      const body = UpdateCategorySchema.parse(req.body);
      const before = await prisma.category.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Not found" });

      const nextLevel = body.level ?? before.level;
      const nextParentId =
        body.parentId === undefined ? before.parentId : (body.parentId ?? null);
      const nextPosition = body.position ?? before.position;

      const hierarchyError = await ensureParentHierarchy(
        nextLevel,
        nextParentId,
      );
      if (hierarchyError) {
        return reply
          .status(hierarchyError.status)
          .send({ error: hierarchyError.error });
      }

      const positionError = await ensurePositionAvailable({
        level: nextLevel,
        parentId: nextParentId,
        position: nextPosition,
        excludeId: before.id,
      });
      if (positionError) {
        return reply
          .status(positionError.status)
          .send({ error: positionError.error });
      }

      // Delete old R2 image when it is being replaced with a different one
      if (
        body.imageUrl !== undefined &&
        before.imageUrl &&
        before.imageUrl !== body.imageUrl
      ) {
        try {
          const key = new URL(before.imageUrl).pathname.replace(/^\//, "");
          await deleteR2Objects([key]).catch(() => undefined);
        } catch {
          // invalid URL — skip silently
        }
      }

      const category = await prisma.category.update({
        where: { id: req.params.id },
        data: body,
      });
      await cacheDelPattern("categories:*");
      await audit({
        adminId: req.user.sub,
        action: "category.updated",
        resourceType: "category",
        resourceId: category.id,
        before,
        after: body,
      });
      return reply.send(category);
    },
  });

  // DELETE /admin/categories/:id — blocked if products exist
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.CATEGORIES_EDIT)],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a category. Returns 409 if any products are assigned to it or if it has subcategories.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Category deleted" },
        409: {
          description: "Category has products or subcategories",
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
      const count = await prisma.productCategory.count({
        where: { categoryId: req.params.id },
      });
      if (count > 0) {
        return reply.status(409).send({
          error: `Cannot delete: ${count} products are assigned to this category`,
        });
      }
      const childCount = await prisma.category.count({
        where: { parentId: req.params.id },
      });
      if (childCount > 0) {
        return reply.status(409).send({
          error: `Cannot delete: category has ${childCount} subcategories`,
        });
      }
      await prisma.category.delete({ where: { id: req.params.id } });
      await cacheDelPattern("categories:*");
      await audit({
        adminId: req.user.sub,
        action: "category.deleted",
        resourceType: "category",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });

  // PATCH /admin/categories/reorder
  fastify.patch("/reorder", {
    preHandler: [fastify.requirePermission(Permissions.CATEGORIES_EDIT)],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "Reorder categories by providing an ordered array of category IDs. Updates the position field accordingly.",
      body: {
        type: "object",
        required: ["orderedIds"],
        properties: {
          orderedIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            description: "IDs in desired order",
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
          prisma.category.update({ where: { id }, data: { position } }),
        ),
      );
      await cacheDelPattern("categories:*");
      return reply.send({ success: true });
    },
  });

  // GET /admin/categories/:id — single category with parent chain and children
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "Get a single category by ID, including parent chain (up to grandparent) and direct children with product counts.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Category detail", type: "object" },
        404: {
          description: "Not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const category = await prisma.category.findUnique({
        where: { id: req.params.id },
        include: {
          parent: { include: { parent: true } },
          children: {
            orderBy: { position: "asc" },
            include: {
              _count: { select: { products: true } },
              children: { orderBy: { position: "asc" } },
            },
          },
          _count: { select: { products: true } },
        },
      });
      if (!category) return reply.status(404).send({ error: "Not found" });
      return reply.send(category);
    },
  });

  // GET /admin/categories/:id/products — products in this category with filters
  fastify.get<{ Params: { id: string } }>("/:id/products", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Categories"],
      security: [{ bearerAuth: [] }],
      description:
        "List products belonging to a category and all its descendants. Supports 'subcategories' view which returns child categories instead of products.",
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
            enum: ["all", "available", "importation", "draft", "subcategories"],
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
          description: "Products or subcategories in this category",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
            subcategories: {
              type: "array",
              items: { type: "object" },
              description: "Only present when view=subcategories",
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
      const q = CategoryProductsQuery.parse(req.query);

      // Collect this category + all descendants
      const descendantIds = await getCategoryDescendantIds(req.params.id);
      const categoryIds = [req.params.id, ...descendantIds];

      if (q.view === "subcategories") {
        const subcategories = await prisma.category.findMany({
          where: { parentId: req.params.id },
          orderBy: { position: "asc" },
          include: { _count: { select: { products: true } } },
        });

        // _count.products only counts direct assignments; use descendant-aware
        // counts so numbers match what the Products tab shows for each child.
        const subcategoryIds = subcategories.map((sub) => sub.id);
        const counts =
          subcategoryIds.length === 0
            ? []
            : await prisma.$queryRaw<
                { rootId: string; productCount: number }[]
              >(Prisma.sql`
                WITH RECURSIVE category_tree AS (
                  SELECT c.id, c.id AS "rootId"
                  FROM categories c
                  WHERE c.id IN (${Prisma.join(subcategoryIds)})

                  UNION ALL

                  SELECT c2.id, ct."rootId"
                  FROM categories c2
                  INNER JOIN category_tree ct ON c2."parentId" = ct.id
                )
                SELECT
                  ct."rootId",
                  COUNT(DISTINCT pc."productId")::int AS "productCount"
                FROM category_tree ct
                LEFT JOIN product_categories pc ON pc."categoryId" = ct.id
                GROUP BY ct."rootId"
              `);

        const countByRootId = new Map(
          counts.map((row) => [row.rootId, row.productCount]),
        );

        const subcatsWithCounts = subcategories.map((sub) => ({
          ...sub,
          _count: { products: countByRootId.get(sub.id) ?? 0 },
        }));

        return reply.send({ subcategories: subcatsWithCounts });
      }

      const where: Prisma.ProductWhereInput = {
        categories: { some: { categoryId: { in: categoryIds } } },
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
          include: { brand: { select: { name: true } } },
        }),
      ]);

      return reply.send(offsetPaginate(products, total, q.page, q.limit));
    },
  });
}
