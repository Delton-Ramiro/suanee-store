import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateAttributeDefinitionSchema,
  UpdateAttributeDefinitionSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import { z } from "zod";

const FilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "position"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export default async function adminFiltersRoutes(fastify: FastifyInstance) {
  // GET /admin/filters — list all attribute definitions
  fastify.get("/", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "List all attribute definitions (filters) with their options and associated category IDs.",
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
          description: "Filter list",
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
      const q = FilterQuerySchema.parse(req.query);
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { slug: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const include = {
        categories: { select: { categoryId: true } },
        options: { orderBy: { position: "asc" as const } },
      };
      const orderBy = { [q.sortBy]: q.sortOrder };
      const [total, filters] = await Promise.all([
        prisma.attributeDefinition.count({ where }),
        prisma.attributeDefinition.findMany({
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

  // GET /admin/filters/by-category — get filters applicable to a category hierarchy
  fastify.get("/by-category", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "Get active filters applicable to a comma-separated list of category IDs.",
      querystring: {
        type: "object",
        required: ["categoryIds"],
        properties: {
          categoryIds: {
            type: "string",
            description: "Comma-separated category UUIDs",
            example: "uuid1,uuid2",
          },
        },
      },
      response: {
        200: {
          description: "Applicable filters with options",
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
      const { categoryIds } = z
        .object({ categoryIds: z.string() })
        .parse(req.query);
      const ids = categoryIds.split(",").filter(Boolean);

      const filters = await prisma.attributeDefinition.findMany({
        where: {
          categories: { some: { categoryId: { in: ids } } },
          isActive: true,
        },
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      });
      return reply.send(filters);
    },
  });

  // POST /admin/filters
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new attribute definition (filter) with its options and category associations.",
      body: {
        type: "object",
        required: ["name", "inputType", "categoryIds", "options"],
        properties: {
          name: { type: "string", example: "Material" },
          slug: { type: "string", example: "material" },
          inputType: {
            type: "string",
            enum: ["select", "multi_select", "boolean"],
            example: "multi_select",
          },
          isActive: { type: "boolean", default: true },
          position: { type: "integer", default: 0 },
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          options: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "value"],
              properties: {
                label: { type: "string", example: "Cotton" },
                value: { type: "string", example: "cotton" },
                position: { type: "integer", default: 0 },
              },
            },
          },
        },
      },
      response: {
        201: { description: "Filter created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateAttributeDefinitionSchema.parse(req.body);
      const { options, categoryIds, ...attrData } = body;

      // Auto-generate slug from name if not provided
      if (!attrData.slug) {
        attrData.slug = attrData.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");
      }

      const attr = await prisma.attributeDefinition.create({
        data: {
          ...attrData,
          options: { create: options },
          categories: {
            create: categoryIds.map((id) => ({ categoryId: id })),
          },
        },
        include: {
          options: true,
          categories: { select: { categoryId: true } },
        },
      });
      await audit({
        adminId: req.user.sub,
        action: "filter.created",
        resourceType: "attribute_definition",
        resourceId: attr.id,
        after: body,
      });
      return reply.status(201).send(attr);
    },
  });

  // PATCH /admin/filters/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "Update an attribute definition. Options with an id are updated in place; options without an id are created. Sending categoryIds replaces the full association list.",
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
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  description: "Omit to create a new option",
                },
                label: { type: "string" },
                value: { type: "string" },
                position: { type: "integer" },
              },
            },
          },
        },
      },
      response: {
        200: { description: "Filter updated", type: "object" },
        404: {
          description: "Filter not found",
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
      const body = UpdateAttributeDefinitionSchema.parse(req.body);
      const { options, categoryIds, ...attrData } = body;

      const before = await prisma.attributeDefinition.findUnique({
        where: { id: req.params.id },
      });
      if (!before) return reply.status(404).send({ error: "Filter not found" });

      try {
        await prisma.$transaction(async (tx) => {
          if (categoryIds !== undefined) {
            await tx.attributeDefinitionCategory.deleteMany({
              where: { attributeDefinitionId: req.params.id },
            });
            await tx.attributeDefinitionCategory.createMany({
              data: categoryIds.map((id) => ({
                attributeDefinitionId: req.params.id,
                categoryId: id,
              })),
            });
          }
          if (options !== undefined) {
            const submittedIds = options
              .map((o) => o.id)
              .filter((id): id is string => !!id);

            // Delete options that were removed (have an id but aren't in the new list),
            // only if they aren't referenced by any product
            const existingOptions = await tx.attributeOption.findMany({
              where: { attributeDefinitionId: req.params.id },
              select: { id: true },
            });
            const removedIds = existingOptions
              .map((o) => o.id)
              .filter((id) => !submittedIds.includes(id));

            if (removedIds.length > 0) {
              const inUseCount = await tx.productAttribute.count({
                where: { attributeOptionId: { in: removedIds } },
              });
              if (inUseCount > 0) {
                throw new Error(
                  `Cannot remove ${inUseCount} option(s) that are referenced by products`,
                );
              }
              await tx.attributeOption.deleteMany({
                where: { id: { in: removedIds } },
              });
            }

            // Upsert remaining / new options
            for (const opt of options) {
              if (opt.id) {
                await tx.attributeOption.update({
                  where: { id: opt.id },
                  data: {
                    label: opt.label,
                    value: opt.value,
                    position: opt.position,
                  },
                });
              } else {
                await tx.attributeOption.create({
                  data: {
                    attributeDefinitionId: req.params.id,
                    label: opt.label,
                    value: opt.value,
                    position: opt.position,
                  },
                });
              }
            }
          }
          await tx.attributeDefinition.update({
            where: { id: req.params.id },
            data: attrData,
          });
        });

        const attr = await prisma.attributeDefinition.findUnique({
          where: { id: req.params.id },
          include: {
            options: { orderBy: { position: "asc" } },
            categories: { select: { categoryId: true } },
          },
        });
        await audit({
          adminId: req.user.sub,
          action: "filter.updated",
          resourceType: "attribute_definition",
          resourceId: req.params.id,
          before,
          after: body,
        });
        return reply.send(attr);
      } catch (err: any) {
        if (err?.message?.includes("Cannot remove")) {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // DELETE /admin/filters/options/:optionId — guarded deletion of a filter option
  fastify.delete<{ Params: { optionId: string } }>("/options/:optionId", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a single filter option. Returns 409 if any products reference this option.",
      params: {
        type: "object",
        required: ["optionId"],
        properties: { optionId: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Option deleted" },
        409: {
          description: "Option referenced by products",
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
      const count = await prisma.productAttribute.count({
        where: { attributeOptionId: req.params.optionId },
      });
      if (count > 0) {
        return reply.status(409).send({
          error: `Cannot delete: ${count} products reference this filter option`,
        });
      }
      await prisma.attributeOption.delete({
        where: { id: req.params.optionId },
      });
      await audit({
        adminId: req.user.sub,
        action: "filter_option.deleted",
        resourceType: "attribute_option",
        resourceId: req.params.optionId,
      });
      return reply.status(204).send();
    },
  });

  // DELETE /admin/filters/:id
  fastify.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.FILTERS_EDIT)],
    schema: {
      tags: ["Admin Filters"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete an entire attribute definition. Returns 409 if any products have this attribute applied.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        204: { description: "Filter deleted" },
        409: {
          description: "Filter used by products",
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
      const count = await prisma.productAttribute.count({
        where: { definition: { id: req.params.id } },
      });
      if (count > 0) {
        return reply.status(409).send({
          error: `Cannot delete: ${count} product associations exist`,
        });
      }
      await prisma.attributeDefinition.delete({ where: { id: req.params.id } });
      await audit({
        adminId: req.user.sub,
        action: "filter.deleted",
        resourceType: "attribute_definition",
        resourceId: req.params.id,
      });
      return reply.status(204).send();
    },
  });
}
