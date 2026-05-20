import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

let io: Server | null = null;

// Connected admin sockets: Map<adminId, Set<socketId>>
const adminSockets = new Map<string, Set<string>>();

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env["CORS_ORIGIN"]?.split(",") ?? [
        "http://localhost:3001",
      ],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // SEC-1: Verify JWT tokens instead of trusting raw IDs from handshake auth
    const token = socket.handshake.auth["token"] as string | undefined;
    const adminToken = socket.handshake.auth["adminToken"] as
      | string
      | undefined;

    let verifiedUserId: string | undefined;
    let verifiedAdminId: string | undefined;

    if (token) {
      try {
        const payload = jwt.verify(
          token,
          process.env["JWT_SECRET"] ?? "secret",
        ) as {
          sub: string;
          type: string;
        };
        if (payload.type === "user") {
          verifiedUserId = payload.sub;
        }
      } catch {
        socket.disconnect(true);
        return;
      }
    }

    if (adminToken) {
      try {
        const payload = jwt.verify(
          adminToken,
          process.env["ADMIN_JWT_SECRET"] ?? "admin-secret",
        ) as { sub: string; type: string };
        if (payload.type === "admin") {
          verifiedAdminId = payload.sub;
        }
      } catch {
        socket.disconnect(true);
        return;
      }
    }

    if (verifiedUserId) {
      socket.data.userId = verifiedUserId;
      socket.join(`user:${verifiedUserId}`);
    }

    if (verifiedAdminId) {
      socket.data.adminId = verifiedAdminId;
      socket.join("admins");
      if (!adminSockets.has(verifiedAdminId))
        adminSockets.set(verifiedAdminId, new Set());
      adminSockets.get(verifiedAdminId)!.add(socket.id);
    }

    // BUG-F: Reject connections that are neither a verified user nor a verified admin.
    if (!verifiedUserId && !verifiedAdminId) {
      socket.disconnect(true);
      return;
    }

    socket.on("join:conversation", (conversationId: string) => {
      // Only join a conversation room if the socket is authenticated
      if (socket.data.userId || socket.data.adminId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      "admin:mark_read",
      async ({ conversationId }: { conversationId: string }) => {
        // SEC: Only authenticated admins can mark messages as read
        if (!socket.data.adminId) return;
        await prisma.message.updateMany({
          where: { conversationId, isRead: false, senderType: "user" },
          data: { isRead: true },
        });
        io?.to(`conversation:${conversationId}`).emit("messages:read", {
          conversationId,
        });
      },
    );

    socket.on("disconnect", () => {
      const adminId = socket.data.adminId as string | undefined;
      if (adminId) {
        adminSockets.get(adminId)?.delete(socket.id);
        if (adminSockets.get(adminId)?.size === 0) adminSockets.delete(adminId);
      }
    });
  });

  return io;
}

export function emitToConversation(
  conversationId: string,
  event: string,
  data: unknown,
): void {
  io?.to(`conversation:${conversationId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToAdmins(event: string, data: unknown): void {
  io?.to("admins").emit(event, data);
}

export function isAdminOnline(adminId: string): boolean {
  return (adminSockets.get(adminId)?.size ?? 0) > 0;
}
