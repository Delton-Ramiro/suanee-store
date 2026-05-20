import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env["R2_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"] ?? "",
  },
});

const bucket = process.env["R2_BUCKET_NAME"] ?? "ecommerce-media";
const publicBaseUrl = process.env["R2_PUBLIC_URL"] ?? "";

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function createPresignedUpload(
  context: string,
  filename: string,
  contentType: string,
): Promise<PresignResult> {
  const ext = filename.split(".").pop() ?? "";
  const key = `${context}/${nanoid(16)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

  return {
    uploadUrl,
    publicUrl: `${publicBaseUrl}/${key}`,
    key,
  };
}

/** Upload a raw buffer directly (server-side). Bypasses CORS restrictions. */
export async function uploadBuffer(
  context: string,
  filename: string,
  contentType: string,
  buffer: Buffer,
): Promise<{ publicUrl: string; key: string }> {
  const ext = filename.split(".").pop() ?? "bin";
  const key = `${context}/${nanoid(16)}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return {
    publicUrl: `${publicBaseUrl}/${key}`,
    key,
  };
}

export async function deleteR2Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}

