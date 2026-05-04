import { env, getAiRuntimeDiagnostics } from "./config/env.js";
import { connectToDatabase } from "./db/connect.js";
import { createApp } from "./app.js";

async function bootstrap() {
  await connectToDatabase();

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    console.log(`Learn With Me API listening on http://localhost:${env.API_PORT}`);

    if (env.NODE_ENV !== "production" || env.AI_DIAGNOSTICS_LOG === "true") {
      console.log("AI runtime diagnostics", getAiRuntimeDiagnostics());
    }
  });

  const shutdown = async () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
