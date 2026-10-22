import type { Db } from "../db";
import { BADGES } from "../catalog";
import { newId } from "../security";

export const totalStars = (db: Db, childId: string) => (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM star_ledger WHERE child_id = ?").get(childId)!.s as number);

export function grantBadge(db: Db, childId: string, code: string, extra: { levelId?: number; activityId?: string } = {}): boolean {
  const b = BADGES[code];
  if (!b) return false;
  // UNIQUE(child_id, code) + INSERT OR IGNORE: repeated calls can never create a second reward.
  const r = db.prepare("INSERT OR IGNORE INTO rewards(id, child_id, type, code, name, description, level_id, activity_id) VALUES (?,?,?,?,?,?,?,?)")
    .run(newId(), childId, "badge", code, b.name, b.description, extra.levelId ?? b.levelId ?? null, extra.activityId ?? null);
  return Number(r.changes) === 1;
}

/** Evaluates every badge rule from the saved data and returns the codes granted by THIS call. */
export function evaluateBadges(db: Db, childId: string): string[] {
  const done = db.prepare("SELECT level_id FROM child_level_progress WHERE child_id = ? AND status = 'completed'").all(childId).map((r) => r.level_id as number);
  const child = db.prepare("SELECT preferences FROM children WHERE id = ?").get(childId)!;
  const explored = (JSON.parse(child.preferences).explored ?? []) as unknown[];
  const earned: string[] = [];
  const check = (code: string, ok: boolean) => { if (ok && grantBadge(db, childId, code)) earned.push(code); };
  check("first", done.length > 0);
  for (const [code, lvl] of [["reader", 1], ["math", 2], ["memory", 3], ["artist", 4], ["scientist", 5]] as const) check(code, done.includes(lvl));
  check("explorer", Array.isArray(explored) && new Set(explored).size >= 3);
  check("stars10", totalStars(db, childId) >= 10);
  return earned;
}

export const listRewards = (db: Db, childId: string) =>
  db.prepare("SELECT id, type, code, name, description, level_id, activity_id, achieved_at FROM rewards WHERE child_id = ? ORDER BY achieved_at, rowid").all(childId)
    .map((r) => ({ id: r.id, type: r.type, code: r.code, name: r.name, description: r.description, levelId: r.level_id, activityId: r.activity_id, achievedAt: r.achieved_at }));
