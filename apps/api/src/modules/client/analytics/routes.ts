import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

const CreateSessionSchema = z.object({
  anonymousId: z.string().uuid(),
  platform: z.enum(["web", "android", "ios"]),
  userId: z.string().uuid().optional(),
});

export default async function clientAnalyticsRoutes(fastify: FastifyInstance) {
  // POST /analytics/sessions — create or update a visitor session
  fastify.post("/sessions", {
    schema: {
      tags: ["Analytics"],
      description:
        "Create or update a visitor session for analytics tracking. If userId is provided, the session is linked to the authenticated user (auth required). Upserts on anonymousId.",
      body: {
        type: "object",
        required: ["anonymousId", "platform"],
        properties: {
          anonymousId: {
            type: "string",
            format: "uuid",
            description: "Stable client-generated UUID",
          },
          platform: { type: "string", enum: ["web", "android", "ios"] },
          userId: {
            type: "string",
            format: "uuid",
            description:
              "Optional: link to authenticated user (requires bearer token matching this userId)",
          },
        },
      },
      response: {
        201: { description: "Session created or updated", type: "object" },
        401: {
          description: "Auth required to link user session",
          type: "object",
          properties: { error: { type: "string" } },
        },
        403: {
          description: "Cannot link session to another user",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = CreateSessionSchema.parse(req.body);

      // SEC-2: If linking to a user account, verify auth and ensure the caller
      // can only link their own userId (not an arbitrary one).
      if (body.userId) {
        try {
          await req.clientJwtVerify();
          if (
            (req.user as { type?: string; sub?: string }).type !== "user" ||
            (req.user as { sub?: string }).sub !== body.userId
          ) {
            return reply
              .status(403)
              .send({ error: "Cannot link session to another user account" });
          }
        } catch {
          return reply
            .status(401)
            .send({ error: "Authentication required to link user session" });
        }
      }

      const session = await prisma.visitorSession.upsert({
        where: { anonymousId: body.anonymousId },
        create: {
          anonymousId: body.anonymousId,
          platform: body.platform as never,
          userId: body.userId,
        },
        update: {
          ...(body.userId ? { userId: body.userId } : {}),
        },
      });

      return reply.status(201).send(session);
    },
  });
}
