import fp from "fastify-plugin";
import fastifyCors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

const NGROK_PATTERN =
  /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok\.io|ngrok\.app)$/;

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  const origins = process.env["CORS_ORIGIN"]?.split(",") ?? [
    "http://localhost:3001",
    "http://localhost:3002",
  ];

  fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || origins.includes(origin) || NGROK_PATTERN.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  });
});
