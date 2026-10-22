import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { migrate, openDb } from "../src/db";
import { seedDevAccounts, seedReference } from "../src/seed";
import { childFor, parent, playQuiz, setup } from "./helpers";

describe("migrations", () => {
  it("creates the full schema once and is re-runnable", () => {
    const db = openDb(":memory:");
    expect(migrate(db)).toEqual(["001_init.sql", "002_account.sql"]);
    expect(migrate(db)).toEqual([]);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    for (const t of ["users", "sessions", "children", "learning_paths", "levels", "activities", "child_level_progress", "activity_attempts", "star_ledger", "rewards", "ai_adventures", "schema_migrations"]) expect(tables).toContain(t);
    expect(db.prepare("PRAGMA foreign_keys").get()!.foreign_keys).toBe(1);
    expect(() => db.prepare("INSERT INTO children(id,user_id,display_name,age_group,learning_path_id) VALUES ('c','nope','x','3-5','p')").run()).toThrow(); // FK enforced
    db.close();
  });
  it("enforces key constraints in the database itself", () => {
    const db = openDb(":memory:"); migrate(db); seedReference(db);
    db.prepare("INSERT INTO users(id,email,password_hash) VALUES ('u','a@b.dev','h')").run();
    expect(() => db.prepare("INSERT INTO users(id,email,password_hash) VALUES ('u2','A@B.DEV','h')").run()).toThrow(); // case-insensitive unique e-mail
    expect(() => db.prepare("INSERT INTO children(id,user_id,display_name,age_group,learning_path_id) VALUES ('c','u','x','9-9','petits-explorateurs')").run()).toThrow(); // bad age group
    db.prepare("INSERT INTO children(id,user_id,display_name,age_group,learning_path_id) VALUES ('c','u','x','3-5','petits-explorateurs')").run();
    db.prepare("INSERT INTO rewards(id,child_id,code,name,description) VALUES ('r1','c','first','n','d')").run();
    expect(() => db.prepare("INSERT INTO rewards(id,child_id,code,name,description) VALUES ('r2','c','first','n','d')").run()).toThrow(); // no duplicate reward
    db.close();
  });
});

describe("seed data", () => {
  it("seeds 2 paths, 5 levels and activities for both age groups, idempotently", () => {
    const db = openDb(":memory:"); migrate(db); seedReference(db); seedReference(db);
    expect(db.prepare("SELECT COUNT(*) n FROM learning_paths").get()!.n).toBe(2);
    expect(db.prepare("SELECT subtitle FROM levels ORDER BY level_order").all().map((l) => l.subtitle)).toEqual(["Je découvre", "J'apprends", "Je relève des défis", "Je crée", "Je m'émerveille"]);
    expect(db.prepare("SELECT age_group, COUNT(*) n FROM activities GROUP BY age_group").all().map((r) => [r.age_group, r.n])).toEqual([["3-5", 5], ["5-10", 5]]);
    db.close();
  });
  it("never overwrites real users or progress when re-seeding", async () => {
    const ctx = await setup();
    const { token } = await parent(ctx), id = await childFor(ctx, token);
    await (await playQuiz(ctx, token, id, "l1-vocab-5-10")).submit!();
    const snap = () => JSON.stringify([ctx.db.prepare("SELECT * FROM users").all(), ctx.db.prepare("SELECT * FROM child_level_progress").all(), ctx.db.prepare("SELECT * FROM star_ledger").all(), ctx.db.prepare("SELECT * FROM rewards").all()]);
    const before = snap();
    seedReference(ctx.db); seedReference(ctx.db);
    expect(snap()).toBe(before);
    await ctx.close();
  });
  it("creates the dev account only in development, once, from the environment", async () => {
    const db = openDb(":memory:"); migrate(db);
    const dev = loadConfig({ SEED_DEV_ACCOUNTS: "1", DEV_SEED_PASSWORD: "dev-only-password-1" });
    expect(await seedDevAccounts(db, dev)).toContain("created");
    const hash = db.prepare("SELECT password_hash FROM users").get()!.password_hash;
    expect(await seedDevAccounts(db, dev)).toContain("untouched");
    expect(db.prepare("SELECT password_hash FROM users").get()!.password_hash).toBe(hash);
    expect(await seedDevAccounts(db, loadConfig({ SEED_DEV_ACCOUNTS: "1", NODE_ENV: "production", DEV_SEED_PASSWORD: "dev-only-password-1" }))).toContain("disabled");
    expect(await seedDevAccounts(db, loadConfig({ SEED_DEV_ACCOUNTS: "1" }))).toContain("DEV_SEED_PASSWORD");
    db.close();
  });
});
