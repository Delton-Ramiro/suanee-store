import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { OAuth2Client } from "google-auth-library";
import { createHash, randomBytes } from "crypto";

const GoogleLoginSchema = z.object({ idToken: z.string() });
const RefreshSchema = z.object({ refreshToken: z.string() });
const ContactUpdateSchema = z.object({
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
});

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function clientAuthRoutes(fastify: FastifyInstance) {
  const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  // POST /auth/google — exchange Google idToken for JWT + refresh token
  fastify.post("/google", {
    schema: {
      tags: ["Client Auth"],
      description:
        "Exchange a Google ID token for an access token and refresh token. Creates the user account on first sign-in.",
      body: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: { type: "string", description: "Google OAuth2 ID token" },
        },
      },
      response: {
        200: {
          description: "Authentication successful",
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                avatarUrl: { type: "string", nullable: true },
              },
            },
          },
        },
        401: {
          description: "Invalid Google token",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { idToken } = GoogleLoginSchema.parse(req.body);

      let payload: {
        sub: string;
        email?: string | null;
        name?: string | null;
        picture?: string | null;
      };
      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload() as typeof payload;
      } catch {
        return reply.status(401).send({ error: "Invalid Google token" });
      }

      if (!payload.email)
        return reply.status(400).send({ error: "Google account has no email" });

      const user = await prisma.user.upsert({
        where: { googleId: payload.sub },
        create: {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name ?? payload.email,
          avatarUrl: payload.picture,
        },
        update: {
          name: payload.name ?? undefined,
          avatarUrl: payload.picture ?? undefined,
        },
      });

      const accessToken = fastify.jwt.client.sign({
        sub: user.id,
        type: "user",
      });

      const rawRefresh = randomBytes(40).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      await prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawRefresh), expiresAt },
      });

      return reply.send({ accessToken, refreshToken: rawRefresh, user });
    },
  });

  // POST /auth/refresh
  fastify.post("/refresh", {
    schema: {
      tags: ["Client Auth"],
      description:
        "Rotate a refresh token. The old token is invalidated and a new access + refresh token pair is returned.",
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } },
      },
      response: {
        200: {
          description: "Tokens rotated",
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },
        401: {
          description: "Invalid or expired refresh token",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { refreshToken } = RefreshSchema.parse(req.body);
      const hash = hashToken(refreshToken);

      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash },
        include: { user: true },
      });
      if (!stored || stored.expiresAt < new Date()) {
        return reply
          .status(401)
          .send({ error: "Invalid or expired refresh token" });
      }

      // Rotate: delete old, issue new
      await prisma.refreshToken.delete({ where: { id: stored.id } });

      const accessToken = fastify.jwt.client.sign({
        sub: stored.user.id,
        type: "user",
      });

      const rawRefresh = randomBytes(40).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      await prisma.refreshToken.create({
        data: {
          userId: stored.user.id,
          tokenHash: hashToken(rawRefresh),
          expiresAt,
        },
      });

      return reply.send({ accessToken, refreshToken: rawRefresh });
    },
  });

  // POST /auth/logout
  fastify.post("/logout", {
    schema: {
      tags: ["Client Auth"],
      description:
        "Revoke a refresh token, effectively logging the user out from that device.",
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } },
      },
      response: {
        200: {
          description: "Logged out",
          type: "object",
          properties: { ok: { type: "boolean" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { refreshToken } = RefreshSchema.parse(req.body);
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: hashToken(refreshToken) },
      });
      return reply.send({ ok: true });
    },
  });

  // PATCH /auth/me/contact — update phone/whatsapp
  fastify.patch("/me/contact", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Auth"],
      security: [{ bearerAuth: [] }],
      description:
        "Update the authenticated user's contact details (phone or WhatsApp number).",
      body: {
        type: "object",
        properties: {
          phone: { type: "string", example: "+258841234567" },
          whatsappNumber: { type: "string", example: "+258841234567" },
        },
      },
      response: {
        200: { description: "Updated user", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = ContactUpdateSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.user.sub },
        data: body,
      });
      return reply.send(user);
    },
  });

  // GET /auth/me
  fastify.get("/me", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Auth"],
      security: [{ bearerAuth: [] }],
      description: "Get the authenticated user's full profile.",
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
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return reply.send(user);
    },
  });

  // POST /auth/supabase — exchange Supabase access token for app JWT + refresh token
  fastify.post("/supabase", {
    schema: {
      tags: ["Client Auth"],
      description:
        "Exchange a Supabase OAuth access token for an app access token and refresh token. Creates the user account on first sign-in.",
      body: {
        type: "object",
        required: ["accessToken"],
        properties: {
          accessToken: { type: "string", description: "Supabase OAuth access token (JWT)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                avatarUrl: { type: "string", nullable: true },
              },
            },
          },
        },
        401: { type: "object", properties: { error: { type: "string" } } },
        400: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const { accessToken: supabaseToken } = (req.body as { accessToken: string });

      // Verify by calling Supabase's own /auth/v1/user endpoint — works regardless
      // of JWT algorithm or secret encoding.
      interface SupabaseUser {
        id: string;
        email?: string;
        user_metadata?: {
          sub?: string;
          provider_id?: string;
          full_name?: string;
          name?: string;
          avatar_url?: string;
          picture?: string;
          email?: string;
        };
      }

      let supabaseUser: SupabaseUser;
      try {
        const res = await fetch(
          `${process.env.SUPABASE_URL}/auth/v1/user`,
          {
            headers: {
              Authorization: `Bearer ${supabaseToken}`,
              apikey: process.env.SUPABASE_ANON_KEY!,
            },
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
          const reason = body.msg ?? body.message ?? `status ${res.status}`;
          fastify.log.warn("[auth/supabase] Supabase user lookup failed: %s", reason);
          return reply.status(401).send({ error: `Invalid Supabase token: ${reason}` });
        }
        supabaseUser = (await res.json()) as SupabaseUser;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fastify.log.error("[auth/supabase] Supabase user fetch error: %s", msg);
        return reply.status(500).send({ error: "Auth service unavailable" });
      }

      const email = supabaseUser.email ?? supabaseUser.user_metadata?.email;
      if (!email) return reply.status(400).send({ error: "No email in Supabase user" });

      const googleId =
        supabaseUser.user_metadata?.sub ??
        supabaseUser.user_metadata?.provider_id ??
        supabaseUser.id;

      const name =
        supabaseUser.user_metadata?.full_name ??
        supabaseUser.user_metadata?.name ??
        email;

      const avatarUrl =
        supabaseUser.user_metadata?.avatar_url ??
        supabaseUser.user_metadata?.picture ??
        null;

      const user = await prisma.user.upsert({
        where: { googleId },
        create: { googleId, email, name, avatarUrl },
        update: { name, avatarUrl: avatarUrl ?? undefined },
      });

      const accessToken = fastify.jwt.client.sign({ sub: user.id, type: "user" });

      const rawRefresh = randomBytes(40).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      await prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawRefresh), expiresAt },
      });

      return reply.send({ accessToken, refreshToken: rawRefresh, user });
    },
  });

  // POST /auth/dev-login — development-only bypass (no Google token required)
  // Creates or reuses a test user by email and returns a JWT.
  // BLOCKED IN PRODUCTION — returns 404 if NODE_ENV === 'production'.
  if (process.env["NODE_ENV"] !== "production") {
    const DevLoginSchema = z.object({ email: z.string().email() });

    fastify.post("/dev-login", {
      schema: {
        tags: ["Client Auth (Dev)"],
        description:
          "Development-only: bypass Google OAuth and get a JWT directly by email. Not available in production.",
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "test@example.com",
            },
          },
        },
        response: {
          200: {
            description: "Auth tokens and user",
            type: "object",
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
              user: { type: "object" },
            },
          },
        },
      },
      handler: async (req, reply) => {
        const { email } = DevLoginSchema.parse(req.body);

        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: email.split("@")[0], googleId: null as never },
          update: {},
        });

        const accessToken = fastify.jwt.client.sign({
          sub: user.id,
          type: "user",
        });

        const rawRefresh = randomBytes(40).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(rawRefresh),
            expiresAt,
          },
        });

        return reply.send({ accessToken, refreshToken: rawRefresh, user });
      },
    });
  }
}
