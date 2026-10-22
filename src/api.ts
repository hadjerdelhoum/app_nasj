import type { CategoryId, Progress } from "./types";
import { todayKey } from "./data";

/**
 * Backend connection. Set VITE_API_URL (e.g. http://localhost:4000) to use the real NASJ server.
 * Without it the app runs in its local demo mode (data kept in this browser only).
 */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");
export const REMOTE = BASE !== "";

export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiFailure(0, "NETWORK", "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error as { code?: string; message?: string } | undefined;
    if (res.status === 401 && (e?.code === "SESSION_EXPIRED" || e?.code === "UNAUTHENTICATED")) onUnauthorized?.();
    throw new ApiFailure(res.status, e?.code ?? "ERROR", e?.message ?? "Une erreur est survenue.");
  }
  return data as T;
}

export interface ProgressDto {
  summary: { totalStars: number; dailyDone: boolean; completedActivities?: number; lastActivity?: { title: string; levelId: number } | null };
  levels: { id: number; status: "locked" | "available" | "in_progress" | "completed"; unlocked: boolean; bestStars: number }[];
  rewards: { code: string }[];
  explored: string[];
}
/** The server is the only authority: this just reshapes its answer for the existing screens. */
export function toProgress(d: ProgressDto): Progress {
  const levelStars: Record<number, number> = {}, started: number[] = [], unlocked: number[] = [];
  for (const l of d.levels) {
    if (l.status === "completed") levelStars[l.id] = l.bestStars;
    if (l.status === "in_progress") started.push(l.id);
    if (l.unlocked) unlocked.push(l.id);
  }
  const base = Object.values(levelStars).reduce((a, b) => a + b, 0);
  return { levelStars, bonus: d.summary.totalStars - base, badges: d.rewards.map((r) => r.code), explored: d.explored as CategoryId[], dailyDate: d.summary.dailyDone ? todayKey() : null, started, unlocked, completedActivities: d.summary.completedActivities, lastActivity: d.summary.lastActivity ? { title: d.summary.lastActivity.title, levelId: d.summary.lastActivity.levelId } : null };
}

export interface SubmitDto { stars: number; deltaStars: number; dailyBonus: boolean; totalStars: number; newRewards: string[] }
