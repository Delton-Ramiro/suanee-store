import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { SendMessageSchema } from "@ecommerce/types";
import { emitToConversation, emitToAdmins } from "../../../lib/socket.js";
import {
  scheduleNewMessageNotification,
  scheduleUnreadReminder,
  cancelNewMessageNotification,
} from "../../../jobs/index.js";
import { decodeCursor, offsetPaginate, paginate } from "../../../lib/utils.js";


const ConversationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default async function clientChatsRoutes(fastify: FastifyInstance) {
  // GET /chats — alias for /chats/conversations
  fastify.get("/", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "Alias for GET /chats/conversations. Returns the current user's conversation list with the latest message preview.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          description: "Conversation list",
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
      const q = ConversationListQuery.parse(req.query);
      const [total, conversations] = await Promise.all([
        prisma.conversation.count({ where: { userId: req.user.sub } }),
        prisma.conversation.findMany({
          where: { userId: req.user.sub },
          orderBy: { updatedAt: "desc" },
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                content: true,
                senderType: true,
                createdAt: true,
                isRead: true,
              },
            },
            _count: { select: { messages: true } },
          },
        }),
      ]);
      return reply.send(offsetPaginate(conversations, total, q.page, q.limit));
    },
  });

  // GET /chats/conversations — user's conversation list
  fastify.get("/conversations", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns the current user's conversations ordered by last activity, with the most recent message and total message count.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          description: "Conversation list",
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
      const q = ConversationListQuery.parse(req.query);
      const [total, conversations] = await Promise.all([
        prisma.conversation.count({ where: { userId: req.user.sub } }),
        prisma.conversation.findMany({
          where: { userId: req.user.sub },
          orderBy: { updatedAt: "desc" },
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                content: true,
                senderType: true,
                createdAt: true,
                isRead: true,
              },
            },
            _count: { select: { messages: true } },
          },
        }),
      ]);
      return reply.send(offsetPaginate(conversations, total, q.page, q.limit));
    },
  });

  // POST /chats/conversations — start a new conversation
  // If a conversation already exists, the message is still saved so the client
  // never needs to make a separate POST .../messages call on re-entry.
  fastify.post("/conversations", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "Start a new conversation or resume an existing one. Each user has a single conversation thread with admins; calling this again on an existing thread appends the message without creating duplicates.",
      body: {
        type: "object",
        properties: {
          content: {
            type: "string",
            maxLength: 5000,
            example: "Olá, quero saber sobre o produto X",
          },
          mediaUrl: { type: "string" },
          mediaType: { type: "string", enum: ["image", "video", "pdf"] },
        },
      },
      response: {
        200: {
          description: "Existing conversation (message appended)",
          type: "object",
        },
        201: { description: "New conversation created", type: "object" },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = SendMessageSchema.parse(req.body);

      const sender = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { name: true },
      });
      const senderName = sender?.name ?? "Customer";

      // One conversation per user — reuse existing but always persist the message
      const existing = await prisma.conversation.findFirst({
        where: { userId: req.user.sub },
      });

      if (existing) {
        const msg = await prisma.message.create({
          data: {
            conversationId: existing.id,
            senderId: req.user.sub,
            senderType: "user",
            content: body.content,
            mediaUrl: body.mediaUrl,
            mediaType: body.mediaType as never,
            isRead: false,
          },
        });
        await prisma.conversation.update({
          where: { id: existing.id },
          data: { updatedAt: new Date() },
        });

        emitToConversation(existing.id, "message:new", { message: msg });
        emitToAdmins("message:new", {
          conversationId: existing.id,
          message: msg,
        });

        await cancelNewMessageNotification(msg.id);
        await scheduleNewMessageNotification({
          conversationId: existing.id,
          messageId: msg.id,
          senderName,
          preview: body.content ?? "",
        });
        await scheduleUnreadReminder({
          conversationId: existing.id,
          senderName,
        });

        return reply.status(200).send(existing);
      }

      const conversation = await prisma.$transaction(async (tx) => {
        const conv = await tx.conversation.create({
          data: { userId: req.user.sub },
        });
        await tx.message.create({
          data: {
            conversationId: conv.id,
            senderId: req.user.sub,
            senderType: "user",
            content: body.content,
            mediaUrl: body.mediaUrl,
            mediaType: body.mediaType as never,
            isRead: false,
          },
        });
        return conv;
      });

      // Notify admins
      emitToAdmins("conversation:new", {
        conversationId: conversation.id,
        userId: req.user.sub,
      });

      const firstMsg = await prisma.message.findFirst({
        where: { conversationId: conversation.id },
        select: { id: true, content: true },
      });
      await scheduleNewMessageNotification({
        conversationId: conversation.id,
        messageId: firstMsg?.id ?? "",
        senderName,
        preview: firstMsg?.content ?? "",
      });

      return reply.status(201).send(conversation);
    },
  });

  // GET /chats/conversations/:id/messages
  fastify.get<{ Params: { id: string } }>("/conversations/:id/messages", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "Returns paginated messages for a conversation. Admin messages are marked as read automatically. Results are sorted oldest-first after pagination.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", default: 30, maximum: 50 },
        },
      },
      response: {
        200: {
          description: "Messages page",
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            nextCursor: { type: "string", nullable: true },
          },
        },
        404: {
          description: "Conversation not found",
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
      const q = z
        .object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(30),
        })
        .parse(req.query);

      const conversation = await prisma.conversation.findUnique({
        where: { id: req.params.id },
      });
      if (!conversation || conversation.userId !== req.user.sub)
        return reply.status(404).send({ error: "Conversation not found" });

      const messages = await prisma.message.findMany({
        take: q.limit + 1,
        ...(q.cursor
          ? { cursor: { id: decodeCursor(q.cursor) }, skip: 1 }
          : {}),
        where: { conversationId: req.params.id },
        orderBy: { createdAt: "desc" },
      });

      // Mark admin messages as read by user
      await prisma.message.updateMany({
        where: {
          conversationId: req.params.id,
          senderType: "admin",
          isRead: false,
        },
        data: { isRead: true },
      });

      const { items, nextCursor } = paginate(messages, q.limit);
      return reply.send({ items: items.reverse(), nextCursor });
    },
  });

  // POST /chats/conversations/:id/messages — client sends a message
  fastify.post<{ Params: { id: string } }>("/conversations/:id/messages", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Client Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "Send a message in an existing conversation. Emits a real-time socket event to admins and schedules a push notification.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          content: {
            type: "string",
            maxLength: 2000,
            example: "Obrigado pela resposta!",
          },
          mediaUrl: { type: "string", nullable: true },
          mediaType: { type: "string", nullable: true },
        },
      },
      response: {
        201: { description: "Message sent", type: "object" },
        404: {
          description: "Conversation not found",
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
      const body = SendMessageSchema.parse(req.body);

      const conversation = await prisma.conversation.findUnique({
        where: { id: req.params.id },
      });
      if (!conversation || conversation.userId !== req.user.sub)
        return reply.status(404).send({ error: "Conversation not found" });

      const message = await prisma.message.create({
        data: {
          conversationId: req.params.id,
          senderId: req.user.sub,
          senderType: "user",
          content: body.content,
          mediaUrl: body.mediaUrl,
          mediaType: body.mediaType as never,
          isRead: false,
        },
      });

      await prisma.conversation.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() },
      });

      emitToConversation(req.params.id, "message:new", { message });
      emitToAdmins("message:new", { conversationId: req.params.id, message });

      // Cancel any previous pending notification and schedule a fresh one
      await cancelNewMessageNotification(message.id);
      const sender = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { name: true },
      });
      const senderName = sender?.name ?? "Customer";
      await scheduleNewMessageNotification({
        conversationId: req.params.id,
        messageId: message.id,
        senderName,
        preview: body.content ?? "",
      });
      await scheduleUnreadReminder({
        conversationId: req.params.id,
        senderName,
      });

      return reply.status(201).send(message);
    },
  });
}
