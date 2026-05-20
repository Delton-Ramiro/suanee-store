import { Resend } from "resend";

export const resend = new Resend(process.env["RESEND_API_KEY"]);

const FROM = process.env["RESEND_FROM_EMAIL"] ?? "noreply@app.com";
const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "admin@app.com";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Payment Confirmed",
  in_process: "Being Prepared",
  in_transit: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export async function sendNewMessageEmail(opts: {
  conversationId: string;
  senderName: string;
  preview: string;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New message from ${opts.senderName}`,
    html: `
      <p>You have a new unread message from <strong>${opts.senderName}</strong>.</p>
      <p><em>${opts.preview}</em></p>
      <p><a href="${process.env["ADMIN_URL"] ?? "#"}/chats/${opts.conversationId}">Open conversation</a></p>
    `,
  });
}

export async function sendUnreadReminderEmail(opts: {
  conversationId: string;
  senderName: string;
  unreadCount: number;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `${opts.unreadCount} unread message(s) from ${opts.senderName}`,
    html: `
      <p>You have <strong>${opts.unreadCount}</strong> unread message(s) from <strong>${opts.senderName}</strong>.</p>
      <p><a href="${process.env["ADMIN_URL"] ?? "#"}/chats/${opts.conversationId}">Open conversation</a></p>
    `,
  });
}

export async function sendOrderStatusEmail(opts: {
  to: string;
  userName: string;
  orderId: string;
  status: string;
}): Promise<void> {
  const label = ORDER_STATUS_LABEL[opts.status] ?? opts.status;
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your order status: ${label}`,
    html: `
      <p>Hi <strong>${opts.userName}</strong>,</p>
      <p>Your order <strong>#${opts.orderId.slice(0, 8).toUpperCase()}</strong> has been updated to: <strong>${label}</strong>.</p>
      <p><a href="${process.env["CLIENT_URL"] ?? "#"}/orders/${opts.orderId}">View your order</a></p>
    `,
  });
}

export async function sendPasswordResetRequestEmail(opts: {
  superAdminEmail: string;
  adminName: string;
  adminEmail: string;
  approvalUrl: string;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: opts.superAdminEmail,
    subject: `Password reset request from ${opts.adminName}`,
    html: `
      <p><strong>${opts.adminName}</strong> (${opts.adminEmail}) has requested a password reset.</p>
      <p>Click the link below to approve the request. This link expires in 1 hour.</p>
      <p><a href="${opts.approvalUrl}">Approve password reset</a></p>
      <p>If you did not expect this request, you can safely ignore this email.</p>
    `,
  });
}
