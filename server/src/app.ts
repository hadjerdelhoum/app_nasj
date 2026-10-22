import cors from "cors";
import express from "express";
import type { Config } from "./config";
import type { Db } from "./db";
import { ApiError, errorHandler, rateLimit, requestLog, securityHeaders } from "./http";
import { buildRouter } from "./routes";
import { createAiClient, type AiClient } from "./services/loom";

export function createApp(db: Db, cfg: Config, opts: { ai?: AiClient | null; log?: boolean } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", cfg.isProd ? 1 : false);
  app.use(securityHeaders(), requestLog(opts.log ?? false));
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || cfg.corsOrigins.includes(origin)),
    methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Authorization", "Content-Type"], maxAge: 600,
  }));
  app.use(express.json({ limit: "20kb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", rateLimit(cfg, "api"), buildRouter(db, cfg, opts.ai === undefined ? createAiClient(cfg) : opts.ai));
  app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "Route inconnue.")));
  app.use(errorHandler(opts.log ?? false));
  return app;
}
