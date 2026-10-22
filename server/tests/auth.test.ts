import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parent, setup, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => ctx.close());

describe("authentication", () => {
  it("registers a parent, stores only a scrypt hash and returns a token", async () => {
    const r = await ctx.api("POST", "/api/auth/register", { body: { email: "Mama@Test.dev", password: "correct horse 42" } });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe("mama@test.dev");
    expect(r.body.token.length).toBeGreaterThan(30);
    const row = ctx.db.prepare("SELECT password_hash FROM users WHERE email = ?").get("mama@test.dev")!;
    expect(row.password_hash.startsWith("scrypt$")).toBe(true);
    expect(row.password_hash).not.toContain("correct horse");
    expect(ctx.db.prepare("SELECT token_hash FROM sessions").all().every((s) => s.token_hash !== r.body.token)).toBe(true); // token itself is not stored
  });
  it("rejects duplicate e-mails and weak input", async () => {
    expect((await ctx.api("POST", "/api/auth/register", { body: { email: "mama@test.dev", password: "another long pass" } })).status).toBe(409);
    expect((await ctx.api("POST", "/api/auth/register", { body: { email: "x@test.dev", password: "short" } })).status).toBe(400);
    expect((await ctx.api("POST", "/api/auth/register", { body: { email: "not-an-email", password: "long enough pw" } })).status).toBe(400);
    expect((await ctx.api("POST", "/api/auth/register", { body: { email: "y@test.dev", password: "long enough pw", role: "admin" } })).status).toBe(400); // no privilege escalation
  });
  it("logs in with the right password only", async () => {
    const ok = await ctx.api("POST", "/api/auth/login", { body: { email: "mama@test.dev", password: "correct horse 42" } });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const bad = await ctx.api("POST", "/api/auth/login", { body: { email: "mama@test.dev", password: "wrong password!" } });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    const unknown = await ctx.api("POST", "/api/auth/login", { body: { email: "nobody@test.dev", password: "wrong password!" } });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message); // same message: no account enumeration
  });
  it("protects routes and ends sessions on logout / expiry", async () => {
    expect((await ctx.api("GET", "/api/auth/me")).status).toBe(401);
    expect((await ctx.api("GET", "/api/children", { token: "garbage" })).status).toBe(401);
    const { token } = await parent(ctx);
    expect((await ctx.api("GET", "/api/auth/me", { token })).status).toBe(200);
    expect((await ctx.api("POST", "/api/auth/logout", { token })).status).toBe(204);
    expect((await ctx.api("GET", "/api/auth/me", { token })).status).toBe(401);
    const t2 = (await parent(ctx)).token;
    ctx.db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    const r = await ctx.api("GET", "/api/auth/me", { token: t2 });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("SESSION_EXPIRED");
  });
  it("never leaks internals in errors and sets safe headers", async () => {
    const r = await fetch(ctx.base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad json" });
    expect(r.status).toBe(400);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-powered-by")).toBeNull();
    expect(JSON.stringify(await r.json())).not.toMatch(/stack|SyntaxError|node_modules/);
    expect((await ctx.api("GET", "/api/unknown")).status).toBe(404);
  });
  it("restricts CORS to configured origins", async () => {
    const ok = await fetch(ctx.base + "/health", { headers: { origin: "http://localhost:5173" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const bad = await fetch(ctx.base + "/health", { headers: { origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("deletes the account and all its data on request", async () => {
    const { token } = await parent(ctx);
    await ctx.api("POST", "/api/children", { token, body: { displayName: "Sami", ageGroup: "3-5" } });
    const before = ctx.db.prepare("SELECT COUNT(*) n FROM children").get()!.n as number;
    expect((await ctx.api("DELETE", "/api/auth/me", { token, body: { password: "wrong password" } })).status).toBe(401); // password required
    expect((await ctx.api("DELETE", "/api/auth/me", { token, body: { password: "correct horse 42" } })).status).toBe(204);
    expect(ctx.db.prepare("SELECT COUNT(*) n FROM children").get()!.n).toBe(before - 1);
    expect((await ctx.api("GET", "/api/auth/me", { token })).status).toBe(401);
  });
});

describe("rate limiting", () => {
  it("returns 429 after too many auth attempts", async () => {
    const c = await setup({ RATE_LIMIT: "on" });
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await c.api("POST", "/api/auth/login", { body: { email: "a@b.dev", password: "nope nope nope" } })).status;
    expect(last).toBe(429);
    await c.close();
  });
});
