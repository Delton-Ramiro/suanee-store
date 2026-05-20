import "dotenv/config";
import { buildApp } from "./app.js";
import { startEmailWorker } from "./jobs/index.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  // Start background workers
  startEmailWorker();
  console.log("BullMQ workers started");

  // Build and start Fastify
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`API server running on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`Swagger docs: http://${HOST}:${PORT}/docs`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down…`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
