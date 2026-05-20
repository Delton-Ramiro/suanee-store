import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { SendMessageSchema, Permissions } from "@ecommerce/types";
import { emitToConversation, emitToUser } from "../../../lib/socket.js";
import {
  scheduleNewMessageNotification,
  scheduleUnreadReminder,
  cancelUnreadReminder,
} from "../../../jobs/index.js";
import { sendPushToMultiple } from "../../../lib/fcm.js";
import { offsetPaginate } from "../../../lib/utils.js";

const ChatListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  filter: z.enum(["all", "unread", "read"]).default("all"),
});

const MessagesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export default async function adminChatsRoutes(fastify: FastifyInstance) {
  // GET /admin/chats — inbox
  fastify.get("/", {
    preHandler: [fastify.requirePermission(Permissions.CHATS_VIEW)],
    schema: {
      tags: ["Admin Chats"],
      security: [{ bearerAuth: [] }],
      description:
        "List all client conversations (admin inbox). Supports filtering by read/unread status. Each item includes the last message and an unread message count.",
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", default: 1, minimum: 1 },
          limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          filter: {
            type: "string",
            enum: ["all", "unread", "read"],
            default: "all",
          },
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
      const q = ChatListQuery.parse(req.query);

      // BUG-12: 'unread' = has at least one unread user message.
      //         'read'   = has NO unread user messages (opposite of unread filter).
      const where =
        q.filter === "unread"
          ? {
              messages: {
                some: { isRead: false, senderType: "user" as const },
              },
            }
          : q.filter === "read"
            ? {
                messages: {
                  none: { isRead: false, senderType: "user" as const },
                },
              }
            : {};

      const [total, conversations] = await Promise.all([
        prisma.conversation.count({ where }),
        prisma.conversation.findMany({
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          where,
          orderBy: { updatedAt: "desc" },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" as const },
              select: {
                id: true,
                content: true,
                mediaType: true,
                createdAt: true,
                isRead: true,
                senderType: true,
              },
            },
            _count: { select: { messages: true } },
          },
        }),
      ]);

      // Count unread per conversation
      const conversationIds = conversations.map((c) => c.id);
      const unreadCounts = await prisma.message.groupBy({
        by: ["conversationId"],
        where: {
          conversationId: { in: conversationIds },
          isRead: false,
          senderType: "user",
        },
        _count: true,
      });
      const unreadMap = Object.fromEntries(
        unreadCounts.map((u) => [u.conversationId, u._count]),
      );

      const paged = offsetPaginate(conversations, total, q.page, q.limit);
      return reply.send({
        ...paged,
        items: paged.items.map((c) => ({
          ...c,
          unreadCount: unreadMap[c.id] ?? 0,
          lastMessage: c.messages[0] ?? null,
        })),
      });
    },
  });

  // GET /admin/chats/:conversationId/messages
  fastify.get<{ Params: { conversationId: string } }>(
    "/:conversationId/messages",
    {
      preHandler: [fastify.requirePermission(Permissions.CHATS_VIEW)],
      schema: {
        tags: ["Admin Chats"],
        security: [{ bearerAuth: [] }],
        description:
          "Load messages for a conversation in reverse-chronological order. Marks all client messages as read. Returns messages in ascending order (oldest first).",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: { conversationId: { type: "string", format: "uuid" } },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1, minimum: 1 },
            limit: { type: "integer", default: 30, minimum: 1, maximum: 50 },
          },
        },
        response: {
          200: {
            description: "Messages",
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
        const q = MessagesQuery.parse(req.query);

        const [total, messages] = await Promise.all([
          prisma.message.count({
            where: { conversationId: req.params.conversationId },
          }),
          prisma.message.findMany({
            skip: (q.page - 1) * q.limit,
            take: q.limit,
            where: { conversationId: req.params.conversationId },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        // Mark all client messages as read
        await prisma.message.updateMany({
          where: {
            conversationId: req.params.conversationId,
            isRead: false,
            senderType: "user",
          },
          data: { isRead: true },
        });

        // BUG-G: Cancel pending notification jobs now that admin has read the conversation.
        await cancelUnreadReminder(req.params.conversationId);

        return reply.send({
          ...offsetPaginate([...messages].reverse(), total, q.page, q.limit),
        });
      },
    },
  );

  // POST /admin/chats/:conversationId/messages — admin sends message
  fastify.post<{ Params: { conversationId: string } }>(
    "/:conversationId/messages",
    {
      preHandler: [fastify.requirePermission(Permissions.CHATS_VIEW)],
      schema: {
        tags: ["Admin Chats"],
        security: [{ bearerAuth: [] }],
        description:
          "Send a message from admin to client in a conversation. Emits a Socket.IO event to the client and sends a push notification if the client has FCM tokens.",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: { conversationId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Text content of the message",
            },
            mediaUrl: { type: "string", description: "URL of attached media" },
            mediaType: {
              type: "string",
              enum: ["image", "video"],
              description: "Type of attached media",
            },
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
          where: { id: req.params.conversationId },
          include: { user: { select: { id: true, fcmTokens: true } } },
        });
        if (!conversation)
          return reply.status(404).send({ error: "Conversation not found" });

        const message = await prisma.message.create({
          data: {
            conversationId: req.params.conversationId,
            senderId: req.user.sub,
            senderType: "admin",
            content: body.content,
            mediaUrl: body.mediaUrl,
            mediaType: body.mediaType as never,
            isRead: false,
          },
        });

        await prisma.conversation.update({
          where: { id: req.params.conversationId },
          data: { updatedAt: new Date() },
        });

        // Emit real-time event to client user
        emitToUser(conversation.userId, "message:new", {
          conversationId: req.params.conversationId,
          message,
        });
        emitToConversation(req.params.conversationId, "message:new", {
          message,
        });

        // BUG-6: Push-notify user devices if they have FCM tokens (for offline users)
        if (conversation.user.fcmTokens.length > 0) {
          await sendPushToMultiple({
            tokens: conversation.user.fcmTokens,
            title: "New message from support",
            body: body.content ?? "You have a new message",
            data: {
              conversationId: req.params.conversationId,
              type: "admin_reply",
            },
          });
        }

        return reply.status(201).send(message);
      },
    },
  );
}
