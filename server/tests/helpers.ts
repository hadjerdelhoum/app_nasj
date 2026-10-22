import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { loadConfig, type Config } from "../src/config";
import { migrate, openDb, type Db } from "../src/db";
import { seedReference } from "../src/seed";
import type { AiClient } from "../src/services/loom";

export interface Ctx { db: Db; cfg: Config; base: string; close: () => Promise<void>; api: (method: string, path: string, o?: { token?: string; body?: unknown }) => Promise<{ status: number; body: any }> }

export async function setup(env: Record<string, string> = {}, ai: AiClient | null = null): Promise<Ctx> {
  const db = openDb(":memory:");
  migrate(db); seedReference(db);
  const cfg = loadConfig({ RATE_LIMIT: "off", CORS_ORIGINS: "http://localhost:5173", ...env });
  const server: Server = createApp(db, cfg, { ai }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api: Ctx["api"] = async (method, path, o = {}) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { db, cfg, base, api, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}

let n = 0;
export async function parent(ctx: Ctx, email = `parent${++n}@test.dev`) {
  const r = await ctx.api("POST", "/api/auth/register", { body: { email, password: "correct horse 42" } });
  return { token: r.body.token as string, email };
}
export async function childFor(ctx: Ctx, token: string, ageGroup: "3-5" | "5-10" = "5-10", displayName = "Lina") {
  const r = await ctx.api("POST", "/api/children", { token, body: { displayName, ageGroup } });
  return r.body.child.id as string;
}

/** Plays an activity the way a real client would, using only public endpoints; the secret answers are read from the DB (test-only). */
export async function playQuiz(ctx: Ctx, token: string, childId: string, activityId: string, wrongFirst = 0) {
  const s = await ctx.api("POST", `/api/children/${childId}/activities/${activityId}/start`, { token });
  if (s.status !== 201) return { start: s };
  const attemptId = s.body.attemptId as string;
  const state = JSON.parse(ctx.db.prepare("SELECT state FROM activity_attempts WHERE id = ?").get(attemptId)!.state);
  let wrongLeft = wrongFirst;
  for (const q of state.questions) {
    if (wrongLeft > 0) { const bad = q.options.find((o: any) => o.id !== q.answer); await ctx.api("POST", `/api/attempts/${attemptId}/answer`, { token, body: { questionId: q.id, optionId: bad.id } }); wrongLeft--; }
    await ctx.api("POST", `/api/attempts/${attemptId}/answer`, { token, body: { questionId: q.id, optionId: q.answer } });
  }
  return { start: s, attemptId, submit: () => ctx.api("POST", `/api/activities/${activityId}/submit`, { token, body: { attemptId } }) };
}
