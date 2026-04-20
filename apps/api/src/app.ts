import cors from "cors";
import express from "express";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./routes/auth.routes.js";
import { classroomRouter } from "./routes/classroom.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { exerciseRouter } from "./routes/exercise.routes.js";
import { notebookRouter } from "./routes/notebook.routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [env.WEB_URL, "http://localhost:3000"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "learn-with-me-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/classes", classroomRouter);
  app.use("/api/exercises", exerciseRouter);
  app.use("/api/notebook", notebookRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
