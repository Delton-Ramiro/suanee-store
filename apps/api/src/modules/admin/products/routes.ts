import type { FastifyInstance } from "fastify";
import type { Prisma, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateProductSchema,
  UpdateProductSchema,
  CreateProductSupplierSchema,
  CreateProductCompetitorSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { generateSku, offsetPaginate } from "../../../lib/utils.js";
import { cacheDelPattern } from "../../../lib/redis.js";
import { deleteR2Objects } from "../../../lib/r2.js";
import {
  canChangeProductVisibility,
  resolveAdminRoleKey,
  canDeleteProduct,
  canEditProduct,
  getEffectiveProductWriteValues,
} from "../../../lib/admin-roles.js";

const ProductListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  view: z
    .enum(["all", "available", "importation", "draft", "hidden"])
    .default("all"),
  sortBy: z.enum(["createdAt", "name", "basePrice"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  hasCollection: z.coerce.boolean().optional(),
});

export default async function adminProductsRoutes(fastify: FastifyInstance) {
  // GET /admin/products
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "List products with offset pagination. Supports filtering by view (available/importation/draft/hidden), brand, category, and text search.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          search: { type: "string" },
          view: {
            type: "string",
            enum: ["all", "available", "importation", "draft", "hidden"],
            default: "all",
          },
          sortBy: {
            type: "string",
            enum: ["createdAt", "name", "basePrice"],
            default: "createdAt",
          },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
          brandId: { type: "string", format: "uuid" },
          categoryId: { type: "string", format: "uuid" },
          hasCollection: { type: "boolean" },
        },
      },
      response: {
        200: {
          description: "Paginated product list",
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
      const q = ProductListQuery.parse(req.query);

      const where: Prisma.ProductWhereInput = {
        ...(q.view === "available"
          ? {
              stockStatus: "in_stock",
              status: "published",
              isVisible: true,
            }
          : {}),
        ...(q.view === "importation" ? { stockStatus: "by_importation" } : {}),
        ...(q.view === "draft" ? { status: "draft" } : {}),
        ...(q.view === "hidden"
          ? { status: "published", isVisible: false }
          : {}),
        ...(q.brandId ? { brandId: q.brandId } : {}),
        ...(q.categoryId
          ? { categories: { some: { categoryId: q.categoryId } } }
          : {}),
        ...(q.hasCollection ? { collections: { some: {} } } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" as const } },
                { id: { contains: q.search } },
                {
                  brand: {
                    name: { contains: q.search, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };

      const include = {
        brand: { select: { id: true, name: true } },
        collections: { select: { collectionId: true } },
        categories: { select: { categoryId: true } },
        media: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, mediaType: true },
        },
        _count: { select: { variants: true } },
      };

      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { [q.sortBy]: q.sortOrder },
          include,
        }),
      ]);

      return reply.send(offsetPaginate(products, total, q.page, q.limit));
    },
  });

  // GET /admin/products/:id — essential product data (no nested entity objects)
  fastify.get<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Get a product with its brand, collection, size guide, categories, variants (IDs only), media, sizes, and attributes. For full color/size objects in variants use GET /:id/variants.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Product detail", type: "object" },
        404: {
          description: "Product not found",
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
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          collections: { select: { collectionId: true } },
          sizeGuide: { select: { id: true, name: true } },
          categories: { select: { categoryId: true } },
          variants: {
            select: {
              id: true,
              colorId: true,
              sizeId: true,
              sku: true,
              stockQuantity: true,
              price: true,
              hasDiscount: true,
              discountPrice: true,
              isIndicativePrice: true,
              position: true,
              color: { select: { id: true, name: true, hexCode: true } },
              size: { select: { id: true, name: true, label: true } },
            },
            orderBy: { position: "asc" },
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
          sizes: { select: { sizeId: true } },
          attributes: {
            select: { attributeDefinitionId: true, attributeOptionId: true },
          },
        },
      });
      if (!product)
        return reply.status(404).send({ error: "Product not found" });
      return reply.send(product);
    },
  });

  // GET /admin/products/:id/variants — variants with full color + size objects
  fastify.get<{ Params: { id: string } }>("/:id/variants", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Get all variants of a product with full color and size objects, ordered by position.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Variant list",
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
      const variants = await prisma.productVariant.findMany({
        where: { productId: req.params.id },
        include: { color: true, size: true },
        orderBy: { position: "asc" },
      });
      return reply.send(variants);
    },
  });

  // GET /admin/products/:id/media — media with full color object
  fastify.get<{ Params: { id: string } }>("/:id/media", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Get all non-deleted media items for a product with their associated color object.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Media list",
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
      const media = await prisma.productMedia.findMany({
        where: { productId: req.params.id, isDeleted: false } as never,
        include: { color: { select: { id: true, name: true, hexCode: true } } },
        orderBy: { position: "asc" },
      });
      return reply.send(media);
    },
  });

  // GET /admin/products/:id/categories — categories with full hierarchy
  fastify.get<{ Params: { id: string } }>("/:id/categories", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Get all categories a product belongs to, including category hierarchy fields.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Category list",
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
      const cats = await prisma.productCategory.findMany({
        where: { productId: req.params.id },
        include: {
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
      });
      return reply.send(cats.map((c) => c.category));
    },
  });

  // GET /admin/products/:id/related — list related products
  fastify.get<{ Params: { id: string } }>("/:id/related", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description: "List the 'also like' related products for a product.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Related products", type: "array", items: { type: "object" } },
      },
    },
    handler: async (req, reply) => {
      const rows = await prisma.productRelated.findMany({
        where: { sourceId: req.params.id },
        select: {
          target: {
            select: {
              id: true,
              name: true,
              slug: true,
              basePrice: true,
              brand: { select: { id: true, name: true } },
              media: {
                where: { isPrimary: true, isDeleted: false } as never,
                take: 1,
                select: { url: true, mediaType: true },
              },
            },
          },
        },
      });
      return reply.send(rows.map((r) => r.target));
    },
  });

  // PUT /admin/products/:id/related — replace all related products
  fastify.put<{
    Params: { id: string };
    Body: { relatedProductIds: string[] };
  }>("/:id/related", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description: "Replace the full list of 'also like' related products.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["relatedProductIds"],
        properties: {
          relatedProductIds: { type: "array", items: { type: "string", format: "uuid" } },
        },
      },
      response: {
        200: { description: "OK", type: "object", properties: { count: { type: "integer" } } },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const ids = req.body.relatedProductIds.filter((rid) => rid !== id); // no self-reference
      await prisma.$transaction([
        prisma.productRelated.deleteMany({ where: { sourceId: id } }),
        ...(ids.length > 0
          ? [
              prisma.productRelated.createMany({
                data: ids.map((targetId) => ({ sourceId: id, targetId })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);
      return reply.send({ count: ids.length });
    },
  });

  // GET /admin/products/:id/financial
  fastify.get<{ Params: { id: string } }>("/:id/financial", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_VIEW)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description: "Get suppliers and competitor prices for a product.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Suppliers and competitors",
          type: "object",
          properties: {
            suppliers: { type: "array", items: { type: "object" } },
            competitors: { type: "array", items: { type: "object" } },
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
      const [suppliers, competitors] = await Promise.all([
        prisma.productSupplier.findMany({
          where: { productId: req.params.id },
          include: { currencyRate: true },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        }),
        prisma.productCompetitor.findMany({
          where: { productId: req.params.id },
        }),
      ]);
      return reply.send({ suppliers, competitors });
    },
  });

  // POST /admin/products
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_CREATE)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new product with variants, media, categories, sizes, and attributes in a single request. Non-super-admin users always create products in 'draft' status. On transaction failure any uploaded R2 media objects are cleaned up.",
      body: {
        type: "object",
        required: ["name", "slug", "brandId", "basePrice", "stockStatus"],
        properties: {
          name: { type: "string", example: "Air Max 270" },
          slug: { type: "string", example: "air-max-270" },
          description: { type: "string", nullable: true },
          brandId: { type: "string", format: "uuid" },
          collectionIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            nullable: true,
          },
          sizeGuideId: { type: "string", format: "uuid", nullable: true },
          basePrice: { type: "number", example: 4500 },
          discountPrice: { type: "number", nullable: true },
          hasDiscount: { type: "boolean", default: false },
          isIndicativePrice: { type: "boolean", default: false },
          stockStatus: {
            type: "string",
            enum: ["in_stock", "out_of_stock", "by_importation"],
          },
          status: {
            type: "string",
            enum: ["draft", "published", "archived"],
            default: "draft",
            description: "Only super-admins can create directly as 'published'",
          },
          isVisible: { type: "boolean", default: true },
          keyCharacteristics: { type: "string", nullable: true },
          productInfo: { type: "string", nullable: true },
          sendPolicy: { type: "string", nullable: true },
          sizeAndFit: { type: "string", nullable: true },
          returnPolicy: { type: "string", nullable: true },
          deliveryEstimate: { type: "string", nullable: true },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          sizeIds: { type: "array", items: { type: "string", format: "uuid" } },
          variants: {
            type: "array",
            items: {
              type: "object",
              required: ["colorId", "sizeId", "stockQuantity"],
              properties: {
                colorId: { type: "string", format: "uuid" },
                sizeId: { type: "string", format: "uuid" },
                stockQuantity: { type: "integer", minimum: 0, example: 10 },
                price: { type: "number", nullable: true },
                hasDiscount: { type: "boolean", default: false },
                discountPrice: { type: "number", nullable: true },
                isIndicativePrice: { type: "boolean", default: false },
              },
            },
          },
          media: {
            type: "array",
            items: {
              type: "object",
              required: ["url", "mediaType"],
              properties: {
                url: { type: "string" },
                mediaType: { type: "string", enum: ["image", "video"] },
                isPrimary: { type: "boolean", default: false },
                colorId: { type: "string", format: "uuid", nullable: true },
                position: { type: "integer" },
              },
            },
          },
          attributes: {
            type: "array",
            items: {
              type: "object",
              required: ["attributeDefinitionId", "attributeOptionIds"],
              properties: {
                attributeDefinitionId: { type: "string", format: "uuid" },
                attributeOptionIds: {
                  type: "array",
                  items: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
      },
      response: {
        201: { description: "Product created", type: "object" },
        404: {
          description: "Brand not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
        422: {
          description: "Invalid attributes for category",
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
      const body = CreateProductSchema.parse(req.body);

      const effectiveValues = getEffectiveProductWriteValues(
        resolveAdminRoleKey(req.user),
        { status: body.status, isVisible: body.isVisible },
      );
      const effectiveStatus = (effectiveValues.status ??
        body.status) as ProductStatus;
      const effectiveIsVisible = effectiveValues.isVisible ?? body.isVisible;

      // Validate filters belong to the selected category hierarchy
      if (body.attributes?.length) {
        const valid = await validateAttributes(
          body.categoryIds ?? [],
          body.attributes,
          reply,
        );
        if (!valid) return;
      }

      // Get brand and primary category for SKU generation
      const brand = await prisma.brand.findUnique({
        where: { id: body.brandId },
        select: { name: true },
      });
      if (!brand) return reply.status(404).send({ error: "Brand not found" });

      const primaryCat = await prisma.category.findFirst({
        where: { id: { in: body.categoryIds ?? [] } },
        orderBy: { level: "desc" },
      });

      const {
        variants = [],
        media = [],
        attributes,
        categoryIds = [],
        sizeIds = [],
        collectionIds,
        ...productData
      } = body;

      let product;
      try {
        product = await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
              ...productData,
              status: effectiveStatus,
              isVisible: effectiveIsVisible,
              basePrice: productData.basePrice,
              discountPrice: productData.discountPrice,
              categories: {
                create: categoryIds.map((id) => ({ categoryId: id })),
              },
              sizes: { create: sizeIds.map((id) => ({ sizeId: id })) },
              ...(collectionIds?.length
                ? {
                    collections: {
                      create: collectionIds.map((id) => ({ collectionId: id })),
                    },
                  }
                : {}),
              variants: {
                create: variants.map((v, i) => ({
                  colorId: v.colorId,
                  sizeId: v.sizeId,
                  sku: generateSku(brand.name, primaryCat?.name ?? "GEN"),
                  stockQuantity: v.stockQuantity,
                  price: v.price,
                  hasDiscount: v.hasDiscount ?? false,
                  discountPrice: v.discountPrice,
                  isIndicativePrice: v.isIndicativePrice ?? false,
                  position: i,
                })),
              },
              media: {
                create: media.map((m, i) => ({
                  ...m,
                  position: m.position ?? i,
                })),
              },
              ...(attributes?.length
                ? {
                    attributes: {
                      create: attributes.flatMap((a) =>
                        a.attributeOptionIds.map((optId) => ({
                          attributeDefinitionId: a.attributeDefinitionId,
                          attributeOptionId: optId,
                        })),
                      ),
                    },
                  }
                : {}),
            },
            include: {
              variants: { include: { color: true, size: true } },
              categories: { include: { category: true } },
            },
          });
          return created;
        });
      } catch (err) {
        // On transaction failure, remove any R2 objects already uploaded
        const mediaKeys = media
          .map((m) => {
            try {
              const url = new URL(m.url);
              return url.pathname.replace(/^\//, "");
            } catch {
              return null;
            }
          })
          .filter((k): k is string => k !== null);
        await deleteR2Objects(mediaKeys).catch(() => undefined);
        throw err;
      }

      await cacheDelPattern(`products:*`);
      await audit({
        adminId: req.user.sub,
        action: "product.created",
        resourceType: "product",
        resourceId: product.id,
        after: { name: body.name },
      });
      return reply.status(201).send(product);
    },
  });

  // PATCH /admin/products/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Update a product. All fields are optional. Providing variants/media/categoryIds/sizeIds/attributes replaces those collections entirely. Media array handles reordering via the position field.",
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
          description: { type: "string", nullable: true },
          brandId: { type: "string", format: "uuid" },
          collectionIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            nullable: true,
          },
          basePrice: { type: "number" },
          discountPrice: { type: "number", nullable: true },
          hasDiscount: { type: "boolean" },
          isIndicativePrice: { type: "boolean" },
          stockStatus: {
            type: "string",
            enum: ["in_stock", "out_of_stock", "by_importation"],
          },
          status: {
            type: "string",
            enum: ["draft", "published", "archived"],
          },
          isVisible: { type: "boolean" },
          keyCharacteristics: { type: "string", nullable: true },
          productInfo: { type: "string", nullable: true },
          sendPolicy: { type: "string", nullable: true },
          sizeAndFit: { type: "string", nullable: true },
          returnPolicy: { type: "string", nullable: true },
          media: { type: "array", items: { type: "object" } },
          attributes: { type: "array", items: { type: "object" } },
        },
      },
      response: {
        200: { description: "Product updated", type: "object" },
        404: {
          description: "Product not found",
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
      const body = UpdateProductSchema.parse(req.body);
      const before = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: {
          name: true,
          basePrice: true,
          isVisible: true,
          status: true,
          brandId: true,
        },
      });
      if (!before)
        return reply.status(404).send({ error: "Product not found" });
      if (!canEditProduct(resolveAdminRoleKey(req.user), before.isVisible)) {
        return reply.status(403).send({
          error: "This role cannot edit visible products",
        });
      }

      const {
        variants,
        media,
        attributes,
        categoryIds,
        sizeIds,
        collectionIds,
        ...productData
      } = body;
      const effectiveProductDataRaw = getEffectiveProductWriteValues(
        resolveAdminRoleKey(req.user),
        productData,
      );
      const { status: effectiveStatus, ...effectiveProductDataRest } =
        effectiveProductDataRaw;
      const effectiveProductData: Prisma.ProductUpdateInput = {
        ...effectiveProductDataRest,
        ...(effectiveStatus
          ? { status: effectiveStatus as ProductStatus }
          : {}),
      };

      // BUG-B: Validate attributes in PATCH as well, using effective categoryIds
      if (attributes?.length) {
        let effectiveCategoryIds = categoryIds;
        if (!effectiveCategoryIds) {
          const existing = await prisma.productCategory.findMany({
            where: { productId: req.params.id },
            select: { categoryId: true },
          });
          effectiveCategoryIds = existing.map((c) => c.categoryId);
        }
        const valid = await validateAttributes(
          effectiveCategoryIds,
          attributes,
          reply,
        );
        if (!valid) return;
      }

      // Fetch brand for potential SKU generation when creating new variants
      const brandId =
        (productData as { brandId?: string }).brandId ?? before.brandId;
      const brand = brandId
        ? await prisma.brand.findUnique({
            where: { id: brandId },
            select: { name: true },
          })
        : null;

      await prisma.$transaction(async (tx) => {
        if (categoryIds) {
          await tx.productCategory.deleteMany({
            where: { productId: req.params.id },
          });
          await tx.productCategory.createMany({
            data: categoryIds.map((id: string) => ({
              productId: req.params.id,
              categoryId: id,
            })),
          });
        }
        if (collectionIds !== undefined) {
          await tx.productCollection.deleteMany({
            where: { productId: req.params.id },
          });
          if (collectionIds.length > 0) {
            await tx.productCollection.createMany({
              data: collectionIds.map((id: string) => ({
                productId: req.params.id,
                collectionId: id,
              })),
            });
          }
        }
        if (sizeIds) {
          await tx.productSize.deleteMany({
            where: { productId: req.params.id },
          });
          await tx.productSize.createMany({
            data: sizeIds.map((id: string) => ({
              productId: req.params.id,
              sizeId: id,
            })),
          });
        }
        if (attributes) {
          await tx.productAttribute.deleteMany({
            where: { productId: req.params.id },
          });
          await tx.productAttribute.createMany({
            data: attributes.flatMap(
              (a: {
                attributeDefinitionId: string;
                attributeOptionIds: string[];
              }) =>
                a.attributeOptionIds.map((optId: string) => ({
                  productId: req.params.id,
                  attributeDefinitionId: a.attributeDefinitionId,
                  attributeOptionId: optId,
                })),
            ),
          });
        }
        // BUG-14: Handle variants update. Upsert by colorId+sizeId to preserve
        // SKUs and avoid FK violations from OrderItem references on deletion.
        if (variants !== undefined) {
          const existing = await tx.productVariant.findMany({
            where: { productId: req.params.id },
            select: { id: true, colorId: true, sizeId: true, sku: true },
          });

          const primaryCat = categoryIds
            ? await tx.category.findFirst({
                where: { id: { in: categoryIds } },
                orderBy: { level: "desc" },
                select: { name: true },
              })
            : null;

          // Map existing variants by their composite key
          const existingMap = new Map(
            existing.map((v) => [`${v.colorId}:${v.sizeId}`, v]),
          );
          const incomingKeys = new Set(
            variants.map((v) => `${v.colorId}:${v.sizeId}`),
          );

          // Update existing / create new variants
          for (let i = 0; i < variants.length; i++) {
            const v = variants[i]!;
            const key = `${v.colorId}:${v.sizeId}`;
            const ev = existingMap.get(key);

            if (ev) {
              // Update in place — preserves the variant ID and any OrderItem refs
              await tx.productVariant.update({
                where: { id: ev.id },
                data: {
                  stockQuantity: v.stockQuantity,
                  price: v.price,
                  hasDiscount: v.hasDiscount ?? false,
                  discountPrice: v.discountPrice,
                  isIndicativePrice: v.isIndicativePrice ?? false,
                  position: i,
                },
              });
            } else {
              const sku = generateSku(
                brand?.name ?? "GEN",
                primaryCat?.name ?? "GEN",
              );
              await tx.productVariant.create({
                data: {
                  productId: req.params.id,
                  colorId: v.colorId,
                  sizeId: v.sizeId,
                  sku,
                  stockQuantity: v.stockQuantity,
                  price: v.price,
                  hasDiscount: v.hasDiscount ?? false,
                  discountPrice: v.discountPrice,
                  isIndicativePrice: v.isIndicativePrice ?? false,
                  position: i,
                },
              });
            }
          }

          // Delete removed variants only when they have no order history
          for (const ev of existing) {
            if (!incomingKeys.has(`${ev.colorId}:${ev.sizeId}`)) {
              const orderCount = await tx.orderItem.count({
                where: { productVariantId: ev.id },
              });
              if (orderCount === 0) {
                await tx.productVariant.delete({ where: { id: ev.id } });
              }
            }
          }
        }
        // BUG-14: Handle media update (includes reordering via position field).
        // Replaces the separate /media/reorder endpoint.
        if (media !== undefined) {
          await tx.productMedia.deleteMany({
            where: { productId: req.params.id },
          });
          await tx.productMedia.createMany({
            data: media.map((m, i) => ({
              productId: req.params.id,
              colorId: m.colorId ?? null,
              url: m.url,
              mediaType: m.mediaType as never,
              position: m.position ?? i,
              isPrimary: m.isPrimary ?? false,
            })),
          });
        }
        await tx.product.update({
          where: { id: req.params.id },
          data: effectiveProductData,
        });
      });

      await cacheDelPattern(`products:*`);
      await audit({
        adminId: req.user.sub,
        action: "product.updated",
        resourceType: "product",
        resourceId: req.params.id,
        before,
        after: effectiveProductData,
      });

      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
          variants: {
            include: { color: true, size: true },
            orderBy: { position: "asc" },
          },
          media: { include: { color: true }, orderBy: { position: "asc" } },
          categories: true,
          collections: true,
        },
      });
      return reply.send(product);
    },
  });

  // PATCH /admin/products/:id/visibility — toggle visibility without full update
  fastify.patch<{ Params: { id: string } }>("/:id/visibility", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Quickly toggle a product's visibility (show/hide from storefront) without replacing other product data.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["isVisible"],
        properties: { isVisible: { type: "boolean" } },
      },
      response: {
        200: {
          description: "Visibility updated",
          type: "object",
          properties: {
            id: { type: "string" },
            isVisible: { type: "boolean" },
          },
        },
        404: {
          description: "Product not found",
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
      if (!canChangeProductVisibility(resolveAdminRoleKey(req.user))) {
        return reply.status(403).send({
          error: "This role cannot change product visibility",
        });
      }

      const { isVisible } = z
        .object({ isVisible: z.boolean() })
        .parse(req.body);
      const exists = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!exists)
        return reply.status(404).send({ error: "Product not found" });
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: { isVisible },
        select: { id: true, isVisible: true },
      });
      await audit({
        adminId: req.user.sub,
        action: "product.visibility_changed",
        resourceType: "product",
        resourceId: req.params.id,
        after: { isVisible },
      });
      return reply.send(product);
    },
  });

  // DELETE /admin/products/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a product. Returns 409 if the product has any order history.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Product deleted" },
        409: {
          description: "Product has order history",
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
      if (!canDeleteProduct(resolveAdminRoleKey(req.user))) {
        return reply.status(403).send({
          error: "This role cannot delete products",
        });
      }

      const orderCount = await prisma.orderItem.count({
        where: { productId: req.params.id },
      });
      if (orderCount > 0)
        return reply
          .status(409)
          .send({ error: "Cannot delete: product has order history" });
      await prisma.product.delete({ where: { id: req.params.id } });
      await cacheDelPattern(`products:*`);
      await audit({
        adminId: req.user.sub,
        action: "product.deleted",
        resourceType: "product",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });

  // POST /admin/products/:id/suppliers
  fastify.post<{ Params: { id: string } }>("/:id/suppliers", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Add a supplier entry for a product, including purchase cost and currency.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: [
          "supplierName",
          "supplierPrice",
          "priceWithDelivery",
          "deliveryTax",
          "otherCosts",
        ],
        properties: {
          supplierName: { type: "string", example: "Guangzhou Textile Co." },
          supplierLink: {
            type: "string",
            example: "https://alibaba.com/product",
          },
          address: { type: "string", nullable: true },
          contact: { type: "string", nullable: true },
          currencyRateId: { type: "string", format: "uuid" },
          supplierPrice: { type: "number", example: 1200 },
          priceWithDelivery: { type: "number", example: 1450 },
          deliveryTax: { type: "number", example: 180 },
          otherCosts: { type: "number", example: 70 },
          isDefault: { type: "boolean", default: false },
          notes: { type: "string", nullable: true },
        },
      },
      response: {
        201: { description: "Supplier added", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateProductSupplierSchema.parse(req.body);
      const supplier = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.productSupplier.updateMany({
            where: { productId: req.params.id },
            data: { isDefault: false },
          });
        }
        return tx.productSupplier.create({
          data: { ...body, productId: req.params.id },
        });
      });
      return reply.status(201).send(supplier);
    },
  });

  // PATCH /admin/products/:id/suppliers/:supplierId
  fastify.patch<{ Params: { id: string; supplierId: string } }>(
    "/:id/suppliers/:supplierId",
    {
      preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
      schema: {
        tags: ["Admin Products"],
        security: [{ bearerAuth: [] }],
        description: "Update a product supplier entry.",
        params: {
          type: "object",
          required: ["id", "supplierId"],
          properties: {
            id: { type: "string", format: "uuid" },
            supplierId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            supplierName: { type: "string" },
            supplierLink: { type: "string" },
            supplierPrice: { type: "number" },
            priceWithDelivery: { type: "number" },
            deliveryTax: { type: "number" },
            otherCosts: { type: "number" },
            isDefault: { type: "boolean" },
            notes: { type: "string" },
          },
        },
        response: {
          200: { description: "Supplier updated", type: "object" },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        const body = CreateProductSupplierSchema.partial().parse(req.body);
        const supplier = await prisma.$transaction(async (tx) => {
          if (body.isDefault) {
            const current = await tx.productSupplier.findUnique({
              where: { id: req.params.supplierId },
              select: { productId: true },
            });

            if (current) {
              await tx.productSupplier.updateMany({
                where: {
                  productId: current.productId,
                  id: { not: req.params.supplierId },
                },
                data: { isDefault: false },
              });
            }
          }

          return tx.productSupplier.update({
            where: { id: req.params.supplierId },
            data: body,
          });
        });
        return reply.send(supplier);
      },
    },
  );

  // DELETE /admin/products/:id/suppliers/:supplierId
  fastify.delete<{ Params: { id: string; supplierId: string } }>(
    "/:id/suppliers/:supplierId",
    {
      preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
      schema: {
        tags: ["Admin Products"],
        security: [{ bearerAuth: [] }],
        description: "Remove a supplier entry from a product.",
        params: {
          type: "object",
          required: ["id", "supplierId"],
          properties: {
            id: { type: "string", format: "uuid" },
            supplierId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: { description: "Supplier deleted" },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        await prisma.productSupplier.delete({
          where: { id: req.params.supplierId },
        });
        return reply.status(204).send();
      },
    },
  );

  // POST /admin/products/:id/competitors
  fastify.post<{ Params: { id: string } }>("/:id/competitors", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description: "Add a competitor price reference for a product.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          link: { type: "string", example: "https://competitor.com/product" },
          price: { type: "number", example: 299.99 },
          comments: { type: "string", nullable: true },
        },
      },
      response: {
        201: { description: "Competitor entry created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateProductCompetitorSchema.parse(req.body);
      const competitor = await prisma.productCompetitor.create({
        data: {
          ...body,
          link: body.link ?? "",
          price: body.price ?? 0,
          productId: req.params.id,
        },
      });
      return reply.status(201).send(competitor);
    },
  });

  // PATCH /admin/products/:id/competitors/:competitorId
  fastify.patch<{ Params: { id: string; competitorId: string } }>(
    "/:id/competitors/:competitorId",
    {
      preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
      schema: {
        tags: ["Admin Products"],
        security: [{ bearerAuth: [] }],
        description: "Update a competitor price entry for a product.",
        params: {
          type: "object",
          required: ["id", "competitorId"],
          properties: {
            id: { type: "string", format: "uuid" },
            competitorId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            link: { type: "string" },
            price: { type: "number" },
            comments: { type: "string", nullable: true },
          },
        },
        response: {
          200: { description: "Competitor entry updated", type: "object" },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        const body = CreateProductCompetitorSchema.partial().parse(req.body);
        const competitor = await prisma.productCompetitor.update({
          where: { id: req.params.competitorId },
          data: body,
        });
        return reply.send(competitor);
      },
    },
  );

  // DELETE /admin/products/:id/competitors/:competitorId
  fastify.delete<{ Params: { id: string; competitorId: string } }>(
    "/:id/competitors/:competitorId",
    {
      preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
      schema: {
        tags: ["Admin Products"],
        security: [{ bearerAuth: [] }],
        description: "Remove a competitor price entry from a product.",
        params: {
          type: "object",
          required: ["id", "competitorId"],
          properties: {
            id: { type: "string", format: "uuid" },
            competitorId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: { description: "Competitor entry deleted" },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
      handler: async (req, reply) => {
        await prisma.productCompetitor.delete({
          where: { id: req.params.competitorId },
        });
        return reply.status(204).send();
      },
    },
  );

  // PATCH /admin/products/:id/media/:mediaId — soft-delete a media item
  fastify.patch<{ Params: { id: string; mediaId: string } }>(
    "/:id/media/:mediaId",
    {
      preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
      schema: {
        tags: ["Admin Products"],
        security: [{ bearerAuth: [] }],
        description:
          "Soft-delete or restore a product media item by setting isDeleted.",
        params: {
          type: "object",
          required: ["id", "mediaId"],
          properties: {
            id: { type: "string", format: "uuid" },
            mediaId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["isDeleted"],
          properties: { isDeleted: { type: "boolean", example: true } },
        },
        response: {
          200: {
            description: "Media item updated",
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
        const { isDeleted } = z
          .object({ isDeleted: z.boolean() })
          .parse(req.body);
        await prisma.productMedia.updateMany({
          where: { id: req.params.mediaId, productId: req.params.id },
          data: { isDeleted } as never,
        });
        return reply.send({ success: true });
      },
    },
  );

  // PATCH /admin/products/:id/media/reorder — kept for backward-compat; prefer
  // using the media[] array in PATCH /:id which handles reorder via position.
  fastify.patch<{ Params: { id: string } }>("/:id/media/reorder", {
    preHandler: [fastify.requirePermission(Permissions.PRODUCTS_EDIT)],
    schema: {
      tags: ["Admin Products"],
      security: [{ bearerAuth: [] }],
      description:
        "Reorder product media items by providing an ordered array of media IDs. Prefer the media[] array in PATCH /:id which handles reorder via position.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["orderedIds"],
        properties: {
          orderedIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
            example: ["uuid1", "uuid2"],
          },
        },
      },
      response: {
        200: {
          description: "Media reordered",
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
      const { orderedIds } = z
        .object({ orderedIds: z.array(z.string().uuid()) })
        .parse(req.body);
      await prisma.$transaction(
        orderedIds.map((id, position) =>
          prisma.productMedia.update({ where: { id }, data: { position } }),
        ),
      );
      return reply.send({ success: true });
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// BUG-4: Collect the direct category IDs PLUS all their ancestors so that
// attributes defined on parent/grandparent categories pass validation.
async function getAllAncestorCategoryIds(
  categoryIds: string[],
): Promise<string[]> {
  const all = new Set(categoryIds);
  const cats = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { parentId: true },
  });
  const parentIds = cats.flatMap((c) => (c.parentId ? [c.parentId] : []));
  if (parentIds.length === 0) return [...all];
  const grandparents = await prisma.category.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, parentId: true },
  });
  for (const p of grandparents) {
    all.add(p.id);
    if (p.parentId) all.add(p.parentId);
  }
  return [...all];
}

// BUG-A: Returns true if valid, false (and sends 422) if invalid.
async function validateAttributes(
  categoryIds: string[],
  attributes: { attributeDefinitionId: string; attributeOptionIds: string[] }[],
  reply: { status: (code: 422) => { send: (data: unknown) => unknown } },
): Promise<boolean> {
  // Include ancestor categories so attributes defined up the hierarchy are allowed
  const allCategoryIds = await getAllAncestorCategoryIds(categoryIds);

  const allowedAttrs = await prisma.attributeDefinition.findMany({
    where: {
      categories: { some: { categoryId: { in: allCategoryIds } } },
    },
    select: { id: true, options: { select: { id: true } } },
  });

  const allowedAttrIds = new Set(allowedAttrs.map((a) => a.id));
  const allowedOptionIds = new Set(
    allowedAttrs.flatMap((a) => a.options.map((o) => o.id)),
  );

  for (const attr of attributes) {
    if (!allowedAttrIds.has(attr.attributeDefinitionId)) {
      reply.status(422).send({
        error: `Attribute ${attr.attributeDefinitionId} is not valid for the selected categories`,
      });
      return false;
    }
    for (const optId of attr.attributeOptionIds) {
      if (!allowedOptionIds.has(optId)) {
        reply.status(422).send({
          error: `Option ${optId} is not valid for attribute ${attr.attributeDefinitionId}`,
        });
        return false;
      }
    }
  }
  return true;
}
