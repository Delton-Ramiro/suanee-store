import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PresignRequestSchema } from "@ecommerce/types";
import { createPresignedUpload } from "../../../lib/r2.js";

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
}
