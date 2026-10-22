import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// node:sqlite is loaded through createRequire so bundlers/test runners do not try to resolve it.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => RawDb };

type Param = string | number | bigint | null;
export type Row = Record<string, any>;
interface RawStmt { get(...p: Param[]): Row | undefined; all(...p: Param[]): Row[]; run(...p: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint } }
interface RawDb { prepare(sql: string): RawStmt; exec(sql: string): void; close(): void }
export type Db = RawDb;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return db;
}

/** Applies every migrations/NNN_*.sql file once, in order. Returns the list of newly applied files. */
export function migrate(db: Db): string[] {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))");
  const done = new Set(db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name as string));
  const applied: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations(name) VALUES (?)").run(file);
      db.exec("COMMIT");
      applied.push(file);
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  return applied;
}

/** Runs fn inside one atomic transaction (BEGIN IMMEDIATE serialises writers). */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}
