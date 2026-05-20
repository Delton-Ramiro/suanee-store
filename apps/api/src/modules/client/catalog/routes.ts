import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { getCategoryDescendantIds } from "../../../lib/category-tree.js";
import { redis, CacheKeys, cacheGet, cacheSet } from "../../../lib/redis.js";
import { decodeCursor, paginate } from "../../../lib/utils.js";

const ProductListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  colorIds: z.string().optional(),
  sizeIds: z.string().optional(),
  filters: z.string().optional(), // JSON string: {attrDefId: [optionId,...]}
});

export default async function clientCatalogRoutes(fastify: FastifyInstance) {
  // GET /catalog/categories — full public tree (cached)
  fastify.get("/categories", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns the full active category tree (3 levels deep). Response is cached for 5 minutes.",
      response: {
        200: {
          description: "Category tree",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const cacheKey = CacheKeys.categoryTree();
      const cached = await cacheGet<unknown>(cacheKey);
      if (cached) return reply.send(cached);

      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ level: "asc" }, { position: "asc" }],
        include: {
          children: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            include: {
              children: {
                where: { isActive: true },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      });

      const tree = categories.filter((c) => c.level === 0);
      await cacheSet(cacheKey, tree, 300);
      return reply.send(tree);
    },
  });

  // GET /catalog/categories/:slug — category info + subcategories
  fastify.get<{ Params: { slug: string } }>("/categories/:slug", {
    schema: {
      tags: ["Catalog"],
      description:
        "Get a single category by slug, including its immediate children and parent.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "sapatos" } },
      },
      response: {
        200: { description: "Category detail", type: "object" },
        404: {
          description: "Category not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const category = await prisma.category.findFirst({
        where: { slug: req.params.slug, isActive: true },
        include: {
          children: { where: { isActive: true }, orderBy: { position: "asc" } },
          parent: true,
        },
      });
      if (!category)
        return reply.status(404).send({ error: "Category not found" });
      return reply.send(category);
    },
  });

  // GET /catalog/categories/:slug/filters — dynamic filter spec for the category
  fastify.get<{ Params: { slug: string } }>("/categories/:slug/filters", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns the available attribute filters, colors, and sizes for a given category slug.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "sapatos" } },
      },
      response: {
        200: {
          description: "Filter options",
          type: "object",
          properties: {
            filters: { type: "array", items: { type: "object" } },
            colors: { type: "array", items: { type: "object" } },
            sizes: { type: "array", items: { type: "object" } },
          },
        },
        404: {
          description: "Category not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const category = await prisma.category.findFirst({
        where: { slug: req.params.slug },
      });
      if (!category)
        return reply.status(404).send({ error: "Category not found" });

      // Collect all ancestor IDs including self
      const categoryIds: string[] = [category.id];
      if (category.parentId) {
        categoryIds.push(category.parentId);
        const grandparent = await prisma.category.findUnique({
          where: { id: category.parentId },
        });
        if (grandparent?.parentId) categoryIds.push(grandparent.parentId);
      }

      const filters = await prisma.attributeDefinition.findMany({
        where: {
          categories: { some: { categoryId: { in: categoryIds } } },
          isActive: true,
        },
        include: { options: { orderBy: { label: "asc" } } },
        orderBy: { name: "asc" },
      });

      const colors = await prisma.color.findMany({ orderBy: { name: "asc" } });
      const sizes = await prisma.size.findMany({
        where: {
          sizeCategories: { some: { categoryId: { in: categoryIds } } },
        },
        orderBy: { position: "asc" },
      });

      return reply.send({ filters, colors, sizes });
    },
  });

  // GET /catalog/categories/:slug/products — paginated product listing
  fastify.get<{ Params: { slug: string } }>("/categories/:slug/products", {
    schema: {
      tags: ["Catalog"],
      description:
        "Paginated product listing for a category (includes all descendants). Supports cursor-based pagination and filtering by brand, price, color, and size.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "sapatos" } },
      },
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string", description: "Opaque pagination cursor" },
          limit: { type: "integer", default: 24 },
          sort: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc"],
            default: "newest",
          },
          brand: { type: "string", description: "Brand ID" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          colorIds: {
            type: "string",
            description: "Comma-separated color IDs",
          },
          sizeIds: { type: "string", description: "Comma-separated size IDs" },
          filters: { type: "string", description: "JSON attribute filter map" },
        },
      },
      response: {
        200: {
          description: "Paged products",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
            total: { type: "integer" },
          },
        },
        404: {
          description: "Category not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const parsed = ProductListQuery.safeParse(req.query);
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0]?.message ?? "Invalid query" });
      const q = parsed.data;
      const category = await prisma.category.findFirst({
        where: { slug: req.params.slug },
      });
      if (!category)
        return reply.status(404).send({ error: "Category not found" });

      // Gather all descendant category IDs
      const descendantIds = await getCategoryDescendantIds(category.id);
      const categoryIds = [category.id, ...descendantIds];

      const colorIds = q.colorIds?.split(",").filter(Boolean) ?? [];
      const sizeIds = q.sizeIds?.split(",").filter(Boolean) ?? [];

      const orderBy =
        q.sort === "price_asc"
          ? { basePrice: "asc" as const }
          : q.sort === "price_desc"
            ? { basePrice: "desc" as const }
            : { createdAt: "desc" as const };

      const productWhere = {
        status: "published" as const,
        isVisible: true,
        categories: { some: { categoryId: { in: categoryIds } } },
        ...(q.brand ? { brandId: q.brand } : {}),
        ...(q.minPrice || q.maxPrice
          ? {
              basePrice: {
                ...(q.minPrice ? { gte: q.minPrice } : {}),
                ...(q.maxPrice ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(colorIds.length
          ? { variants: { some: { colorId: { in: colorIds } } } }
          : {}),
        ...(sizeIds.length
          ? { sizes: { some: { sizeId: { in: sizeIds } } } }
          : {}),
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          take: q.limit + 1,
          ...(q.cursor
            ? { cursor: { id: decodeCursor(q.cursor) }, skip: 1 }
            : {}),
          where: productWhere,
          orderBy,
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            hasDiscount: true,
            discountPrice: true,
            stockStatus: true,
            brand: { select: { id: true, name: true, slug: true } },
            media: {
              take: 1,
              orderBy: { position: "asc" as const },
              select: { id: true, url: true, mediaType: true },
            },
            variants: {
              take: 10,
              select: {
                id: true,
                color: { select: { id: true, name: true, hexCode: true } },
              },
            },
          },
        }),
        prisma.product.count({ where: productWhere }),
      ]);

      const { items, nextCursor } = paginate(products, q.limit);
      return reply.send({ items, nextCursor, total });
    },
  });

  // GET /catalog/brands
  fastify.get("/brands", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns all active brands with their associated categories. Response is cached for 5 minutes.",
      response: {
        200: {
          description: "Brands list",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const cacheKey = CacheKeys.brandList();
      const cached = await cacheGet<unknown>(cacheKey);
      if (cached) return reply.send(cached);

      const brands = await prisma.brand.findMany({
        orderBy: { name: "asc" },
        include: {
          brandCategories: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
      await cacheSet(cacheKey, brands, 300);
      return reply.send(brands);
    },
  });

  // GET /catalog/products/:slug — product detail
  fastify.get<{ Params: { slug: string } }>("/products/:slug", {
    schema: {
      tags: ["Catalog"],
      description:
        "Get full product detail by slug, including variants, media, categories, sizes, and attributes.",
      params: {
        type: "object",
        required: ["slug"],
        properties: {
          slug: { type: "string", example: "camiseta-branca-stripe" },
        },
      },
      response: {
        200: { description: "Product detail", type: "object" },
        404: {
          description: "Product not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const product = await prisma.product.findFirst({
        where: { slug: req.params.slug, status: "published", isVisible: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          basePrice: true,
          isIndicativePrice: true,
          hasDiscount: true,
          discountPrice: true,
          stockStatus: true,
          genderScope: true,
          keyCharacteristics: true,
          productInfo: true,
          sendPolicy: true,
          returnPolicy: true,
          metaTitle: true,
          metaDescription: true,
          createdAt: true,
          brand: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          collections: { select: { collectionId: true } },
          sizeGuide: {
            select: { id: true, name: true, description: true, images: true },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  level: true,
                  parentId: true,
                },
              },
            },
          },
          media: {
            where: { isDeleted: false } as never,
            select: {
              id: true,
              url: true,
              mediaType: true,
              colorId: true,
              position: true,
              isPrimary: true,
            },
            orderBy: { position: "asc" },
          },
          variants: {
            select: {
              id: true,
              sku: true,
              stockQuantity: true,
              price: true,
              hasDiscount: true,
              discountPrice: true,
              isIndicativePrice: true,
              color: {
                select: { id: true, name: true, hexCode: true, slug: true },
              },
              size: {
                select: { id: true, name: true, label: true, sizeSystem: true },
              },
            },
            orderBy: { position: "asc" },
          },
          sizes: {
            select: {
              size: {
                select: { id: true, name: true, label: true, sizeSystem: true },
              },
            },
          },
          attributes: {
            select: {
              definition: { select: { id: true, name: true, inputType: true } },
              option: { select: { id: true, label: true, value: true } },
            },
          },
        },
      });

      if (!product)
        return reply.status(404).send({ error: "Product not found" });
      return reply.send(product);
    },
  });

  // GET /catalog/products/:slug/similar
  fastify.get<{ Params: { slug: string } }>("/products/:slug/similar", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns up to 12 products from the same category or brand as the given product.",
      params: {
        type: "object",
        required: ["slug"],
        properties: {
          slug: { type: "string", example: "camiseta-branca-stripe" },
        },
      },
      response: {
        200: {
          description: "Similar products",
          type: "array",
          items: { type: "object" },
        },
        404: {
          description: "Product not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const product = await prisma.product.findFirst({
        where: { slug: req.params.slug },
        include: { categories: { take: 1 }, brand: true },
      });
      if (!product)
        return reply.status(404).send({ error: "Product not found" });

      const categoryId = product.categories[0]?.categoryId;
      const similar = await prisma.product.findMany({
        where: {
          id: { not: product.id },
          status: "published",
          isVisible: true,
          OR: [
            ...(categoryId ? [{ categories: { some: { categoryId } } }] : []),
            { brandId: product.brandId ?? undefined },
          ],
        },
        take: 12,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          hasDiscount: true,
          discountPrice: true,
          stockStatus: true,
          brand: { select: { id: true, name: true, slug: true } },
          media: {
            take: 1,
            orderBy: { position: "asc" as const },
            select: { id: true, url: true, mediaType: true },
          },
          variants: {
            take: 10,
            select: {
              id: true,
              color: { select: { id: true, name: true, hexCode: true } },
            },
          },
        },
      });
      return reply.send(similar);
    },
  });

  // GET /catalog/collections — public collections list (cached)
  fastify.get("/collections", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns all active collections ordered by position. Cached for 5 minutes.",
      response: {
        200: {
          description: "Collections list",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const cacheKey = CacheKeys.collectionList();
      const cached = await cacheGet<unknown>(cacheKey);
      if (cached) return reply.send(cached);

      const collections = await prisma.collection.findMany({
        orderBy: { position: "asc" },
      });
      await cacheSet(cacheKey, collections, 300);
      return reply.send(collections);
    },
  });

  // GET /catalog/collections/:slug/products
  fastify.get<{ Params: { slug: string } }>("/collections/:slug/products", {
    schema: {
      tags: ["Catalog"],
      description:
        "Paginated product listing for a collection. Supports the same filters as category product listing.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "verao-2025" } },
      },
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", default: 24 },
          sort: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc"],
            default: "newest",
          },
          brand: { type: "string" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          colorIds: { type: "string" },
          sizeIds: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Paged products",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
            total: { type: "integer" },
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
      const parsed = ProductListQuery.safeParse(req.query);
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0]?.message ?? "Invalid query" });
      const q = parsed.data;
      const collection = await prisma.collection.findFirst({
        where: { slug: req.params.slug },
      });
      if (!collection)
        return reply.status(404).send({ error: "Collection not found" });

      const colorIds = q.colorIds?.split(",").filter(Boolean) ?? [];
      const sizeIds = q.sizeIds?.split(",").filter(Boolean) ?? [];
      const orderBy =
        q.sort === "price_asc"
          ? { basePrice: "asc" as const }
          : q.sort === "price_desc"
            ? { basePrice: "desc" as const }
            : { createdAt: "desc" as const };

      const collectionWhere = {
        collections: { some: { collectionId: collection.id } },
        status: "published" as const,
        isVisible: true,
        ...(q.brand ? { brandId: q.brand } : {}),
        ...(q.minPrice || q.maxPrice
          ? {
              basePrice: {
                ...(q.minPrice ? { gte: q.minPrice } : {}),
                ...(q.maxPrice ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(colorIds.length
          ? { variants: { some: { colorId: { in: colorIds } } } }
          : {}),
        ...(sizeIds.length
          ? { sizes: { some: { sizeId: { in: sizeIds } } } }
          : {}),
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          take: q.limit + 1,
          ...(q.cursor
            ? { cursor: { id: decodeCursor(q.cursor) }, skip: 1 }
            : {}),
          where: collectionWhere,
          orderBy,
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            hasDiscount: true,
            discountPrice: true,
            stockStatus: true,
            brand: { select: { id: true, name: true, slug: true } },
            media: {
              take: 1,
              orderBy: { position: "asc" as const },
              select: { id: true, url: true, mediaType: true },
            },
            variants: {
              take: 10,
              select: {
                id: true,
                color: { select: { id: true, name: true, hexCode: true } },
              },
            },
          },
        }),
        prisma.product.count({ where: collectionWhere }),
      ]);

      const { items, nextCursor } = paginate(products, q.limit);
      return reply.send({ items, nextCursor, total });
    },
  });
}
