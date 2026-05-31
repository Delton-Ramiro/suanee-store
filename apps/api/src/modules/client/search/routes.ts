import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const SearchQuery = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "popular"])
    .default("newest"),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  colorIds: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  gender: z.enum(["men", "women", "unisex", "kids"]).optional(),
  inStock: z.coerce.boolean().optional(),
});

const SORT_MAP = {
  newest: { createdAt: "desc" as const },
  price_asc: { basePrice: "asc" as const },
  price_desc: { basePrice: "desc" as const },
  popular: { orderItems: { _count: "desc" as const } },
} as const;

export default async function clientSearchRoutes(fastify: FastifyInstance) {
  // GET /search
  fastify.get("/", {
    schema: {
      tags: ["Search"],
      description:
        "Full-text product search powered by PostgreSQL pg_trgm. Returns facets for brand, category, color, gender, and stock status alongside the product hits.",
      querystring: {
        type: "object",
        required: ["q"],
        properties: {
          q: { type: "string", minLength: 1, maxLength: 200 },
          page: { type: "integer", default: 1 },
          perPage: { type: "integer", default: 24, maximum: 100 },
          sort: {
            type: "string",
            enum: ["newest", "price_asc", "price_desc", "popular"],
            default: "newest",
          },
          brandId: { type: "string" },
          categoryId: { type: "string" },
          colorIds: {
            type: "string",
            description: "Comma-separated color IDs",
          },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          gender: { type: "string", enum: ["men", "women", "unisex", "kids"] },
          inStock: { type: "boolean" },
        },
      },
      response: {
        200: {
          description: "Search result with hits and facets",
          type: "object",
        },
      },
    },
    handler: async (req, reply) => {
      const q = SearchQuery.parse(req.query);
      const colorIdList = q.colorIds
        ? q.colorIds.split(",").filter(Boolean)
        : undefined;

      // Resolve brand IDs whose name matches the search term
      const brandIdsFromText = (
        await prisma.brand.findMany({
          where: { name: { contains: q.q, mode: "insensitive" } },
          select: { id: true },
        })
      ).map((b) => b.id);

      // Base where clause (text match + all active filters)
      const baseWhere: Prisma.ProductWhereInput = {
        status: "published" as const,
        isVisible: true,
        OR: [
          { name: { contains: q.q, mode: "insensitive" as const } },
          { description: { contains: q.q, mode: "insensitive" as const } },
          ...(brandIdsFromText.length
            ? [{ brandId: { in: brandIdsFromText } }]
            : []),
        ],
        ...(q.brandId ? { brandId: q.brandId } : {}),
        ...(q.categoryId
          ? { categories: { some: { categoryId: q.categoryId } } }
          : {}),
        ...(colorIdList?.length
          ? { variants: { some: { colorId: { in: colorIdList } } } }
          : {}),
        ...(q.minPrice !== undefined || q.maxPrice !== undefined
          ? {
              basePrice: {
                ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
                ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
              },
            }
          : {}),
        ...(q.gender ? { genderScope: q.gender } : {}),
        ...(q.inStock ? { stockStatus: "in_stock" as const } : {}),
      };

      const orderBy = SORT_MAP[q.sort] ?? SORT_MAP.newest;
      const skip = (q.page - 1) * q.perPage;

      const products = await prisma.product.findMany({
        where: baseWhere,
        orderBy,
        skip,
        take: q.perPage,
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          hasDiscount: true,
          discountPrice: true,
          isIndicativePrice: true,
          brand: { select: { id: true, name: true, slug: true } },
          media: {
            where: { colorId: null, isDeleted: false } as never,
            take: 6,
            orderBy: { position: "asc" as const },
            select: { id: true, url: true, mediaType: true, isPrimary: true },
          },
          variants: {
            select: {
              colorId: true,
              color: { select: { id: true, name: true, hexCode: true } },
            },
            take: 10,
          },
        },
      });

      const hits = products.map((p) => {
        const seen = new Set<string>();
        const colors = p.variants
          .filter((v) => v.colorId && v.color && !seen.has(v.colorId) && seen.add(v.colorId))
          .map((v) => v.color!);
        return {
          document: {
            id: p.id,
            name: p.name,
            slug: p.slug,
            basePrice: Number(p.basePrice),
            isIndicativePrice: p.isIndicativePrice,
            hasDiscount: p.hasDiscount,
            discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
            brandId: p.brand.id,
            brandName: p.brand.name,
            brandSlug: p.brand.slug,
            media: p.media,
            colors,
          },
        };
      });

      return reply.send({ hits });
    },
  });

  // GET /search/suggest — lightweight query suggestions (most-searched terms)
  fastify.get("/suggest", {
    schema: {
      tags: ["Search"],
      description:
        "Returns the top 10 curated search term suggestions ordered by position. Used for search autocomplete/discovery.",
      response: {
        200: {
          description: "Suggested search terms",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const terms = await prisma.mostSearched.findMany({
        orderBy: { position: "asc" },
        take: 10,
        include: { category: { select: { name: true, slug: true } } },
      });
      return reply.send(terms);
    },
  });

  // GET /search/most-searched — most-searched categories for client portal
  fastify.get("/most-searched", {
    schema: {
      tags: ["Search"],
      description:
        "Returns the top 10 most-searched categories with level and parent info for URL construction. Level 1 → /categorias/[slug], Level 2+ → /categorias/[slug]/produtos.",
      response: {
        200: {
          description: "Most-searched categories",
          type: "array",
          items: { type: "object" },
        },
      },
    },
    handler: async (_req, reply) => {
      const items = await prisma.mostSearched.findMany({
        orderBy: { position: "asc" },
        take: 10,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              level: true,
              parent: { select: { slug: true } },
            },
          },
        },
      });
      return reply.send(items);
    },
  });
}
