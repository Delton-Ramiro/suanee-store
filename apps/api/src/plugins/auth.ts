import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { hasPermission } from "@ecommerce/types";
import {
  resolveAdminPermissions,
  resolveAdminRoleKey,
} from "../lib/admin-roles.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (
      req: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    requirePermission: (
      permission: number,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    clientJwtVerify: () => Promise<void>;
    adminJwtVerify: () => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      type: "user" | "admin";
    };
    user: {
      sub: string;
      type: "user" | "admin";
      permissions?: number;
      roleKey?: string | null;
    };
  }
  // @fastify/jwt sets fastify.jwt[namespace] at runtime when namespace option is used.
  // Augmenting the JWT interface here exposes fastify.jwt.client / fastify.jwt.admin.
  interface JWT {
    client: JWT;
    admin: JWT;
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  // Client JWT
  fastify.register(fastifyJwt, {
    secret: process.env["JWT_SECRET"] ?? "secret",
    sign: { expiresIn: process.env["JWT_EXPIRES_IN"] ?? "15m" },
    namespace: "client",
  });

  // Admin JWT (separate namespace/secret)
  fastify.register(fastifyJwt, {
    secret: process.env["ADMIN_JWT_SECRET"] ?? "admin-secret",
    sign: { expiresIn: process.env["ADMIN_JWT_EXPIRES_IN"] ?? "8h" },
    namespace: "admin",
  });

  fastify.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.clientJwtVerify();
        if (req.user.type !== "user") {
          return reply.status(403).send({ error: "Forbidden" });
        }
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    },
  );

  fastify.decorate(
    "authenticateAdmin",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.adminJwtVerify();
        if (req.user.type !== "admin") {
          return reply.status(403).send({ error: "Forbidden" });
        }
        // Check token is not blacklisted (post-logout)
        const rawToken = req.headers.authorization?.split(" ")[1];
        if (rawToken) {
          const sig = rawToken.split(".")[2];
          if (sig && (await redis.exists(`admin:blacklist:${sig}`))) {
            return reply.status(401).send({ error: "Token has been revoked" });
          }
        }
        // Check admin is still active
        const admin = await prisma.adminUser.findUnique({
          where: { id: req.user.sub },
          select: { isActive: true, permissions: true, roleKey: true },
        });
        if (!admin?.isActive) {
          return reply.status(403).send({ error: "Account deactivated" });
        }
        req.user.permissions = resolveAdminPermissions(admin);
        req.user.roleKey = resolveAdminRoleKey(admin);
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    },
  );

  fastify.decorate("requirePermission", (permission: number) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticateAdmin(req, reply);
      if (!hasPermission(req.user.permissions ?? 0, permission)) {
        return reply.status(403).send({ error: "Insufficient permissions" });
      }
    };
  });
});
