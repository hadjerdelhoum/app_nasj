import type { AgeGroup, Config } from "../config";
import type { Db, Row } from "../db";
import { tx } from "../db";
import { ApiError, notFound } from "../http";
import { newId } from "../security";
import { evaluateBadges } from "./rewards";

export const pathIdFor = (g: AgeGroup) => (g === "3-5" ? "petits-explorateurs" : "grands-explorateurs");

/**
 * Age classification. The ranges 3–5 and 5–10 overlap at 5, so:
 *  - an explicit group always wins when it is compatible with the age (a 5-year-old may be in either group);
 *  - with only an age, age 5 goes to config.ageFiveGroup (AGE_FIVE_GROUP, default "3-5"); other ages are unambiguous;
 *  - an age incompatible with an explicit group is rejected (422) instead of being silently reassigned.
 */
export function resolveAgeGroup(cfg: Config, input: { ageGroup?: AgeGroup; age?: number }): AgeGroup {
  const { ageGroup, age } = input;
  const allowed = (a: number): AgeGroup[] => (a < 5 ? ["3-5"] : a === 5 ? ["3-5", "5-10"] : ["5-10"]);
  if (ageGroup && age !== undefined && !allowed(age).includes(ageGroup))
    throw new ApiError(422, "AGE_GROUP_MISMATCH", `Un enfant de ${age} ans ne peut pas être dans le parcours ${ageGroup}.`);
  if (ageGroup) return ageGroup;
  if (age === undefined) throw new ApiError(400, "VALIDATION_ERROR", "Indique l'âge ou la tranche d'âge (ageGroup).");
  return age === 5 ? cfg.ageFiveGroup : allowed(age)[0];
}

export function toChildDto(r: Row) {
  return { id: r.id, displayName: r.display_name, ageGroup: r.age_group as AgeGroup, age: r.age ?? null, avatar: r.avatar, learningPathId: r.learning_path_id, preferences: JSON.parse(r.preferences), createdAt: r.created_at };
}

/** Returns the child only if it belongs to the authenticated parent (404 otherwise: never reveals other accounts' data). */
export function ownedChild(db: Db, userId: string, childId: string): Row {
  const c = db.prepare("SELECT * FROM children WHERE id = ? AND user_id = ?").get(childId, userId);
  if (!c) throw notFound("Profil enfant");
  return c;
}

export function createChild(db: Db, cfg: Config, userId: string, b: { displayName: string; ageGroup?: AgeGroup; age?: number; avatar?: string; preferences?: Record<string, unknown> }) {
  const group = resolveAgeGroup(cfg, b);
  const count = db.prepare("SELECT COUNT(*) n FROM children WHERE user_id = ?").get(userId)!.n as number;
  if (count >= 6) throw new ApiError(409, "CHILD_LIMIT", "Maximum 6 profils enfants par compte.");
  const id = newId();
  tx(db, () => {
    db.prepare("INSERT INTO children(id, user_id, display_name, age_group, age, avatar, learning_path_id, preferences) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, userId, b.displayName, group, b.age ?? null, b.avatar ?? "nasj-default", pathIdFor(group), JSON.stringify(b.preferences ?? {}));
    // Level 1 is available from the start; the others unlock through real results.
    for (const l of db.prepare("SELECT id, unlock_requires FROM levels ORDER BY level_order").all())
      db.prepare("INSERT INTO child_level_progress(child_id, level_id, unlocked, status) VALUES (?,?,?,?)").run(id, l.id, l.unlock_requires === null ? 1 : 0, l.unlock_requires === null ? "available" : "locked");
  });
  return toChildDto(db.prepare("SELECT * FROM children WHERE id = ?").get(id)!);
}

export function updateChild(db: Db, cfg: Config, userId: string, childId: string, b: { displayName?: string; ageGroup?: AgeGroup; age?: number | null; avatar?: string; preferences?: Record<string, unknown> }) {
  const c = ownedChild(db, userId, childId);
  let group = c.age_group as AgeGroup;
  const newAge = b.age === undefined ? c.age ?? undefined : b.age ?? undefined;
  if (b.ageGroup || (b.age !== undefined && b.age !== null)) group = resolveAgeGroup(cfg, { ageGroup: b.ageGroup ?? (b.age !== undefined ? undefined : group), age: newAge });
  const prefs = b.preferences ? { ...JSON.parse(c.preferences), ...b.preferences } : JSON.parse(c.preferences);
  tx(db, () => {
    // Only the profile changes: progress, stars, rewards and history are keyed by level/child and stay untouched.
    db.prepare("UPDATE children SET display_name=?, age_group=?, age=?, avatar=?, learning_path_id=?, preferences=? WHERE id=?")
      .run(b.displayName ?? c.display_name, group, b.age === null ? null : newAge ?? null, b.avatar ?? c.avatar, pathIdFor(group), JSON.stringify(prefs), childId);
    if (b.preferences) evaluateBadges(db, childId);
  });
  return toChildDto(db.prepare("SELECT * FROM children WHERE id = ?").get(childId)!);
}

/** Privacy: deleting a profile removes ALL its data (progress, history, rewards, stars, adventures) through ON DELETE CASCADE. */
export function deleteChild(db: Db, userId: string, childId: string) {
  ownedChild(db, userId, childId);
  db.prepare("DELETE FROM children WHERE id = ?").run(childId);
}
