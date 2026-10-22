import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate, openDb } from "../src/db";
import { childFor, playQuiz, setup, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => ctx.close());
const reg = async (email: string, displayName = "Maman Lina") => (await ctx.api("POST", "/api/auth/register", { body: { email, password: "correct horse 42", displayName } })).body;

describe("registration with display name and recovery code", () => {
  it("returns the recovery code once and stores only its hash", async () => {
    const r = await reg("rec1@test.dev");
    expect(r.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(r.user).toMatchObject({ displayName: "Maman Lina", hasRecoveryCode: true });
    const row = ctx.db.prepare("SELECT recovery_hash FROM users WHERE email = 'rec1@test.dev'").get()!;
    expect(row.recovery_hash.startsWith("scrypt$")).toBe(true);
    expect(JSON.stringify((await ctx.api("GET", "/api/auth/me", { token: r.token })).body)).not.toContain(r.recoveryCode.replace(/-/g, ""));
    expect((await ctx.api("POST", "/api/auth/register", { body: { email: "bad@test.dev", password: "correct horse 42", displayName: "<b>x</b>" } })).status).toBe(400);
  });
});

describe("password recovery", () => {
  it("resets the password with the code, revokes sessions, rotates the code and rejects reuse", async () => {
    const r = await reg("rec2@test.dev");
    const reset = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec2@test.dev", recoveryCode: r.recoveryCode.toLowerCase(), newPassword: "brand new pass 9" } });
    expect(reset.status).toBe(200);
    expect(reset.body.recoveryCode).not.toBe(r.recoveryCode);
    expect((await ctx.api("GET", "/api/auth/me", { token: r.token })).status).toBe(401); // old session revoked
    expect((await ctx.api("POST", "/api/auth/login", { body: { email: "rec2@test.dev", password: "correct horse 42" } })).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { body: { email: "rec2@test.dev", password: "brand new pass 9" } })).status).toBe(200);
    const again = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec2@test.dev", recoveryCode: r.recoveryCode, newPassword: "another pass 123" } });
    expect(again.status).toBe(400); // used code is dead
    const next = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec2@test.dev", recoveryCode: reset.body.recoveryCode, newPassword: "third password 77" } });
    expect(next.status).toBe(200);
  });
  it("uses the same generic error for unknown accounts and wrong codes, and never leaks secrets", async () => {
    await reg("rec3@test.dev");
    const wrong = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec3@test.dev", recoveryCode: "AAAA-BBBB-CCCC-DDDD", newPassword: "whatever pass 1" } });
    const unknown = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "nobody@test.dev", recoveryCode: "AAAA-BBBB-CCCC-DDDD", newPassword: "whatever pass 1" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual(unknown.body);
    expect(JSON.stringify(wrong.body)).not.toMatch(/hash|scrypt/);
  });
  it("locks the account's recovery after 5 wrong codes, even with the right code afterwards", async () => {
    const r = await reg("rec4@test.dev");
    for (let i = 0; i < 5; i++) await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec4@test.dev", recoveryCode: "AAAA-BBBB-CCCC-DDDD", newPassword: "whatever pass 1" } });
    const locked = await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec4@test.dev", recoveryCode: r.recoveryCode, newPassword: "whatever pass 1" } });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("RECOVERY_LOCKED");
    expect((await ctx.api("POST", "/api/auth/login", { body: { email: "rec4@test.dev", password: "correct horse 42" } })).status).toBe(200); // normal login unaffected
  });
  it("accounts without a code (created before this feature) can generate one while logged in, with the password", async () => {
    ctx.db.prepare("INSERT INTO users(id,email,password_hash) VALUES ('old1','old@test.dev','x')").run();
    const r = await reg("rec5@test.dev");
    ctx.db.prepare("UPDATE users SET recovery_hash = NULL WHERE email = 'rec5@test.dev'").run();
    expect((await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec5@test.dev", recoveryCode: r.recoveryCode, newPassword: "whatever pass 1" } })).status).toBe(400);
    expect((await ctx.api("POST", "/api/auth/recovery-code", { token: r.token, body: { password: "nope nope nope" } })).status).toBe(401);
    const g = await ctx.api("POST", "/api/auth/recovery-code", { token: r.token, body: { password: "correct horse 42" } });
    expect(g.status).toBe(200);
    expect((await ctx.api("POST", "/api/auth/recover/reset", { body: { email: "rec5@test.dev", recoveryCode: g.body.recoveryCode, newPassword: "whatever pass 1" } })).status).toBe(200);
  });
});

describe("account management", () => {
  it("changes the display name and the password (other devices are signed out)", async () => {
    const r = await reg("acc1@test.dev");
    const other = (await ctx.api("POST", "/api/auth/login", { body: { email: "acc1@test.dev", password: "correct horse 42" } })).body.token;
    expect((await ctx.api("PATCH", "/api/auth/me", { token: r.token, body: { displayName: "Papa" } })).body.user.displayName).toBe("Papa");
    expect((await ctx.api("POST", "/api/auth/change-password", { token: r.token, body: { currentPassword: "wrong one", newPassword: "new password 1234" } })).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/change-password", { token: r.token, body: { currentPassword: "correct horse 42", newPassword: "new password 1234" } })).status).toBe(204);
    expect((await ctx.api("GET", "/api/auth/me", { token: r.token })).status).toBe(200);
    expect((await ctx.api("GET", "/api/auth/me", { token: other })).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { body: { email: "acc1@test.dev", password: "new password 1234" } })).status).toBe(200);
  });
  it("stores the audio preference and rejects unknown preferences", async () => {
    const r = await reg("acc2@test.dev"), id = await childFor(ctx, r.token);
    expect((await ctx.api("PATCH", `/api/children/${id}`, { token: r.token, body: { preferences: { audio: false } } })).body.child.preferences.audio).toBe(false);
    expect((await ctx.api("PATCH", `/api/children/${id}`, { token: r.token, body: { preferences: { audio: "yes" } } })).status).toBe(400);
  });
});

describe("dashboard data and activity list", () => {
  it("exposes completed activities, last activity and the recommended next activity", async () => {
    const r = await reg("dash1@test.dev"), id = await childFor(ctx, r.token, "5-10");
    let s = (await ctx.api("GET", `/api/children/${id}/progress/summary`, { token: r.token })).body;
    expect(s).toMatchObject({ completedActivities: 0, lastActivity: null, recommended: { levelId: 1, activityId: "l1-vocab-5-10" } });
    await (await playQuiz(ctx, r.token, id, "l1-vocab-5-10")).submit!();
    s = (await ctx.api("GET", `/api/children/${id}/progress/summary`, { token: r.token })).body;
    expect(s).toMatchObject({ completedActivities: 1, lastActivity: { activityId: "l1-vocab-5-10", stars: 3 }, recommended: { levelId: 2, activityId: "l2-math-5-10" } });
    const list = (await ctx.api("GET", `/api/children/${id}/activities`, { token: r.token })).body.activities;
    expect(list.map((a: any) => [a.id, a.unlocked, a.completed])).toEqual([["l1-vocab-5-10", true, true], ["l2-math-5-10", true, false], ["l3-memory-5-10", false, false], ["l4-paint-5-10", false, false], ["l5-discover-5-10", false, false]]);
    expect(JSON.stringify(list)).not.toMatch(/"answer"|pool/);
    const other = await reg("dash2@test.dev");
    expect((await ctx.api("GET", `/api/children/${id}/activities`, { token: other.token })).status).toBe(404);
  });
  it("uses fewer choices for the 3–5 group", async () => {
    const r = await reg("dash3@test.dev"), id = await childFor(ctx, r.token, "3-5");
    const s = await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-3-5/start`, { token: r.token });
    expect(s.body.questions.every((q: any) => q.options.length === 2)).toBe(true);
  });
});

describe("migration 002 is non-destructive", () => {
  it("keeps existing users when applied on top of the first schema", () => {
    const db = openDb(":memory:");
    db.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT 'x')");
    // apply 001 only, insert a user, then run the rest
    const files = ["001_init.sql"];
    for (const f of files) { db.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8")); db.prepare("INSERT INTO schema_migrations(name) VALUES (?)").run(f); }
    db.prepare("INSERT INTO users(id,email,password_hash) VALUES ('u1','keep@test.dev','hash')").run();
    expect(migrate(db)).toEqual(["002_account.sql"]);
    expect(db.prepare("SELECT email, password_hash, display_name, recovery_hash FROM users").get()).toMatchObject({ email: "keep@test.dev", password_hash: "hash", display_name: null, recovery_hash: null });
    db.close();
  });
});
