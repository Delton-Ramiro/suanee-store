import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { initSocket } from "./lib/socket.js";

// Plugins
import corsPlugin from "./plugins/cors.js";
import authPlugin from "./plugins/auth.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import swaggerPlugin from "./plugins/swagger.js";

// Admin routes
import adminAuthRoutes from "./modules/admin/auth/routes.js";
import adminDashboardRoutes from "./modules/admin/dashboard/routes.js";
import adminOrdersRoutes from "./modules/admin/orders/routes.js";
import adminClientsRoutes from "./modules/admin/clients/routes.js";
import adminCategoriesRoutes from "./modules/admin/categories/routes.js";
import adminBrandsRoutes from "./modules/admin/brands/routes.js";
import adminColorsRoutes from "./modules/admin/colors/routes.js";
import adminSizesRoutes from "./modules/admin/sizes/routes.js";
import adminFiltersRoutes from "./modules/admin/filters/routes.js";
import adminCollectionsRoutes from "./modules/admin/collections/routes.js";
import adminStoriesRoutes from "./modules/admin/stories/routes.js";
import adminMostSearchedRoutes from "./modules/admin/most-searched/routes.js";
import adminCurrencyRoutes from "./modules/admin/currency/routes.js";
import adminAuthorityRoutes from "./modules/admin/authority/routes.js";
import adminProductsRoutes from "./modules/admin/products/routes.js";
import adminChatsRoutes from "./modules/admin/chats/routes.js";
import adminAnalyticsRoutes from "./modules/admin/analytics/routes.js";
import adminMediaRoutes from "./modules/admin/media/routes.js";
import adminSearchRoutes from "./modules/admin/search/routes.js";

// Client routes
import clientAuthRoutes from "./modules/client/auth/routes.js";
import clientCatalogRoutes from "./modules/client/catalog/routes.js";
import clientSearchRoutes from "./modules/client/search/routes.js";
import clientStoriesRoutes from "./modules/client/stories/routes.js";
import clientCartRoutes from "./modules/client/cart/routes.js";
import clientFavoritesRoutes from "./modules/client/favorites/routes.js";
import clientOrdersRoutes from "./modules/client/orders/routes.js";
import clientChatsRoutes from "./modules/client/chats/routes.js";
import clientMediaRoutes from "./modules/client/media/routes.js";
import clientAnalyticsRoutes from "./modules/client/analytics/routes.js";
import clientUsersRoutes from "./modules/client/users/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    // Base64-encoded 100 MB video = ~134 MB; add headroom for JSON wrapper
    bodyLimit: 140 * 1024 * 1024,
    ajv: {
      customOptions: {
        keywords: ["example"],
      },
    },
  });

  // Use plain JSON.stringify for response serialization so that response
  // schemas serve as Swagger documentation only and never strip fields.
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));

  // Map common Prisma errors to proper HTTP responses
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      const messages = err.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      return reply
        .status(400)
        .send({ error: "Validation error", details: messages });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return reply.status(404).send({ error: "Record not found" });
      }
      if (err.code === "P2002") {
        const fields = (err.meta?.target as string[] | undefined)?.join(", ");
        return reply.status(409).send({
          error: fields ? `Duplicate value for: ${fields}` : "Duplicate entry",
        });
      }
      if (err.code === "P2003") {
        console.error("[P2003]", {
          meta: err.meta,
          message: err.message,
          url: _req.url,
          method: _req.method,
        });
        return reply
          .status(409)
          .send({ error: "Related record not found or constraint violated" });
      }
    }
    // Strip newlines from unhandled error messages so they read cleanly
    if (err instanceof Error && err.message) {
      err.message = err.message.replace(/\n+/g, " ").trim();
    }
    reply.send(err);
  });

  // Global plugins
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);

  if (process.env.NODE_ENV !== "production") {
    await app.register(swaggerPlugin);
  }

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    ts: new Date().toISOString(),
  }));

  const API = "/api/v1";

  // ── Admin routes ──────────────────────────────────────────────────────────
  await app.register(adminAuthRoutes, { prefix: `${API}/admin/auth` });
  await app.register(adminDashboardRoutes, {
    prefix: `${API}/admin/dashboard`,
  });
  await app.register(adminOrdersRoutes, { prefix: `${API}/admin/orders` });
  await app.register(adminClientsRoutes, { prefix: `${API}/admin/clients` });
  await app.register(adminCategoriesRoutes, {
    prefix: `${API}/admin/categories`,
  });
  await app.register(adminBrandsRoutes, { prefix: `${API}/admin/brands` });
  await app.register(adminColorsRoutes, { prefix: `${API}/admin/colors` });
  await app.register(adminSizesRoutes, { prefix: `${API}/admin/sizes` });
  await app.register(adminFiltersRoutes, { prefix: `${API}/admin/filters` });
  await app.register(adminCollectionsRoutes, {
    prefix: `${API}/admin/collections`,
  });
  await app.register(adminStoriesRoutes, { prefix: `${API}/admin/stories` });
  await app.register(adminMostSearchedRoutes, {
    prefix: `${API}/admin/most-searched`,
  });
  await app.register(adminCurrencyRoutes, {
    prefix: `${API}/admin/currencies`,
  });
  await app.register(adminAuthorityRoutes, {
    prefix: `${API}/admin/authority`,
  });
  await app.register(adminProductsRoutes, { prefix: `${API}/admin/products` });
  await app.register(adminChatsRoutes, { prefix: `${API}/admin/chats` });
  await app.register(adminAnalyticsRoutes, {
    prefix: `${API}/admin/analytics`,
  });
  await app.register(adminMediaRoutes, { prefix: `${API}/admin/media` });
  await app.register(adminSearchRoutes, { prefix: `${API}/admin/search` });

  // ── Client routes ─────────────────────────────────────────────────────────
  await app.register(clientAuthRoutes, { prefix: `${API}/auth` });
  await app.register(clientCatalogRoutes, { prefix: `${API}/catalog` });
  await app.register(clientSearchRoutes, { prefix: `${API}/search` });
  await app.register(clientStoriesRoutes, { prefix: `${API}/stories` });
  await app.register(clientCartRoutes, { prefix: `${API}/cart` });
  await app.register(clientFavoritesRoutes, { prefix: `${API}/favorites` });
  await app.register(clientOrdersRoutes, { prefix: `${API}/orders` });
  await app.register(clientChatsRoutes, { prefix: `${API}/chats` });
  await app.register(clientMediaRoutes, { prefix: `${API}/media` });
  await app.register(clientAnalyticsRoutes, { prefix: `${API}/analytics` });
  await app.register(clientUsersRoutes, { prefix: `${API}/users` });

  // Attach Socket.io
  initSocket(app.server);

  return app;
}
