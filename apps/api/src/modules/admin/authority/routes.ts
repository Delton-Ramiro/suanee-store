import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  CreateAdminUserSchema,
  UpdateAdminUserSchema,
  Permissions,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { offsetPaginate } from "../../../lib/utils.js";
import {
  resolveAdminPermissions,
  resolveAdminRoleAssignment,
  resolveAdminRoleKey,
} from "../../../lib/admin-roles.js";

const AdminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default async function adminAuthorityRoutes(fastify: FastifyInstance) {
  // GET /admin/authority
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description:
        "List all admin users with their profiles and permission bitmasks. Requires AUTHORITY_MANAGE permission.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          description: "Admin list",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
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
      const q = AdminListQuery.parse(req.query);
      const [total, admins] = await Promise.all([
        prisma.adminUser.count(),
        prisma.adminUser.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            roleKey: true,
            permissions: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
      ]);
      const paged = offsetPaginate(admins, total, q.page, q.limit);
      return reply.send({
        ...paged,
        items: paged.items.map((a) => ({
          ...a,
          roleKey: resolveAdminRoleKey(a),
          permissions: resolveAdminPermissions(a),
        })),
      });
    },
  });

  // POST /admin/authority
  fastify.post("/", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description:
        "Create a new admin user. Accepts either a system roleKey or a raw permissions bitmask. Returns 409 if the email is already in use.",
      body: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Jane Doe" },
          email: {
            type: "string",
            format: "email",
            example: "jane@multitraders.co.mz",
          },
          password: { type: "string", minLength: 8 },
          roleKey: {
            type: "string",
            enum: [
              "super_admin",
              "admin_no_role_mgr",
              "order_operator",
              "customer_care",
              "finance",
              "product_analyst",
              "content_manager",
            ],
            nullable: true,
          },
          permissions: {
            type: "integer",
            description:
              "Permission bitmask (used when roleKey is not provided)",
            example: 3,
          },
          avatarUrl: { type: "string", nullable: true },
        },
      },
      response: {
        201: { description: "Admin created", type: "object" },
        409: {
          description: "Email already in use",
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
      const body = CreateAdminUserSchema.parse(req.body);
      const roleAssignment = resolveAdminRoleAssignment(body);
      const existing = await prisma.adminUser.findUnique({
        where: { email: body.email },
      });
      if (existing)
        return reply.status(409).send({ error: "Email already in use" });

      const hash = await bcrypt.hash(body.password, 12);
      const admin = await prisma.adminUser.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash: hash,
          permissions: BigInt(roleAssignment.permissions ?? 0),
          roleKey: roleAssignment.roleKey ?? null,
          ...(body.avatarUrl !== undefined
            ? { avatarUrl: body.avatarUrl }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          roleKey: true,
          permissions: true,
          isActive: true,
          createdAt: true,
        },
      });

      await audit({
        adminId: req.user.sub,
        action: "authority.created",
        resourceType: "admin_user",
        resourceId: admin.id,
        after: {
          email: body.email,
          roleKey: roleAssignment.roleKey ?? null,
          permissions: roleAssignment.permissions,
        },
      });

      return reply.status(201).send({
        ...admin,
        roleKey: resolveAdminRoleKey(admin),
        permissions: resolveAdminPermissions(admin),
      });
    },
  });

  // PATCH /admin/authority/:id
  fastify.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description: "Update an admin username or permission bitmask.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          roleKey: {
            type: "string",
            enum: [
              "super_admin",
              "admin_no_role_mgr",
              "order_operator",
              "customer_care",
              "finance",
              "product_analyst",
              "content_manager",
            ],
            nullable: true,
          },
          permissions: { type: "integer" },
          avatarUrl: { type: "string", nullable: true },
        },
      },
      response: {
        200: { description: "Admin updated", type: "object" },
        404: {
          description: "Admin not found",
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
      const body = UpdateAdminUserSchema.parse(req.body);
      const before = await prisma.adminUser.findUnique({
        where: { id: req.params.id },
        select: { name: true, roleKey: true, permissions: true },
      });
      if (!before) return reply.status(404).send({ error: "Admin not found" });

      const roleAssignment = resolveAdminRoleAssignment(
        body,
        Number(before.permissions),
      );
      const shouldUpdateRoleAssignment =
        body.roleKey !== undefined || body.permissions !== undefined;

      const admin = await prisma.adminUser.update({
        where: { id: req.params.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(shouldUpdateRoleAssignment
            ? {
                roleKey: roleAssignment.roleKey ?? null,
                permissions: BigInt(
                  roleAssignment.permissions ?? Number(before.permissions),
                ),
              }
            : {}),
          ...(body.avatarUrl !== undefined
            ? { avatarUrl: body.avatarUrl }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          roleKey: true,
          permissions: true,
          isActive: true,
        },
      });

      await audit({
        adminId: req.user.sub,
        action: "authority.updated",
        resourceType: "admin_user",
        resourceId: req.params.id,
        before,
        after: {
          ...body,
          ...(shouldUpdateRoleAssignment
            ? {
                roleKey: roleAssignment.roleKey ?? null,
                permissions: roleAssignment.permissions,
              }
            : {}),
        },
      });

      return reply.send({
        ...admin,
        roleKey: resolveAdminRoleKey(admin),
        permissions: resolveAdminPermissions(admin),
      });
    },
  });

  // PATCH /admin/authority/:id/deactivate
  fastify.patch<{ Params: { id: string } }>("/:id/deactivate", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description:
        "Deactivate an admin account, preventing future logins. Cannot deactivate your own account.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Deactivated",
          type: "object",
          properties: { success: { type: "boolean" } },
        },
        422: {
          description: "Cannot deactivate yourself",
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
      if (req.params.id === req.user.sub)
        return reply.status(422).send({ error: "Cannot deactivate yourself" });
      await prisma.adminUser.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      await audit({
        adminId: req.user.sub,
        action: "authority.deactivated",
        resourceType: "admin_user",
        resourceId: req.params.id,
      });
      return reply.send({ success: true });
    },
  });

  // PATCH /admin/authority/:id/activate
  fastify.patch<{ Params: { id: string } }>("/:id/activate", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description: "Re-activate a previously deactivated admin account.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          description: "Activated",
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
      await prisma.adminUser.update({
        where: { id: req.params.id },
        data: { isActive: true },
      });
      await audit({
        adminId: req.user.sub,
        action: "authority.activated",
        resourceType: "admin_user",
        resourceId: req.params.id,
      });
      return reply.send({ success: true });
    },
  });

  // GET /admin/authority/audit-log
  fastify.get("/audit-log", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Authority"],
      security: [{ bearerAuth: [] }],
      description:
        "Retrieve the admin audit log. Filter by admin or resource type. Returns cursor-paginated entries ordered newest first.",
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", default: 50, minimum: 1, maximum: 100 },
          adminId: { type: "string", format: "uuid" },
          resourceType: { type: "string", example: "product" },
        },
      },
      response: {
        200: {
          description: "Audit log entries",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
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
      const q = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(50),
          adminId: z.string().uuid().optional(),
          resourceType: z.string().optional(),
        })
        .parse(req.query);

      const where = {
        ...(q.adminId ? { adminId: q.adminId } : {}),
        ...(q.resourceType ? { resourceType: q.resourceType } : {}),
      };

      const [total, logs] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { createdAt: "desc" },
          include: { admin: { select: { id: true, name: true } } },
        }),
      ]);

      return reply.send(offsetPaginate(logs, total, q.page, q.limit));
    },
  });
}
