import type { FastifyInstance } from "fastify";
import { PresignRequestSchema } from "@ecommerce/types";
import {
  createPresignedUpload,
  uploadBuffer,
  deleteR2Objects,
} from "../../../lib/r2.js";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_PDF_MIME = ["application/pdf"];
const ALLOWED_MIME = [...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME, ...ALLOWED_PDF_MIME];

export default async function adminMediaRoutes(fastify: FastifyInstance) {
  // POST /admin/media/presign — request a presigned upload URL for admin-uploaded assets
  fastify.post("/presign", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Media"],
      security: [{ bearerAuth: [] }],
      description:
        "Request a presigned URL for direct upload to Cloudflare R2. Used for category images, brand logos, etc.",
      body: {
        type: "object",
        required: ["context", "filename", "contentType"],
        properties: {
          context: { type: "string", example: "category" },
          filename: { type: "string", example: "image.jpg" },
          contentType: {
            type: "string",
            example: "image/jpeg",
            description:
              "Must be image/jpeg, image/png, image/webp, or image/gif",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            uploadUrl: { type: "string" },
            publicUrl: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const body = PresignRequestSchema.parse(req.body);
      if (!ALLOWED_MIME.includes(body.contentType)) {
        return reply
          .status(400)
          .send({ error: "Tipo de ficheiro não suportado" });
      }
      const result = await createPresignedUpload(
        body.context,
        body.filename,
        body.contentType,
      );
      return reply.send(result);
    },
  });

  // POST /admin/media/upload — server-proxied upload (base64 JSON body)
  // Avoids R2 CORS restrictions for direct client-side uploads.
  fastify.post("/upload", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Media"],
      security: [{ bearerAuth: [] }],
      description:
        "Upload an image via the server (base64-encoded). Bypasses R2 CORS restrictions. Max 8 MB.",
      body: {
        type: "object",
        required: ["context", "filename", "contentType", "data"],
        properties: {
          context: { type: "string", example: "category" },
          filename: { type: "string", example: "photo.jpg" },
          contentType: { type: "string", example: "image/jpeg" },
          data: {
            type: "string",
            description: "Base64-encoded file content (without data: prefix)",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { publicUrl: { type: "string" } },
        },
        400: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    handler: async (req, reply) => {
      const { context, filename, contentType, data } = req.body as {
        context: string;
        filename: string;
        contentType: string;
        data: string;
      };

      if (!ALLOWED_MIME.includes(contentType)) {
        return reply.status(400).send({ error: "Not supported file type" });
      }

      const maxBytes = ALLOWED_VIDEO_MIME.includes(contentType)
        ? VIDEO_MAX_BYTES
        : IMAGE_MAX_BYTES;

      const buffer = Buffer.from(data, "base64");
      if (buffer.byteLength > maxBytes) {
        const limitMB = maxBytes / (1024 * 1024);
        return reply
          .status(400)
          .send({ error: `File too large (max. ${limitMB} MB)` });
      }

      const { publicUrl } = await uploadBuffer(
        context,
        filename,
        contentType,
        buffer,
      );
      return reply.send({ publicUrl });
    },
  });

  // DELETE /admin/media/delete — delete an uploaded asset from R2 by public URL
  fastify.post("/delete", {
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Admin Media"],
      security: [{ bearerAuth: [] }],
      description:
        "Delete a previously uploaded asset from R2 by its public URL.",
      body: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            description: "The publicUrl returned by /upload or /presign",
          },
        },
      },
      response: {
        204: { description: "Deleted" },
        400: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    handler: async (req, reply) => {
      const { url } = req.body as { url: string };
      const baseUrl = process.env["R2_PUBLIC_URL"] ?? "";
      if (!baseUrl || !url.startsWith(baseUrl)) {
        return reply.status(400).send({ error: "URL inválido" });
      }
      const key = url.replace(`${baseUrl}/`, "");
      if (!key || key.startsWith("http")) {
        return reply.status(400).send({ error: "URL inválido" });
      }
      await deleteR2Objects([key]);
      return reply.status(204).send();
    },
  });
}
