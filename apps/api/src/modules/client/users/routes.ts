import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const UpdateProfileSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  whatsappNumber: z.string().min(7).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

const FcmTokenSchema = z.object({ token: z.string().min(1).max(256) });

export default async function clientUsersRoutes(fastify: FastifyInstance) {
  // GET /users/me — current user profile
  fastify.get("/me", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      description: "Returns the authenticated user's profile.",
      response: {
        200: {
          description: "User profile",
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            whatsappNumber: { type: "string", nullable: true },
            birthDate: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
        404: {
          description: "User not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          phone: true,
          whatsappNumber: true,
          birthDate: true,
          createdAt: true,
        },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return reply.send(user);
    },
  });

  // PATCH /users/me — update profile (phone, whatsapp, name)
  fastify.patch("/me", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      description:
        "Update the authenticated user's profile. At least one field must be provided.",
      body: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          phone: {
            type: "string",
            minLength: 7,
            maxLength: 20,
            example: "+258841234567",
          },
          whatsappNumber: {
            type: "string",
            minLength: 7,
            maxLength: 20,
            example: "+258841234567",
          },
          birthDate: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "ISO date: YYYY-MM-DD",
            example: "1995-08-21",
          },
        },
      },
      response: {
        200: { description: "Updated user profile", type: "object" },
        400: {
          description: "No fields provided",
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
      const body = UpdateProfileSchema.parse(req.body);

      if (
        !body.phone &&
        !body.whatsappNumber &&
        !body.name &&
        !body.birthDate
      ) {
        return reply
          .status(400)
          .send({ error: "At least one field is required" });
      }

      const user = await prisma.user.update({
        where: { id: req.user.sub },
        data: body,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          phone: true,
          whatsappNumber: true,
          birthDate: true,
          createdAt: true,
        },
      });
      return reply.send(user);
    },
  });

  // POST /users/me/fcm-token — register a device push token
  fastify.post("/me/fcm-token", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      description:
        "Register a Firebase Cloud Messaging token for push notifications. Tokens are deduplicated and capped at 10 per user.",
      body: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string", minLength: 1, maxLength: 256 } },
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
        404: {
          description: "User not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { token } = FcmTokenSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { fcmTokens: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      // Deduplicate and cap at 10 devices
      const tokens = [...new Set([...user.fcmTokens, token])].slice(-10);
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { fcmTokens: tokens },
      });

      return reply.send({ success: true });
    },
  });

  // DELETE /users/me/fcm-token — remove a device push token on logout
  fastify.delete("/me/fcm-token", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      description:
        "Unregister a Firebase Cloud Messaging token, typically called on user logout.",
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
          description: "User not found",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { token } = FcmTokenSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { fcmTokens: true },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      await prisma.user.update({
        where: { id: req.user.sub },
        data: { fcmTokens: user.fcmTokens.filter((t) => t !== token) },
      });

      return reply.send({ success: true });
    },
  });
}
