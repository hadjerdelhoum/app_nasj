import { ACTIVITIES, AGE_GROUPS, LEVELS, PATHS } from "./catalog";
import type { Config } from "./config";
import type { Db } from "./db";
import { tx } from "./db";
import { hashPassword, newId } from "./security";

/** Reference data only (paths, levels, activities). Idempotent and NEVER touches users, children or progress. */
export function seedReference(db: Db) {
  tx(db, () => {
    for (const p of PATHS) db.prepare("INSERT INTO learning_paths(id, age_group, title, description) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description").run(p.id, p.age_group, p.title, p.description);
    LEVELS.forEach((l, i) => {
      db.prepare(`INSERT INTO levels(id, code, title, subtitle, description, category, level_order, difficulty, unlock_requires, required_activities) VALUES (?,?,?,?,?,?,?,?,?,1)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, subtitle=excluded.subtitle, description=excluded.description, category=excluded.category, difficulty=excluded.difficulty, unlock_requires=excluded.unlock_requires`)
        .run(l.id, l.code, l.title, l.subtitle, l.description, l.category, i + 1, l.difficulty, i === 0 ? null : LEVELS[i - 1].id);
      for (const g of AGE_GROUPS) db.prepare("INSERT OR IGNORE INTO level_age_groups(level_id, age_group) VALUES (?,?)").run(l.id, g);
    });
    for (const a of ACTIVITIES) db.prepare(`INSERT INTO activities(id, level_id, age_group, kind, category, title, description, instructions, difficulty, position, content) VALUES (?,?,?,?,?,?,?,?,?,1,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, instructions=excluded.instructions, difficulty=excluded.difficulty, content=excluded.content`)
      .run(a.id, a.levelId, a.group, a.kind, LEVELS.find((l) => l.id === a.levelId)!.category, a.title, a.description, a.instructions, a.difficulty, JSON.stringify(a.content));
  });
}

/** Development only: one demo parent account, created once, never overwritten. The password comes from the environment. */
export async function seedDevAccounts(db: Db, cfg: Config): Promise<string> {
  if (!cfg.seedDev.enabled) return "Dev accounts disabled (set SEED_DEV_ACCOUNTS=1, not allowed in production).";
  if (!cfg.seedDev.password || cfg.seedDev.password.length < 8) return "Set DEV_SEED_PASSWORD (min 8 chars) to create the dev account.";
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(cfg.seedDev.email)) return `Dev account ${cfg.seedDev.email} already exists: left untouched.`;
  db.prepare("INSERT INTO users(id, email, password_hash) VALUES (?,?,?)").run(newId(), cfg.seedDev.email, await hashPassword(cfg.seedDev.password));
  return `Dev account ${cfg.seedDev.email} created.`;
}
