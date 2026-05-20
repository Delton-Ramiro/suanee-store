import { Queue, Worker, type Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { sendNewMessageEmail, sendUnreadReminderEmail } from "../lib/resend.js";
import { sendPushToMultiple } from "../lib/fcm.js";

// Separate redis connection config for BullMQ (needs maxRetriesPerRequest: null)
const bullRedisOpts = {
  host:
    (process.env["REDIS_URL"] ?? "redis://localhost:6379")
      .replace(/^redis:\/\//, "")
      .split(":")[0] ?? "localhost",
  port: parseInt(
    (process.env["REDIS_URL"] ?? "redis://localhost:6379").split(":").pop() ??
      "6379",
    10,
  ),
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

// ─── Queue Definitions ────────────────────────────────────────────────────────

export const emailQueue = new Queue("email-notifications", {
  connection: bullRedisOpts,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
});

// ─── Job Types ────────────────────────────────────────────────────────────────

interface NewMessageJobData {
  conversationId: string;
  messageId: string;
  senderName: string;
  preview: string;
  adminFcmTokens: string[];
}

interface ReminderJobData {
  conversationId: string;
  senderName: string;
  adminFcmTokens: string[];
}

// ─── Email Worker ─────────────────────────────────────────────────────────────

export function startEmailWorker(): Worker {
  return new Worker<NewMessageJobData | ReminderJobData>(
    "email-notifications",
    async (job: Job) => {
      if (job.name === "new-message") {
        const data = job.data as NewMessageJobData;

        // Check if any admin has read the message in the meantime
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { isRead: true },
        });
        if (message?.isRead) return;

        // Only send the email — FCM was already sent immediately on arrival
        await sendNewMessageEmail({
          conversationId: data.conversationId,
          senderName: data.senderName,
          preview: data.preview,
        });
      }

      if (job.name === "unread-reminder") {
        const data = job.data as ReminderJobData;
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: data.conversationId,
            isRead: false,
            senderType: "user",
          },
        });
        if (unreadCount === 0) return;

        await sendUnreadReminderEmail({
          conversationId: data.conversationId,
          senderName: data.senderName,
          unreadCount,
        });
      }
    },
    { connection: bullRedisOpts, concurrency: 5 },
  );
}

async function getAdminFcmTokens(): Promise<string[]> {
  const admins = await prisma.adminUser.findMany({
    where: { isActive: true },
    select: { fcmTokens: true },
  });
  return admins.flatMap((a) => a.fcmTokens);
}

export async function scheduleNewMessageNotification(
  data: Omit<NewMessageJobData, "adminFcmTokens">,
): Promise<void> {
  const adminFcmTokens = await getAdminFcmTokens();

  // FCM push is sent immediately — no need to wait
  if (adminFcmTokens.length) {
    await sendPushToMultiple({
      tokens: adminFcmTokens,
      title: `New message from ${data.senderName}`,
      body: data.preview,
      data: { conversationId: data.conversationId, type: "new_message" },
    }).catch(() => {
      /* Non-critical */
    });
  }

  // Email is delayed by 1 minute — cancelled if admin reads in time
  await emailQueue.add(
    "new-message",
    { ...data, adminFcmTokens },
    {
      delay: 60 * 1000,
      jobId: `new-message__${data.messageId}`,
    },
  );
}

export async function scheduleUnreadReminder(
  data: Omit<ReminderJobData, "adminFcmTokens">,
): Promise<void> {
  const adminFcmTokens = await getAdminFcmTokens();
  // BUG-16: jobId must be inside the repeat object for BullMQ v3/v4 so that
  // removeRepeatable() can correctly find and cancel the job by its key.
  await emailQueue.add(
    "unread-reminder",
    { ...data, adminFcmTokens },
    {
      repeat: {
        every: 15 * 60 * 1000,
        jobId: `unread-reminder__${data.conversationId}`,
      },
    },
  );
}

export async function cancelNewMessageNotification(
  messageId: string,
): Promise<void> {
  const job = await emailQueue.getJob(`new-message__${messageId}`);
  await job?.remove();
}

export async function cancelUnreadReminder(
  conversationId: string,
): Promise<void> {
  await emailQueue.removeRepeatable("unread-reminder", {
    every: 15 * 60 * 1000,
    jobId: `unread-reminder__${conversationId}`,
  });
}
