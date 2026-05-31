import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PresignRequestSchema } from "@ecommerce/types";
import { createPresignedUpload, uploadBuffer } from "../../../lib/r2.js";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_PDF_MIME = ["application/pdf"];
const ALLOWED_MIME = [...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME, ...ALLOWED_PDF_MIME];

export default async function clientMediaRoutes(fastify: FastifyInstance) {
  // POST /media/presign — request a presigned upload URL
  fastify.post("/presign", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Media"],
      security: [{ bearerAuth: [] }],
      description:
        "Request a presigned URL for a direct upload to Cloudflare R2. The client uploads the file directly using the returned URL; no data passes through the API server.",
      body: {
        type: "object",
        required: ["context", "filename", "contentType"],
        properties: {
          context: {
            type: "string",
            example: "product-media",
            description: "Upload context (e.g. product-media, story-slide)",
          },
          filename: { type: "string", example: "photo.jpg" },
          contentType: {
            type: "string",
            example: "image/jpeg",
            description:
              "MIME type — must be image/jpeg, image/png, image/webp, image/gif, video/mp4, or video/quicktime",
          },
        },
      },
      response: {
        200: {
          description: "Presigned upload URL and final public URL",
          type: "object",
          properties: {
            uploadUrl: {
              type: "string",
              description: "PUT this URL with the file bytes",
            },
            publicUrl: {
              type: "string",
              description: "Final URL the file will be accessible at",
            },
          },
        },
        400: {
          description: "Unsupported content type",
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
      const body = PresignRequestSchema.parse(req.body);

      const ALLOWED_MIME = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/quicktime",
        "application/pdf",
      ];
      if (!ALLOWED_MIME.includes(body.contentType)) {
        return reply.status(400).send({ error: "Unsupported content type" });
      }

      const result = await createPresignedUpload(
        body.context,
        body.filename,
        body.contentType,
      );
      return reply.send(result);
    },
  });

  // POST /media/upload — server-proxied upload (base64 JSON body)
  // Bypasses R2 CORS restrictions for direct client-side uploads.
  fastify.post("/upload", {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Media"],
      security: [{ bearerAuth: [] }],
      description:
        "Upload a file via the server (base64-encoded). Bypasses R2 CORS restrictions. Max 8 MB for images/PDFs, 100 MB for videos.",
      body: {
        type: "object",
        required: ["context", "filename", "contentType", "data"],
        properties: {
          context: { type: "string", example: "chat" },
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
        return reply.status(400).send({ error: "Tipo de ficheiro não suportado" });
      }

      const maxBytes = ALLOWED_VIDEO_MIME.includes(contentType)
        ? VIDEO_MAX_BYTES
        : IMAGE_MAX_BYTES;

      const buffer = Buffer.from(data, "base64");
      if (buffer.byteLength > maxBytes) {
        const limitMB = maxBytes / (1024 * 1024);
        return reply.status(400).send({ error: `Ficheiro demasiado grande (max. ${limitMB} MB)` });
      }

      const { publicUrl } = await uploadBuffer(context, filename, contentType, buffer);
      return reply.send({ publicUrl });
    },
  });
}
