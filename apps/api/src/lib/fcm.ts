import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let initialized = false;

function ensureInitialized() {
  if (!initialized && getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env["FIREBASE_PROJECT_ID"],
        clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
        privateKey: process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n"),
      }),
    });
    initialized = true;
  }
}

export async function sendPushNotification(opts: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  ensureInitialized();
  try {
    await getMessaging().send({
      token: opts.token,
      notification: { title: opts.title, body: opts.body },
      data: opts.data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
  } catch (err) {
    console.error("FCM send error:", err);
  }
}

export async function sendPushToMultiple(opts: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  if (!opts.tokens.length) return;
  ensureInitialized();
  try {
    await getMessaging().sendEachForMulticast({
      tokens: opts.tokens,
      notification: { title: opts.title, body: opts.body },
      data: opts.data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
  } catch (err) {
    console.error("FCM multicast error:", err);
  }
}
