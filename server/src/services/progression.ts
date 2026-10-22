import type { Db, Row } from "../db";
import { ApiError } from "../http";
import { listRewards, totalStars } from "./rewards";

export type LevelStatus = "locked" | "available" | "in_progress" | "completed";

/** Level states are READ from saved progress (never computed from the client). "in_progress" = an attempt was started but the level is not finished. */
export function levelStates(db: Db, childId: string) {
  const started = new Set(db.prepare("SELECT DISTINCT level_id FROM activity_attempts WHERE child_id = ? AND status = 'started'").all(childId).map((r) => r.level_id as number));
  return db.prepare(
    `SELECT l.id, l.code, l.title, l.subtitle, l.description, l.category, l.level_order, l.difficulty, l.unlock_requires, l.required_activities,
            p.unlocked, p.status, p.best_stars, p.completed_activities, p.progress_pct, p.last_activity_at, p.completed_at
     FROM levels l JOIN child_level_progress p ON p.level_id = l.id AND p.child_id = ? ORDER BY l.level_order`).all(childId).map((r) => {
    const status: LevelStatus = r.status === "available" && started.has(r.id) ? "in_progress" : r.status;
    return {
      id: r.id as number, code: r.code, title: r.title, subtitle: r.subtitle, description: r.description, category: r.category, order: r.level_order, difficulty: r.difficulty,
      unlockRequires: r.unlock_requires as number | null, requiredActivities: r.required_activities, unlocked: r.unlocked === 1, status,
      bestStars: r.best_stars as number, completedActivities: r.completed_activities as number, progressPct: r.progress_pct as number, lastActivityAt: r.last_activity_at, completedAt: r.completed_at,
    };
  });
}

export function assertUnlocked(db: Db, childId: string, levelId: number) {
  const p = db.prepare("SELECT unlocked FROM child_level_progress WHERE child_id = ? AND level_id = ?").get(childId, levelId);
  if (!p) throw new ApiError(404, "NOT_FOUND", "Niveau introuvable.");
  if (p.unlocked !== 1) throw new ApiError(403, "LEVEL_LOCKED", "Ce niveau est verrouillé : termine d'abord le niveau précédent.");
}

const today = () => new Date().toISOString().slice(0, 10);

export function progressSummary(db: Db, childId: string, child: Row) {
  const levels = levelStates(db, childId);
  const stars = totalStars(db, childId);
  const completed = levels.filter((l) => l.status === "completed").length;
  const current = levels.find((l) => l.unlocked && l.status !== "completed") ?? levels[levels.length - 1];
  return {
    childId, ageGroup: child.age_group, totalStars: stars, level: Math.floor(stars / 6) + 1, starsToNextLevel: 6 - (stars % 6),
    completedLevels: completed, totalLevels: levels.length, currentLevelId: current.id,
    dailyDone: !!db.prepare("SELECT 1 FROM star_ledger WHERE child_id = ? AND reason = 'daily_bonus' AND day = ?").get(childId, today()),
    rewardsCount: (db.prepare("SELECT COUNT(*) n FROM rewards WHERE child_id = ?").get(childId)!.n as number),
    completedActivities: (db.prepare("SELECT COUNT(DISTINCT activity_id) n FROM activity_attempts WHERE child_id = ? AND status = 'completed'").get(childId)!.n as number),
    lastActivity: lastActivity(db, childId),
    recommended: recommended(db, child, current.id),
  };
}

export function fullProgress(db: Db, childId: string, child: Row) {
  return { summary: progressSummary(db, childId, child), levels: levelStates(db, childId), rewards: listRewards(db, childId), explored: (JSON.parse(child.preferences).explored ?? []) as string[] };
}

export function history(db: Db, childId: string, limit = 50) {
  return db.prepare(
    `SELECT a.id, a.activity_id, a.level_id, a.status, a.stars, a.score, a.mistakes, a.started_at, a.completed_at, a.time_spent_s, x.title activity_title,
            (SELECT COUNT(*) FROM activity_attempts b WHERE b.child_id = a.child_id AND b.activity_id = a.activity_id AND b.started_at <= a.started_at) AS attempt_number
     FROM activity_attempts a JOIN activities x ON x.id = a.activity_id WHERE a.child_id = ? ORDER BY a.started_at DESC, a.rowid DESC LIMIT ?`).all(childId, limit)
    .map((r) => ({ attemptId: r.id, activityId: r.activity_id, activityTitle: r.activity_title, levelId: r.level_id, status: r.status, stars: r.stars, score: r.score, mistakes: r.mistakes, attemptNumber: r.attempt_number, startedAt: r.started_at, completedAt: r.completed_at, timeSpentSeconds: r.time_spent_s }));
}

function lastActivity(db: Db, childId: string) {
  const r = db.prepare(`SELECT a.id, a.title, a.level_id, t.stars, t.completed_at FROM activity_attempts t JOIN activities a ON a.id = t.activity_id
                        WHERE t.child_id = ? AND t.status = 'completed' ORDER BY t.completed_at DESC, t.rowid DESC LIMIT 1`).get(childId);
  return r ? { activityId: r.id as string, title: r.title as string, levelId: r.level_id as number, stars: r.stars as number, completedAt: r.completed_at as string } : null;
}
function recommended(db: Db, child: Row, levelId: number) {
  const a = db.prepare("SELECT id, title FROM activities WHERE level_id = ? AND age_group = ? ORDER BY position LIMIT 1").get(levelId, child.age_group);
  return a ? { levelId, activityId: a.id as string, title: a.title as string } : null;
}
