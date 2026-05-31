import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { getCategoryDescendantIds } from "../../../lib/category-tree.js";
import { CacheKeys, cacheGet, cacheSet } from "../../../lib/redis.js";
import { offsetPaginate } from "../../../lib/utils.js";

const ProductListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  /** Comma-separated brand IDs */
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  /** Comma-separated color IDs */
  color: z.string().optional(),
  /** Comma-separated size IDs */
  size: z.string().optional(),
  /** Comma-separated child-category slugs to restrict search to specific sub-categories */
  subcats: z.string().optional(),
  // attr-{attrDefId}=optId1,optId2 params are parsed separately from raw query
});

export default async function clientCatalogRoutes(fastify: FastifyInstance) {
  // GET /catalog/categories — full public tree (cached)
  fastify.get("/categories", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns the full active category tree (3 levels deep), ordered by position. Response is cached for 5 minutes.",
      querystring: {
        type: "object",
        properties: {
          orderBy: {
            type: "string",
            enum: ["position"],
            description:
              "Order root categories by this field (default: position)",
          },
        },
      },
      response: {
        200: {
          description: "Category tree ordered by position",
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
        "Returns the available attribute filters, colors, brands, and sizes for a given category slug.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "sapatos" } },
      },
      querystring: {
        type: "object",
        properties: {
          colorSearch: {
            type: "string",
            description:
              "Search term to filter colors by name (top 20 returned by default)",
          },
        },
      },
      response: {
        200: {
          description: "Filter options",
          type: "object",
          properties: {
            filters: { type: "array", items: { type: "object" } },
            colors: { type: "array", items: { type: "object" } },
            sizes: { type: "array", items: { type: "object" } },
            brands: { type: "array", items: { type: "object" } },
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
      const { colorSearch } = z
        .object({ colorSearch: z.string().optional() })
        .parse(req.query);

      const category = await prisma.category.findFirst({
        where: { slug: req.params.slug },
      });
      if (!category)
        return reply.status(404).send({ error: "Category not found" });

      // Collect self + all ancestor IDs for attribute/size/brand scoping
      const categoryIds: string[] = [category.id];
      if (category.parentId) {
        categoryIds.push(category.parentId);
        const grandparent = await prisma.category.findUnique({
          where: { id: category.parentId },
        });
        if (grandparent?.parentId) categoryIds.push(grandparent.parentId);
      }

      const [filters, colors, sizes, brands] = await Promise.all([
        prisma.attributeDefinition.findMany({
          where: {
            categories: { some: { categoryId: { in: categoryIds } } },
            isActive: true,
          },
          include: { options: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        }),
        prisma.color.findMany({
          where: colorSearch
            ? { name: { contains: colorSearch, mode: "insensitive" } }
            : undefined,
          orderBy: { name: "asc" },
          take: 20,
          select: { id: true, name: true, hexCode: true, slug: true },
        }),
        prisma.size.findMany({
          where: {
            sizeCategories: { some: { categoryId: { in: categoryIds } } },
          },
          orderBy: { position: "asc" },
          select: { id: true, name: true, label: true, sizeSystem: true },
        }),
        prisma.brand.findMany({
          where: {
            status: "published",
            brandCategories: { some: { categoryId: { in: categoryIds } } },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, logoUrl: true },
        }),
      ]);

      return reply.send({ filters, colors, sizes, brands });
    },
  });

  // GET /catalog/categories/:slug/products — paginated product listing
  fastify.get<{ Params: { slug: string } }>("/categories/:slug/products", {
    schema: {
      tags: ["Catalog"],
      description:
        "Offset-paginated product listing for a category (includes all descendants). Supports filtering by brand, price, color, size, and custom attributes via attr-{attrDefId}=optId1,optId2 query params.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "sapatos" } },
      },
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1 },
          limit: { type: "integer", default: 24 },
          sort: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc"],
            default: "newest",
          },
          brand: { type: "string", description: "Comma-separated brand IDs" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          color: { type: "string", description: "Comma-separated color IDs" },
          size: { type: "string", description: "Comma-separated size IDs" },
        },
        additionalProperties: true,
      },
      response: {
        200: {
          description: "Paged products",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
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
      let categoryIds = [category.id, ...descendantIds];

      // If specific sub-categories were requested, restrict to those slugs
      const subcatSlugs = q.subcats?.split(",").filter(Boolean) ?? [];
      if (subcatSlugs.length > 0) {
        const subcats = await prisma.category.findMany({
          where: { slug: { in: subcatSlugs }, id: { in: descendantIds } },
          select: { id: true },
        });
        if (subcats.length > 0) {
          const subDescendantGroups = await Promise.all(
            subcats.map((s) => getCategoryDescendantIds(s.id)),
          );
          categoryIds = [
            ...subcats.map((s) => s.id),
            ...subDescendantGroups.flat(),
          ];
        }
      }

      // Parse attribute filters: any query param prefixed with "attr-"
      // attr-{attrDefId}=optId1,optId2  →  [{attrDefId, optionIds[]}]
      const attrFilters: { attrDefId: string; optionIds: string[] }[] = [];
      for (const [key, value] of Object.entries(
        req.query as Record<string, unknown>,
      )) {
        if (key.startsWith("attr-") && typeof value === "string") {
          const attrDefId = key.slice(5); // strip "attr-" prefix
          const optionIds = value.split(",").filter(Boolean);
          if (attrDefId && optionIds.length > 0) {
            attrFilters.push({ attrDefId, optionIds });
          }
        }
      }

      const brandIds = q.brand?.split(",").filter(Boolean) ?? [];
      const colorIds = q.color?.split(",").filter(Boolean) ?? [];
      const sizeIds = q.size?.split(",").filter(Boolean) ?? [];

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
        ...(brandIds.length ? { brandId: { in: brandIds } } : {}),
        ...(q.minPrice !== undefined || q.maxPrice !== undefined
          ? {
              basePrice: {
                ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
                ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(colorIds.length
          ? { variants: { some: { colorId: { in: colorIds } } } }
          : {}),
        ...(sizeIds.length
          ? { sizes: { some: { sizeId: { in: sizeIds } } } }
          : {}),
        // Each attribute filter is an AND condition (product must satisfy all selected defs)
        // Within each def, options are OR (any matching option satisfies that filter)
        ...(attrFilters.length
          ? {
              AND: attrFilters.map(({ attrDefId, optionIds }) => ({
                attributes: {
                  some: {
                    attributeDefinitionId: attrDefId,
                    attributeOptionId: { in: optionIds },
                  },
                },
              })),
            }
          : {}),
      };

      const skip = (q.page - 1) * q.limit;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip,
          take: q.limit,
          where: productWhere,
          orderBy,
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            isIndicativePrice: true,
            hasDiscount: true,
            discountPrice: true,
            stockStatus: true,
            brand: { select: { id: true, name: true, slug: true } },
            // Return up to 6 main media items (not color-specific) for card slideshow
            media: {
              where: { colorId: null, isDeleted: false } as never,
              take: 6,
              orderBy: { position: "asc" as const },
              select: { id: true, url: true, mediaType: true, isPrimary: true },
            },
            // Fetch all color variants (deduplicated below)
            variants: {
              take: 40,
              orderBy: { position: "asc" as const },
              select: {
                colorId: true,
                color: { select: { id: true, name: true, hexCode: true } },
              },
            },
          },
        }),
        prisma.product.count({ where: productWhere }),
      ]);

      // Deduplicate variant colors per product
      const mappedProducts = products.map((p) => {
        const seen = new Set<string>();
        const variants = p.variants.filter((v) => {
          if (!v.colorId || seen.has(v.colorId)) return false;
          seen.add(v.colorId);
          return true;
        });
        return { ...p, variants };
      });

      return reply.send(offsetPaginate(mappedProducts, total, q.page, q.limit));
    },
  });

  // GET /catalog/brands
  fastify.get("/brands", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns brands. Pass ?categorySlug= to restrict to brands associated with that category tree.",
      querystring: {
        type: "object",
        properties: {
          categorySlug: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Brands list",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (req, reply) => {
      const { categorySlug } = z
        .object({ categorySlug: z.string().optional() })
        .parse(req.query);

      let categoryFilter: { brandCategories: { some: { categoryId: { in: string[] } } } } | undefined;
      if (categorySlug) {
        const cat = await prisma.category.findFirst({ where: { slug: categorySlug } });
        if (cat) {
          const descendantIds = await getCategoryDescendantIds(cat.id);
          const allIds = [cat.id, ...descendantIds];
          categoryFilter = { brandCategories: { some: { categoryId: { in: allIds } } } };
        }
      }

      const brands = await prisma.brand.findMany({
        where: categoryFilter,
        orderBy: { name: "asc" },
        include: {
          brandCategories: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });
      return reply.send(brands);
    },
  });

  // GET /catalog/brand/:slug — brand detail
  fastify.get<{ Params: { slug: string } }>("/brand/:slug", {
    schema: {
      tags: ["Catalog"],
      description: "Returns a single brand by slug.",
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
      response: {
        200: { description: "Brand detail", type: "object" },
        404: { description: "Not found", type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const brand = await prisma.brand.findFirst({
        where: { slug: req.params.slug },
        select: { id: true, name: true, slug: true, logoUrl: true, landingImage1Url: true, landingImage2Url: true },
      });
      if (!brand) return reply.status(404).send({ error: "Brand not found" });
      return reply.send(brand);
    },
  });

  // GET /catalog/brand/:slug/filters — 3-level category tree + colors + sizes for a brand
  fastify.get<{ Params: { slug: string } }>("/brand/:slug/filters", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns the 3-level category hierarchy, available colors, and available sizes for a brand's published products. Used to populate the filter panel on the brand products page.",
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
      response: {
        200: { description: "Brand filter options", type: "object" },
        404: { description: "Not found", type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const brand = await prisma.brand.findFirst({ where: { slug: req.params.slug } });
      if (!brand) return reply.status(404).send({ error: "Brand not found" });

      // Get the brand's directly-associated categories
      const brandCategoryRows = await prisma.brandCategory.findMany({
        where: { brandId: brand.id },
        include: {
          category: { select: { id: true, level: true } },
        },
      });

      const directCatIds = brandCategoryRows.map((bc) => bc.category.id);

      // Expand to full descendant tree (so level-0 entries also expose level-1 and level-2 children)
      const descendantGroups = await Promise.all(
        directCatIds.map((id) => getCategoryDescendantIds(id)),
      );
      const allRelatedCatIds = [
        ...new Set([...directCatIds, ...descendantGroups.flat()]),
      ];

      // Fetch all involved categories with hierarchy info
      const [allCats, allColors, sizes, attrDefs] = await Promise.all([
        prisma.category.findMany({
          where: { id: { in: allRelatedCatIds }, isActive: true },
          orderBy: [{ level: "asc" }, { position: "asc" }],
          select: { id: true, name: true, slug: true, level: true, parentId: true },
        }),
        // ALL system colors — sidebar does client-side search
        prisma.color.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, hexCode: true, slug: true },
        }),
        prisma.size.findMany({
          where: { sizeCategories: { some: { categoryId: { in: allRelatedCatIds } } } },
          orderBy: { position: "asc" },
          select: { id: true, name: true, label: true, sizeSystem: true },
        }),
        // Attribute definitions for the brand's category tree, with per-category associations
        prisma.attributeDefinition.findMany({
          where: {
            categories: { some: { categoryId: { in: allRelatedCatIds } } },
            isActive: true,
          },
          include: {
            options: { orderBy: { position: "asc" } },
            categories: {
              where: { categoryId: { in: allRelatedCatIds } },
              select: { categoryId: true },
            },
          },
          orderBy: { position: "asc" },
        }),
      ]);

      // Build 3-level category tree
      const level0 = allCats.filter((c) => c.level === 0);
      const level1 = allCats.filter((c) => c.level === 1);
      const level2 = allCats.filter((c) => c.level === 2);

      const categories = level0.map((c0) => ({
        id: c0.id,
        name: c0.name,
        slug: c0.slug,
        children: level1
          .filter((c1) => c1.parentId === c0.id)
          .map((c1) => ({
            id: c1.id,
            name: c1.name,
            slug: c1.slug,
            children: level2
              .filter((c2) => c2.parentId === c1.id)
              .map((c2) => ({ id: c2.id, name: c2.name, slug: c2.slug })),
          })),
      }));

      const filters = attrDefs.map((def) => ({
        id: def.id,
        name: def.name,
        inputType: def.inputType,
        categoryIds: def.categories.map((c) => c.categoryId),
        options: def.options.map((o) => ({
          id: o.id,
          label: o.label,
          value: o.value,
          position: o.position,
        })),
      }));

      return reply.send({ categories, colors: allColors, sizes, filters });
    },
  });

  // GET /catalog/brand/:slug/products — paginated products for a brand with optional filters
  fastify.get<{ Params: { slug: string } }>("/brand/:slug/products", {
    schema: {
      tags: ["Catalog"],
      description:
        "Offset-paginated product listing for a brand. Supports filtering by category (any level, comma-separated slugs), color, size, and price range.",
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1 },
          limit: { type: "integer", default: 24 },
          sort: { type: "string", enum: ["newest", "price_asc", "price_desc"], default: "newest" },
          cat: { type: "string", description: "Comma-separated category slugs at any level" },
          color: { type: "string", description: "Comma-separated color IDs" },
          size: { type: "string", description: "Comma-separated size IDs" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
        },
      },
      response: {
        200: {
          description: "Paged products",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        404: { description: "Not found", type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const brand = await prisma.brand.findFirst({ where: { slug: req.params.slug } });
      if (!brand) return reply.status(404).send({ error: "Brand not found" });

      const BrandProductQuery = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(24),
        sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
        cat: z.string().optional(),
        color: z.string().optional(),
        size: z.string().optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
      });

      const parsed = BrandProductQuery.safeParse(req.query);
      if (!parsed.success)
        return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? "Invalid query" });
      const q = parsed.data;

      const colorIds = q.color?.split(",").filter(Boolean) ?? [];
      const sizeIds = q.size?.split(",").filter(Boolean) ?? [];
      const catSlugs = q.cat?.split(",").filter(Boolean) ?? [];

      let categoryFilter: Record<string, unknown> = {};
      if (catSlugs.length > 0) {
        const foundCats = await prisma.category.findMany({
          where: { slug: { in: catSlugs } },
          select: { id: true },
        });
        const catIds = foundCats.map((c) => c.id);
        const descendantGroups = await Promise.all(catIds.map((id) => getCategoryDescendantIds(id)));
        const allCatIds = [...catIds, ...descendantGroups.flat()];
        categoryFilter = { categories: { some: { categoryId: { in: allCatIds } } } };
      }

      // Parse attrg-{name} params: each is an OR group (all pairs), AND between groups
      // Format: attrg-cor=defId1:optId1,defId2:optId2,...
      const attrGroupConditions: object[] = [];
      for (const [key, value] of Object.entries(req.query as Record<string, unknown>)) {
        if (key.startsWith("attrg-") && typeof value === "string") {
          const pairs = value
            .split(",")
            .map((p) => { const [defId, optId] = p.split(":"); return { defId, optId }; })
            .filter((p) => p.defId && p.optId);
          if (pairs.length > 0) {
            attrGroupConditions.push({
              OR: pairs.map(({ defId, optId }) => ({
                attributes: {
                  some: { attributeDefinitionId: defId, attributeOptionId: optId },
                },
              })),
            });
          }
        }
      }

      const orderBy =
        q.sort === "price_asc"
          ? { basePrice: "asc" as const }
          : q.sort === "price_desc"
            ? { basePrice: "desc" as const }
            : { createdAt: "desc" as const };

      const where = {
        brandId: brand.id,
        status: "published" as const,
        isVisible: true,
        ...categoryFilter,
        ...(colorIds.length ? { variants: { some: { colorId: { in: colorIds } } } } : {}),
        ...(sizeIds.length ? { sizes: { some: { sizeId: { in: sizeIds } } } } : {}),
        ...(q.minPrice !== undefined || q.maxPrice !== undefined
          ? {
              basePrice: {
                ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
                ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(attrGroupConditions.length > 0 ? { AND: attrGroupConditions } : {}),
      };

      const skip = (q.page - 1) * q.limit;
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip,
          take: q.limit,
          where,
          orderBy,
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            isIndicativePrice: true,
            hasDiscount: true,
            discountPrice: true,
            stockStatus: true,
            brand: { select: { id: true, name: true, slug: true } },
            media: {
              where: { colorId: null, isDeleted: false } as never,
              take: 6,
              orderBy: { position: "asc" as const },
              select: { id: true, url: true, mediaType: true, isPrimary: true },
            },
            variants: {
              take: 40,
              orderBy: { position: "asc" as const },
              select: {
                colorId: true,
                color: { select: { id: true, name: true, hexCode: true } },
              },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      const mappedProducts = products.map((p) => {
        const seen = new Set<string>();
        const variants = p.variants.filter((v) => {
          if (!v.colorId || seen.has(v.colorId)) return false;
          seen.add(v.colorId);
          return true;
        });
        return { ...p, variants };
      });

      return reply.send(offsetPaginate(mappedProducts, total, q.page, q.limit));
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
          sizeAndFit: true,
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
          relatedProducts: {
            select: {
              target: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  basePrice: true,
                  isIndicativePrice: true,
                  hasDiscount: true,
                  discountPrice: true,
                  brand: { select: { id: true, name: true, slug: true } },
                  media: {
                    where: { colorId: null, isDeleted: false } as never,
                    take: 3,
                    orderBy: { position: "asc" },
                    select: {
                      id: true,
                      url: true,
                      mediaType: true,
                      isPrimary: true,
                    },
                  },
                  variants: {
                    select: {
                      colorId: true,
                      color: {
                        select: { id: true, name: true, hexCode: true },
                      },
                    },
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      if (!product)
        return reply.status(404).send({ error: "Product not found" });

      // Flatten relatedProducts join table rows, deduplicating variant colors
      const { relatedProducts: relatedRows, ...productRest } =
        product as typeof product & {
          relatedProducts: Array<{
            target: {
              variants?: Array<{ colorId: string | null; color: unknown }>;
            } & Record<string, unknown>;
          }>;
        };
      return reply.send({
        ...productRest,
        relatedProducts: (relatedRows ?? []).map((r) => {
          const target = r.target;
          const seen = new Set<string>();
          const variants = (target.variants ?? []).filter((v) => {
            if (!v.colorId || seen.has(v.colorId)) return false;
            seen.add(v.colorId);
            return true;
          });
          return { ...target, variants };
        }),
      });
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

  // GET /catalog/collections/:slug — single collection detail
  fastify.get<{ Params: { slug: string } }>("/collections/:slug", {
    schema: {
      tags: ["Catalog"],
      description: "Returns a single collection by slug.",
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
      response: {
        200: { description: "Collection detail", type: "object" },
        404: { description: "Not found", type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const collection = await prisma.collection.findFirst({
        where: { slug: req.params.slug, isActive: true },
        select: { id: true, name: true, slug: true, coverImageUrl: true },
      });
      if (!collection) return reply.status(404).send({ error: "Collection not found" });
      return reply.send(collection);
    },
  });

  // GET /catalog/collections/:slug/filters — brands, colors and sizes available in the collection
  fastify.get<{ Params: { slug: string } }>("/collections/:slug/filters", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns distinct brands, colors, and sizes for the published products in a collection. Sizes are derived from product variants (not the manual product_sizes table).",
      params: { type: "object", required: ["slug"], properties: { slug: { type: "string" } } },
      response: {
        200: { description: "Filter options", type: "object" },
        404: { description: "Not found", type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const collection = await prisma.collection.findFirst({
        where: { slug: req.params.slug },
        select: { id: true },
      });
      if (!collection) return reply.status(404).send({ error: "Collection not found" });

      const productScope = {
        collections: { some: { collectionId: collection.id } },
        status: "published" as const,
        isVisible: true,
      };

      const [brands, colors, sizes] = await Promise.all([
        prisma.brand.findMany({
          where: { products: { some: productScope } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, logoUrl: true },
        }),
        prisma.color.findMany({
          where: { productVariants: { some: { product: productScope } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, hexCode: true, slug: true },
        }),
        // Sizes come from product variants — automatic, no manual association needed
        prisma.size.findMany({
          where: { productVariants: { some: { product: productScope } } },
          orderBy: { position: "asc" },
          select: { id: true, name: true, label: true, sizeSystem: true },
        }),
      ]);

      return reply.send({ brands, colors, sizes });
    },
  });

  // GET /catalog/collections — public collections list (cached)
  fastify.get("/collections", {
    schema: {
      tags: ["Catalog"],
      description:
        "Returns active collections ordered by position. Without ?categorySlug returns uncategorised (home page) collections. With ?categorySlug=homem returns that category's collections.",
      querystring: {
        type: "object",
        properties: {
          categorySlug: { type: "string" },
          orderBy: {
            type: "string",
            enum: ["position"],
            description: "Order collections by this field (default: position)",
          },
        },
      },
      response: {
        200: {
          description: "Collections list ordered by position",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (req, reply) => {
      const { categorySlug } = z
        .object({ categorySlug: z.string().optional() })
        .parse(req.query);

      let categoryId: string | null | undefined;
      if (categorySlug) {
        const cat = await prisma.category.findUnique({
          where: { slug: categorySlug },
          select: { id: true },
        });
        categoryId = cat?.id ?? "not-found";
      }

      const where =
        categorySlug !== undefined
          ? { categoryId: categoryId ?? null, isActive: true }
          : { categoryId: null as null, isActive: true };

      const collections = await prisma.collection.findMany({
        where,
        orderBy: { position: "asc" },
      });
      return reply.send(collections);
    },
  });

  // GET /catalog/collections/:slug/products
  fastify.get<{ Params: { slug: string } }>("/collections/:slug/products", {
    schema: {
      tags: ["Catalog"],
      description:
        "Offset-paginated product listing for a collection. Supports the same filters as category product listing.",
      params: {
        type: "object",
        required: ["slug"],
        properties: { slug: { type: "string", example: "verao-2025" } },
      },
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1 },
          limit: { type: "integer", default: 24 },
          sort: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc"],
            default: "newest",
          },
          brand: { type: "string" },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          color: { type: "string" },
          size: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Paged products",
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

      const brandIds = q.brand?.split(",").filter(Boolean) ?? [];
      const colorIds = q.color?.split(",").filter(Boolean) ?? [];
      const sizeIds = q.size?.split(",").filter(Boolean) ?? [];
      const orderBy =
        q.sort === "price_asc"
          ? { basePrice: "asc" as const }
          : q.sort === "price_desc"
            ? { basePrice: "desc" as const }
            : { createdAt: "desc" as const };

      // Build variant sub-conditions separately to avoid duplicate object keys
      // when both color and size are filtered (both live on ProductVariant).
      const variantFilters: object[] = [];
      if (colorIds.length) variantFilters.push({ variants: { some: { colorId: { in: colorIds } } } });
      // Sizes derived from variants — no manual product_sizes join needed
      if (sizeIds.length) variantFilters.push({ variants: { some: { sizeId: { in: sizeIds } } } });

      const collectionWhere = {
        collections: { some: { collectionId: collection.id } },
        status: "published" as const,
        isVisible: true,
        ...(brandIds.length ? { brandId: { in: brandIds } } : {}),
        ...(q.minPrice !== undefined || q.maxPrice !== undefined
          ? {
              basePrice: {
                ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
                ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(variantFilters.length > 0 ? { AND: variantFilters } : {}),
      };

      const skip = (q.page - 1) * q.limit;
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip,
          take: q.limit,
          where: collectionWhere,
          orderBy,
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            isIndicativePrice: true,
            hasDiscount: true,
            discountPrice: true,
            stockStatus: true,
            brand: { select: { id: true, name: true, slug: true } },
            media: {
              where: { colorId: null, isDeleted: false } as never,
              take: 6,
              orderBy: { position: "asc" as const },
              select: { id: true, url: true, mediaType: true, isPrimary: true },
            },
            // Fetch all color variants (deduplicated below)
            variants: {
              take: 40,
              orderBy: { position: "asc" as const },
              select: {
                colorId: true,
                color: { select: { id: true, name: true, hexCode: true } },
              },
            },
          },
        }),
        prisma.product.count({ where: collectionWhere }),
      ]);

      // Deduplicate variant colors per product
      const mappedProducts = products.map((p) => {
        const seen = new Set<string>();
        const variants = p.variants.filter((v) => {
          if (!v.colorId || seen.has(v.colorId)) return false;
          seen.add(v.colorId);
          return true;
        });
        return { ...p, variants };
      });

      return reply.send(offsetPaginate(mappedProducts, total, q.page, q.limit));
    },
  });
}
