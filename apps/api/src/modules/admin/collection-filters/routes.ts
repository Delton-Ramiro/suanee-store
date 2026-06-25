import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateCollectionFilterSchema,
  UpdateCollectionFilterSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "position"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminCollectionFiltersRoutes(
  fastify: FastifyInstance,
) {
  // GET /admin/collection-filters
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          search: { type: "string" },
          sortBy: {
            type: "string",
            enum: ["name", "createdAt", "position"],
            default: "createdAt",
          },
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
      const q = QuerySchema.parse(req.query);
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { slug: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const include = {
        collections: { select: { collectionId: true } },
        options: { orderBy: { position: "asc" as const } },
      };
      const orderBy = { [q.sortBy]: q.sortOrder };
      const [total, filters] = await Promise.all([
        prisma.collectionFilter.count({ where }),
        prisma.collectionFilter.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy,
          include,
        }),
      ]);
      return reply.send(offsetPaginate(filters, total, q.page, q.limit));
    },
  });

  // GET /admin/collection-filters/by-collection
  fastify.get("/by-collection", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        required: ["collectionIds"],
        properties: {
          collectionIds: { type: "string", description: "Comma-separated collection UUIDs" },
        },
      },
      response: {
        200: { type: "array", items: { type: "object" } },
      },
    },
    handler: async (req, reply) => {
      const { collectionIds } = z
        .object({ collectionIds: z.string() })
        .parse(req.query);
      const ids = collectionIds.split(",").filter(Boolean);
      const filters = await prisma.collectionFilter.findMany({
        where: {
          collections: { some: { collectionId: { in: ids } } },
          isActive: true,
        },
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      });
      return reply.send(filters);
    },
  });

  // POST /admin/collection-filters
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name", "inputType", "collectionIds", "options"],
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          inputType: { type: "string", enum: ["select", "multi_select", "boolean"] },
          isActive: { type: "boolean", default: true },
          position: { type: "integer", default: 0 },
          collectionIds: { type: "array", items: { type: "string", format: "uuid" } },
          options: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "value"],
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                position: { type: "integer", default: 0 },
              },
            },
          },
        },
      },
      response: {
        201: { type: "object" },
      },
    },
    handler: async (req, reply) => {
      const body = CreateCollectionFilterSchema.parse(req.body);
      const { options, collectionIds, ...data } = body;

      if (!data.slug) {
        data.slug = data.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");
      }

      const filter = await prisma.collectionFilter.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          ...data,
          options: { create: options },
          collections: {
            create: collectionIds.map((id) => ({ collectionId: id })),
          },
        } as any,
        include: {
          options: true,
          collections: { select: { collectionId: true } },
        },
      });
      await audit({
        adminId: req.user.sub,
        action: "collection_filter.created",
        resourceType: "collection_filter",
        resourceId: filter.id,
        after: body,
      });
      return reply.status(201).send(filter);
    },
  });

  // PATCH /admin/collection-filters/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
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
          isActive: { type: "boolean" },
          collectionIds: { type: "array", items: { type: "string", format: "uuid" } },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                label: { type: "string" },
                value: { type: "string" },
                position: { type: "integer" },
              },
            },
          },
        },
      },
      response: {
        200: { type: "object" },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const body = UpdateCollectionFilterSchema.parse(req.body);
      const { options, collectionIds, ...data } = body;

      const before = await prisma.collectionFilter.findUnique({
        where: { id: req.params.id },
      });
      if (!before)
        return reply.status(404).send({ error: "Collection filter not found" });

      try {
        await prisma.$transaction(async (tx) => {
          if (collectionIds !== undefined) {
            await tx.collectionFilterCollection.deleteMany({
              where: { collectionFilterId: req.params.id },
            });
            await tx.collectionFilterCollection.createMany({
              data: collectionIds.map((id) => ({
                collectionFilterId: req.params.id,
                collectionId: id,
              })),
            });
          }

          if (options !== undefined) {
            const submittedIds = options
              .map((o) => o.id)
              .filter((id): id is string => !!id);

            const existingOptions = await tx.collectionFilterOption.findMany({
              where: { collectionFilterId: req.params.id },
              select: { id: true },
            });
            const removedIds = existingOptions
              .map((o) => o.id)
              .filter((id) => !submittedIds.includes(id));

            if (removedIds.length > 0) {
              await tx.collectionFilterOption.deleteMany({
                where: { id: { in: removedIds } },
              });
            }

            for (const opt of options) {
              if (opt.id) {
                await tx.collectionFilterOption.update({
                  where: { id: opt.id },
                  data: { label: opt.label, value: opt.value, position: opt.position },
                });
              } else {
                await tx.collectionFilterOption.create({
                  data: {
                    collectionFilterId: req.params.id,
                    label: opt.label,
                    value: opt.value,
                    position: opt.position ?? 0,
                  },
                });
              }
            }
          }

          await tx.collectionFilter.update({
            where: { id: req.params.id },
            data,
          });
        });

        const filter = await prisma.collectionFilter.findUnique({
          where: { id: req.params.id },
          include: {
            options: { orderBy: { position: "asc" } },
            collections: { select: { collectionId: true } },
          },
        });
        await audit({
          adminId: req.user.sub,
          action: "collection_filter.updated",
          resourceType: "collection_filter",
          resourceId: req.params.id,
          before,
          after: body,
        });
        return reply.send(filter);
      } catch (err: any) {
        throw err;
      }
    },
  });

  // DELETE /admin/collection-filters/options/:optionId
  fastify.delete<{ Params: { optionId: string } }>("/options/:optionId", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["optionId"],
        properties: { optionId: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Option deleted" },
      },
    },
    handler: async (req, reply) => {
      await prisma.collectionFilterOption.delete({
        where: { id: req.params.optionId },
      });
      await audit({
        adminId: req.user.sub,
        action: "collection_filter_option.deleted",
        resourceType: "collection_filter_option",
        resourceId: req.params.optionId,
      });
      return reply.status(204).send();
    },
  });

  // DELETE /admin/collection-filters/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Collection Filters"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Filter deleted" },
      },
    },
    handler: async (req, reply) => {
      await prisma.collectionFilter.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "collection_filter.deleted",
        resourceType: "collection_filter",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
