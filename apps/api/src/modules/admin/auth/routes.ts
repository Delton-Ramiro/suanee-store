import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "../../../lib/prisma.js";
import {
  AdminLoginSchema,
  ResetPasswordSchema,
  FcmTokenSchema,
} from "@ecommerce/types";
import { audit } from "../../../lib/audit.js";
import { Permissions } from "@ecommerce/types";
import { redis } from "../../../lib/redis.js";
import { sendPasswordResetRequestEmail } from "../../../lib/resend.js";
import {
  resolveAdminPermissions,
  resolveAdminRoleKey,
} from "../../../lib/admin-roles.js";

export default async function adminAuthRoutes(fastify: FastifyInstance) {
  // POST /admin/auth/login
  fastify.post("/login", {
    config: { rateLimit: { max: 100000, timeWindow: "1 minute" } },
    schema: {
      tags: ["Admin Auth"],
      description:
        "Authenticate an admin user with email and password. Returns a bearer JWT valid for 8 hours.",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "admin@multitraders.co.mz",
          },
          password: { type: "string", minLength: 8, example: "SuperSecret123" },
        },
      },
      response: {
        200: {
          description: "Login successful",
          type: "object",
          properties: {
            token: { type: "string", description: "Bearer JWT (8h)" },
            admin: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                email: { type: "string" },
                avatarUrl: { type: "string", nullable: true },
                roleKey: { type: "string", nullable: true },
                permissions: {
                  type: "integer",
                  description: "Bitmask of granted permissions",
                },
              },
            },
          },
        },
        401: {
          description: "Invalid credentials or inactive account",
          type: "object",
          properties: { error: { type: "string" } },
        },
        429: {
          description: "Rate limit exceeded (10 req/min)",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = AdminLoginSchema.parse(req.body);

      const admin = await prisma.adminUser.findUnique({
        where: { email: body.email },
      });
      if (!admin || !admin.isActive) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(body.password, admin.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      await audit({
        adminId: admin.id,
        action: "admin.login",
        resourceType: "admin_user",
        resourceId: admin.id,
      });

      const token = fastify.jwt.admin.sign({
        sub: admin.id,
        type: "admin",
      });

      return reply.send({
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          avatarUrl: admin.avatarUrl,
          roleKey: resolveAdminRoleKey(admin),
          permissions: resolveAdminPermissions(admin),
        },
      });
    },
  });

  // GET /admin/auth/me
  fastify.get("/me", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description: "Return the authenticated admin's profile.",
      response: {
        200: {
          description: "Admin profile",
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            roleKey: { type: "string", nullable: true },
            permissions: { type: "integer" },
          },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Admin not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const admin = await prisma.adminUser.findUnique({
        where: { id: req.user.sub },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          roleKey: true,
          permissions: true,
        },
      });
      if (!admin) return reply.status(404).send({ error: "Not found" });
      return reply.send({
        ...admin,
        roleKey: resolveAdminRoleKey(admin),
        permissions: resolveAdminPermissions(admin),
      });
    },
  });

  // POST /admin/auth/logout — blacklists the JWT so it cannot be reused
  fastify.post("/logout", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Invalidate the current admin JWT by blacklisting its signature in Redis.",
      response: {
        200: {
          description: "Logged out",
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
      // Blacklist token by storing its signature in Redis until it expires.
      const rawToken = req.headers.authorization?.split(" ")[1];
      if (rawToken) {
        const sig = rawToken.split(".")[2];
        if (sig) {
          // Decode expiry from payload to set an accurate TTL
          try {
            const payloadB64 = rawToken.split(".")[1];
            const payload = JSON.parse(
              Buffer.from(payloadB64!, "base64url").toString(),
            ) as { exp?: number };
            const ttl = payload.exp
              ? Math.max(payload.exp - Math.floor(Date.now() / 1000), 1)
              : 8 * 60 * 60; // fallback: 8h
            await redis.set(`admin:blacklist:${sig}`, "1", "EX", ttl);
          } catch {
            // If decode fails, blacklist for the max token lifetime
            await redis.set(`admin:blacklist:${sig}`, "1", "EX", 8 * 60 * 60);
          }
        }
      }
      await audit({
        adminId: req.user.sub,
        action: "admin.logout",
        resourceType: "admin_user",
        resourceId: req.user.sub,
      });
      return reply.send({ success: true });
    },
  });

  // POST /admin/auth/request-password-reset — admin requests their own password change
  // Body: { newPassword } — the desired new password (hashed and stored pending super admin approval)
  fastify.post("/request-password-reset", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Admin requests a password change. The new password is stored pending super-admin approval. An email is sent to the super-admin with an approval link.",
      body: {
        type: "object",
        required: ["newPassword"],
        properties: {
          newPassword: {
            type: "string",
            minLength: 8,
            example: "NewPassword456",
          },
        },
      },
      response: {
        201: {
          description: "Request created",
          type: "object",
          properties: {
            success: { type: "boolean" },
            requestId: { type: "string", format: "uuid" },
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
      const { newPassword } = ResetPasswordSchema.parse(req.body);

      const admin = await prisma.adminUser.findUnique({
        where: { id: req.user.sub },
        select: { id: true, name: true, email: true },
      });
      if (!admin) return reply.status(404).send({ error: "Not found" });

      // Hash the desired new password and store as a pending request
      const newPwdHash = await bcrypt.hash(newPassword, 12);
      const token = randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(token, 10);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Remove any existing pending requests for this admin
      await prisma.adminPasswordResetRequest.deleteMany({
        where: { adminId: admin.id },
      });

      const request = await prisma.adminPasswordResetRequest.create({
        data: {
          adminId: admin.id,
          tokenHash,
          newPwdHash,
          expiresAt,
        },
      });

      // Notify super admin by email
      const superAdminEmail =
        process.env["SUPER_ADMIN_EMAIL"] ??
        process.env["ADMIN_EMAIL"] ??
        "admin@app.com";
      const approvalUrl = `${process.env["ADMIN_URL"] ?? "#"}/auth/approve-reset/${token}`;
      await sendPasswordResetRequestEmail({
        superAdminEmail,
        adminName: admin.name,
        adminEmail: admin.email,
        approvalUrl,
      }).catch(() => undefined); // fire-and-forget; don't block on email failure

      return reply.status(201).send({ success: true, requestId: request.id });
    },
  });

  // POST /admin/auth/approve-reset/:token — super admin approves a pending password reset
  fastify.post<{ Params: { token: string } }>("/approve-reset/:token", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Super-admin approves a pending password-reset request by supplying the one-time token from the approval email. Requires AUTHORITY_MANAGE permission.",
      params: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            description: "One-time approval token from the email link",
          },
        },
      },
      response: {
        200: {
          description: "Password reset approved",
          type: "object",
          properties: {
            success: { type: "boolean" },
            adminEmail: { type: "string" },
          },
        },
        404: {
          description: "Token not found or expired",
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
      const { token } = req.params;

      // Find all non-expired requests and validate the token against each
      const pending = await prisma.adminPasswordResetRequest.findMany({
        where: { expiresAt: { gt: new Date() } },
        include: { admin: { select: { id: true, name: true, email: true } } },
      });

      let matched: (typeof pending)[number] | null = null;
      for (const r of pending) {
        if (await bcrypt.compare(token, r.tokenHash)) {
          matched = r;
          break;
        }
      }

      if (!matched) {
        return reply.status(404).send({ error: "Token not found or expired" });
      }

      await prisma.$transaction([
        prisma.adminUser.update({
          where: { id: matched.adminId },
          data: { passwordHash: matched.newPwdHash },
        }),
        prisma.adminPasswordResetRequest.delete({ where: { id: matched.id } }),
      ]);

      await audit({
        adminId: req.user.sub,
        action: "admin.reset_password_approved",
        resourceType: "admin_user",
        resourceId: matched.adminId,
      });

      return reply.send({ success: true, adminEmail: matched.admin.email });
    },
  });

  // POST /admin/auth/reset-password/:adminId (superadmin resets another admin's password)
  fastify.post<{ Params: { adminId: string } }>("/reset-password/:adminId", {
    preHandler: [fastify.requirePermission(Permissions.AUTHORITY_MANAGE)],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Super-admin directly resets another admin's password. Requires AUTHORITY_MANAGE permission.",
      params: {
        type: "object",
        required: ["adminId"],
        properties: { adminId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["newPassword"],
        properties: {
          newPassword: {
            type: "string",
            minLength: 8,
            example: "NewPassword456",
          },
        },
      },
      response: {
        200: {
          description: "Password reset",
          type: "object",
          properties: { success: { type: "boolean" } },
        },
        404: {
          description: "Admin not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = ResetPasswordSchema.parse(req.body);
      const hash = await bcrypt.hash(body.newPassword, 12);

      const before = await prisma.adminUser.findUnique({
        where: { id: req.params.adminId },
        select: { email: true },
      });
      if (!before) return reply.status(404).send({ error: "Admin not found" });

      await prisma.adminUser.update({
        where: { id: req.params.adminId },
        data: { passwordHash: hash },
      });

      await audit({
        adminId: req.user.sub,
        action: "admin.reset_password",
        resourceType: "admin_user",
        resourceId: req.params.adminId,
      });

      return reply.send({ success: true });
    },
  });

  // POST /admin/auth/fcm-token — register or refresh a device FCM push token
  fastify.post("/fcm-token", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Register or refresh a device FCM push token for the authenticated admin. Used to send push notifications to admin devices.",
      body: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", example: "fcm-device-token-string" },
        },
      },
      response: {
        200: {
          description: "Token registered",
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
      const { token } = FcmTokenSchema.parse(req.body);

      const admin = await prisma.adminUser.findUnique({
        where: { id: req.user.sub },
        select: { fcmTokens: true },
      });
      if (!admin) return reply.status(404).send({ error: "Not found" });

      // Keep unique tokens, cap at 10 devices per admin
      const tokens = [...new Set([...admin.fcmTokens, token])].slice(-10);
      await prisma.adminUser.update({
        where: { id: req.user.sub },
        data: { fcmTokens: tokens },
      });

      return reply.send({ success: true });
    },
  });

  // DELETE /admin/auth/fcm-token — remove a device FCM token on logout
  fastify.delete("/fcm-token", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Unregister a Firebase Cloud Messaging token for the admin, typically called on logout.",
      body: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string", minLength: 1, maxLength: 256 } },
      },
      response: {
        200: {
          description: "Token removed",
          type: "object",
          properties: { success: { type: "boolean" } },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "Admin not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { token } = FcmTokenSchema.parse(req.body);

      const admin = await prisma.adminUser.findUnique({
        where: { id: req.user.sub },
        select: { fcmTokens: true },
      });
      if (!admin) return reply.status(404).send({ error: "Not found" });

      await prisma.adminUser.update({
        where: { id: req.user.sub },
        data: { fcmTokens: admin.fcmTokens.filter((t) => t !== token) },
      });

      return reply.send({ success: true });
    },
  });
}
