import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { Config } from "./config";
import { hashToken } from "./security";
import type { Db } from "./db";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const notFound = (what = "Ressource") => new ApiError(404, "NOT_FOUND", `${what} introuvable.`);

export interface AuthUser { id: string; email: string; role: string }
declare module "express-serve-static-core" { interface Request { user?: AuthUser } }

/** Validates req.body with a zod schema; failures become a 400 with field paths only (never echoing values). */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, "VALIDATION_ERROR", "Requête invalide : " + r.error.issues.map((i) => i.path.join(".") || "corps").join(", "));
  return r.data;
}

/** Fixed-window in-memory rate limiter (per IP + bucket). Swap for Redis if you run several instances. */
export function rateLimit(cfg: Config, bucket: "auth" | "api"): RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  const max = bucket === "auth" ? cfg.rateLimit.authPerMin : cfg.rateLimit.apiPerMin;
  return (req, res, next) => {
    if (!cfg.rateLimit.enabled) return next();
    const now = Date.now(), key = req.ip ?? "?";
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + 60_000 }; hits.set(key, h); }
    if (++h.n > max) {
      res.setHeader("Retry-After", Math.ceil((h.reset - now) / 1000));
      return next(new ApiError(429, "RATE_LIMITED", "Trop de requêtes, réessaie dans un instant."));
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

export function requireAuth(db: Db): RequestHandler {
  return (req, _res, next) => {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
    if (!m) return next(new ApiError(401, "UNAUTHENTICATED", "Connexion requise."));
    const row = db.prepare(
      `SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`).get(hashToken(m[1]), new Date().toISOString());
    if (!row) return next(new ApiError(401, "SESSION_EXPIRED", "Session expirée, reconnecte-toi."));
    req.user = row as AuthUser;
    next();
  };
}

export const asyncH = (fn: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res)).catch(next);
};

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.removeHeader("X-Powered-By");
    next();
  };
}

/** Minimal request log: method, path (no query string), status, duration. Never logs headers or bodies. */
export function requestLog(enabled: boolean): RequestHandler {
  return (req, res, next) => {
    if (!enabled) return next();
    const t = Date.now();
    res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`));
    next();
  };
}

export function errorHandler(enableLog: boolean) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return void res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) return void res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Requête invalide." } });
    const e = err as { type?: string; status?: number };
    if (e?.type === "entity.parse.failed") return void res.status(400).json({ error: { code: "BAD_JSON", message: "JSON invalide." } });
    if (e?.type === "entity.too.large") return void res.status(413).json({ error: { code: "TOO_LARGE", message: "Requête trop volumineuse." } });
    if (enableLog) console.error("Unhandled error:", (err as Error)?.name, (err as Error)?.message); // no stack, no request data
    res.status(500).json({ error: { code: "INTERNAL", message: "Une erreur est survenue. Réessaie plus tard." } });
  };
}
