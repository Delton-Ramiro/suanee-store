import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  if (process.env["NODE_ENV"] === "production") return;

  fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "E-commerce API",
        description: "Full e-commerce API for web and mobile clients",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${process.env["PORT"] ?? 3000}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  fastify.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
});
