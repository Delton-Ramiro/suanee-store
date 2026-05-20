import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
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

      // Copies without individual facet filters (for accurate facet counts)
      const whereForBrandFacet = { ...baseWhere } as Record<string, unknown>;
      delete whereForBrandFacet["brandId"];
      const whereForGenderFacet = { ...baseWhere } as Record<string, unknown>;
      delete whereForGenderFacet["genderScope"];
      const whereForStockFacet = { ...baseWhere } as Record<string, unknown>;
      delete whereForStockFacet["stockStatus"];

      const orderBy = SORT_MAP[q.sort] ?? SORT_MAP.newest;
      const skip = (q.page - 1) * q.perPage;

      const [
        found,
        products,
        brandFacets,
        categoryFacets,
        colorFacets,
        genderFacets,
        stockFacets,
      ] = await Promise.all([
        prisma.product.count({ where: baseWhere }),

        prisma.product.findMany({
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
            stockStatus: true,
            genderScope: true,
            brand: { select: { id: true, name: true } },
            media: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true, mediaType: true },
            },
          },
        }),

        prisma.product.groupBy({
          by: ["brandId"],
          where: whereForBrandFacet as Parameters<
            typeof prisma.product.groupBy
          >[0]["where"],
          _count: { _all: true },
          orderBy: { _count: { brandId: "desc" } },
          take: 50,
        }),

        prisma.productCategory.groupBy({
          by: ["categoryId"],
          where: { product: baseWhere },
          _count: { _all: true },
          orderBy: { _count: { categoryId: "desc" } },
          take: 50,
        }),

        prisma.productVariant.groupBy({
          by: ["colorId"],
          where: { product: baseWhere },
          _count: { _all: true },
          orderBy: { _count: { colorId: "desc" } },
          take: 50,
        }),

        prisma.product.groupBy({
          by: ["genderScope"],
          where: whereForGenderFacet as Parameters<
            typeof prisma.product.groupBy
          >[0]["where"],
          _count: { _all: true },
        }),

        prisma.product.groupBy({
          by: ["stockStatus"],
          where: whereForStockFacet as Parameters<
            typeof prisma.product.groupBy
          >[0]["where"],
          _count: { _all: true },
        }),
      ]);

      return reply.send({
        found,
        page: q.page,
        perPage: q.perPage,
        hits: products.map((p) => ({
          document: {
            id: p.id,
            name: p.name,
            slug: p.slug,
            basePrice: Number(p.basePrice),
            hasDiscount: p.hasDiscount,
            discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
            stockStatus: p.stockStatus,
            genderScope: p.genderScope,
            brandId: p.brand.id,
            brandName: p.brand.name,
            primaryImage: p.media[0]?.url ?? null,
          },
        })),
        facet_counts: [
          {
            field_name: "brandId",
            counts: brandFacets.map((f) => ({
              value: f.brandId,
              count: f._count._all,
            })),
          },
          {
            field_name: "categoryIds",
            counts: categoryFacets.map((f) => ({
              value: f.categoryId,
              count: f._count._all,
            })),
          },
          {
            field_name: "colorIds",
            counts: colorFacets.map((f) => ({
              value: f.colorId,
              count: f._count._all,
            })),
          },
          {
            field_name: "genderScope",
            counts: genderFacets
              .filter((f) => f.genderScope !== null)
              .map((f) => ({ value: f.genderScope!, count: f._count._all })),
          },
          {
            field_name: "stockStatus",
            counts: stockFacets.map((f) => ({
              value: f.stockStatus,
              count: f._count._all,
            })),
          },
        ],
      });
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
}
