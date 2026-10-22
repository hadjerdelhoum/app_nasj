export type AgeGroup = "3-5" | "5-10";

export interface Config {
  port: number;
  dbPath: string;
  corsOrigins: string[];
  /** Rule for the overlapping age: a child aged exactly 5 with no explicit group goes to this group. */
  ageFiveGroup: AgeGroup;
  sessionDays: number;
  isProd: boolean;
  rateLimit: { enabled: boolean; authPerMin: number; apiPerMin: number };
  ai: { apiKey: string | null; model: string; timeoutMs: number };
  seedDev: { enabled: boolean; email: string; password: string | null };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const five: AgeGroup = env.AGE_FIVE_GROUP === "5-10" ? "5-10" : "3-5";
  return {
    port: Number(env.PORT ?? 4000),
    dbPath: env.DATABASE_PATH ?? "./data/nasj.db",
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    ageFiveGroup: five,
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    isProd: env.NODE_ENV === "production",
    rateLimit: { enabled: env.RATE_LIMIT !== "off", authPerMin: 10, apiPerMin: 300 },
    ai: { apiKey: env.ANTHROPIC_API_KEY?.trim() || null, model: env.AI_MODEL || "claude-sonnet-4-6", timeoutMs: Number(env.AI_TIMEOUT_MS ?? 20000) },
    seedDev: { enabled: env.SEED_DEV_ACCOUNTS === "1" && env.NODE_ENV !== "production", email: env.DEV_SEED_EMAIL || "demo@nasj.local", password: env.DEV_SEED_PASSWORD || null },
  };
}
