import { Router } from "express";
import { z } from "zod";
import type { Config } from "../config";
import type { Db } from "../db";
import { tx } from "../db";
import { ApiError, asyncH, notFound, parse, rateLimit, requireAuth } from "../http";
import { hashPassword, hashToken, newId, newRecoveryCode, newToken, normalizeRecoveryCode, verifyPassword } from "../security";
import { createChild, deleteChild, ownedChild, toChildDto, updateChild } from "../services/children";
import { activityList, answerQuestion, levelActivities, publicActivity, startAttempt, submitAttempt } from "../services/activities";
import { adventureHint, createAdventure, publicAdventure, submitAdventure, type AiClient } from "../services/loom";
import { fullProgress, history, levelStates, progressSummary } from "../services/progression";
import { listRewards, totalStars } from "../services/rewards";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);
const parentName = z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N} '’.-]+$/u, "caractères non autorisés");
const credentials = z.object({ email, password, displayName: parentName.optional() }).strict();
const loginBody = z.object({ email, password: z.string().min(1).max(128) }).strict();
const group = z.enum(["3-5", "5-10"]);
const CATS = ["langues", "maths", "decouverte", "logique", "creativite"] as const;
const prefs = z.object({ explored: z.array(z.enum(CATS)).max(5).optional(), language: z.enum(["fr", "ar"]).optional(), audio: z.boolean().optional() }).strict();
const name = z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N} '’-]+$/u, "caractères non autorisés");
const childCreate = z.object({ displayName: name, ageGroup: group.optional(), age: z.number().int().min(3).max(10).optional(), avatar: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(), preferences: prefs.optional() }).strict();
const childPatch = z.object({ displayName: name.optional(), ageGroup: group.optional(), age: z.number().int().min(3).max(10).nullable().optional(), avatar: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(), preferences: prefs.optional() }).strict();
const idParam = z.string().min(1).max(64);
const levelParam = (v: string) => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 99) throw notFound("Niveau"); return n; };

export function buildRouter(db: Db, cfg: Config, ai: AiClient | null) {
  const r = Router();
  const auth = requireAuth(db);
  const authLimit = rateLimit(cfg, "auth");
  const user = (req: Express.Request & { user?: { id: string } }) => req.user!.id;
  const child = (req: any) => ownedChild(db, req.user!.id, idParam.parse(req.params.childId));

  /* ---------------- Authentication ---------------- */
  const DUMMY = hashPassword("dummy-password-for-timing");
  const issueSession = (userId: string) => {
    const token = newToken();
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
    db.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?,?,?)").run(hashToken(token), userId, new Date(Date.now() + cfg.sessionDays * 86400_000).toISOString());
    return token;
  };
  const userDto = (u: any) => ({ id: u.id, email: u.email, role: u.role, displayName: u.display_name ?? null, hasRecoveryCode: !!u.recovery_hash });
  const setRecoveryCode = async (userId: string) => {
    const code = newRecoveryCode();
    db.prepare("UPDATE users SET recovery_hash = ?, recovery_failures = 0, recovery_locked_until = NULL WHERE id = ?").run(await hashPassword(normalizeRecoveryCode(code)), userId);
    return code;
  };
  r.post("/auth/register", authLimit, asyncH(async (req, res) => {
    const b = parse(credentials, req.body);
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(b.email)) throw new ApiError(409, "EMAIL_TAKEN", "Un compte existe déjà avec cet e-mail.");
    const id = newId();
    db.prepare("INSERT INTO users(id, email, password_hash, display_name) VALUES (?,?,?,?)").run(id, b.email, await hashPassword(b.password), b.displayName ?? null);
    const recoveryCode = await setRecoveryCode(id); // shown ONCE: only its hash is kept
    res.status(201).json({ token: issueSession(id), user: userDto(db.prepare("SELECT * FROM users WHERE id = ?").get(id)), recoveryCode });
  }));
  r.post("/auth/login", authLimit, asyncH(async (req, res) => {
    const b = parse(loginBody, req.body);
    const u = db.prepare("SELECT * FROM users WHERE email = ?").get(b.email);
    const ok = u ? await verifyPassword(b.password, u.password_hash) : (await verifyPassword(b.password, await DUMMY), false); // same work either way
    if (!u || !ok || u.status !== "active") throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.");
    res.json({ token: issueSession(u.id), user: userDto(u) });
  }));
  r.post("/auth/logout", auth, asyncH((req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(/^Bearer (\S+)$/.exec(req.headers.authorization!)![1]));
    res.status(204).end();
  }));
  r.get("/auth/me", auth, asyncH((req, res) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(user(req))!;
    res.json({ user: { ...userDto(u), status: u.status, createdAt: u.created_at }, children: db.prepare("SELECT * FROM children WHERE user_id = ? ORDER BY created_at").all(u.id).map(toChildDto) });
  }));
  r.patch("/auth/me", auth, asyncH((req, res) => {
    const b = parse(z.object({ displayName: parentName }).strict(), req.body);
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(b.displayName, user(req));
    res.json({ user: userDto(db.prepare("SELECT * FROM users WHERE id = ?").get(user(req))!) });
  }));
  r.post("/auth/change-password", auth, asyncH(async (req, res) => {
    const b = parse(z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict(), req.body);
    const u = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user(req))!;
    if (!(await verifyPassword(b.currentPassword, u.password_hash))) throw new ApiError(401, "INVALID_CREDENTIALS", "Mot de passe actuel incorrect.");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(b.newPassword), user(req));
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(user(req), hashToken(/^Bearer (\S+)$/.exec(req.headers.authorization!)![1])); // other devices must log in again
    res.status(204).end();
  }));
  // (Re)generate the recovery code while logged in; requires the password so a stolen session cannot take over the account.
  r.post("/auth/recovery-code", auth, asyncH(async (req, res) => {
    const b = parse(z.object({ password: z.string().min(1).max(128) }).strict(), req.body);
    const u = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user(req))!;
    if (!(await verifyPassword(b.password, u.password_hash))) throw new ApiError(401, "INVALID_CREDENTIALS", "Mot de passe incorrect.");
    res.json({ recoveryCode: await setRecoveryCode(user(req)) });
  }));
  // Forgotten password: e-mail + recovery code + new password. Generic errors, per-account lockout, sessions revoked, code rotated.
  const MAX_FAILS = 5, LOCK_MIN = 15;
  r.post("/auth/recover/reset", authLimit, asyncH(async (req, res) => {
    const b = parse(z.object({ email, recoveryCode: z.string().min(8).max(40), newPassword: password }).strict(), req.body);
    const u = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(b.email);
    const generic = new ApiError(400, "INVALID_RECOVERY", "Adresse e-mail ou code de récupération incorrect.");
    if (u?.recovery_locked_until && u.recovery_locked_until > new Date().toISOString()) throw new ApiError(429, "RECOVERY_LOCKED", "Trop d'essais. Réessaie dans quelques minutes.");
    const ok = u?.recovery_hash ? await verifyPassword(normalizeRecoveryCode(b.recoveryCode), u.recovery_hash) : (await verifyPassword("x", await DUMMY), false);
    if (!u || !ok) {
      if (u) db.prepare("UPDATE users SET recovery_failures = recovery_failures + 1, recovery_locked_until = CASE WHEN recovery_failures + 1 >= ? THEN ? ELSE recovery_locked_until END WHERE id = ?").run(MAX_FAILS, new Date(Date.now() + LOCK_MIN * 60_000).toISOString(), u.id);
      throw generic;
    }
    const newHash = await hashPassword(b.newPassword), code = newRecoveryCode(), codeHash = await hashPassword(normalizeRecoveryCode(code));
    tx(db, () => { // atomic: new password + rotated recovery code + every old session revoked
      db.prepare("UPDATE users SET password_hash = ?, recovery_hash = ?, recovery_failures = 0, recovery_locked_until = NULL WHERE id = ?").run(newHash, codeHash, u.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
    });
    res.json({ ok: true, recoveryCode: code });
  }));
  // Privacy: a parent can erase the account and every child's data (password required).
  r.delete("/auth/me", auth, asyncH(async (req, res) => {
    const b = parse(z.object({ password: z.string().min(1).max(128) }).strict(), req.body);
    const u = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user(req))!;
    if (!(await verifyPassword(b.password, u.password_hash))) throw new ApiError(401, "INVALID_CREDENTIALS", "Mot de passe incorrect.");
    db.prepare("DELETE FROM users WHERE id = ?").run(user(req));
    res.status(204).end();
  }));

  /* ---------------- Child profiles ---------------- */
  r.get("/children", auth, asyncH((req, res) => res.json({ children: db.prepare("SELECT * FROM children WHERE user_id = ? ORDER BY created_at").all(user(req)).map(toChildDto) })));
  r.post("/children", auth, asyncH((req, res) => res.status(201).json({ child: createChild(db, cfg, user(req), parse(childCreate, req.body)) })));
  r.get("/children/:childId", auth, asyncH((req, res) => res.json({ child: toChildDto(child(req)) })));
  r.patch("/children/:childId", auth, asyncH((req, res) => res.json({ child: updateChild(db, cfg, user(req), idParam.parse(req.params.childId), parse(childPatch, req.body)) })));
  r.delete("/children/:childId", auth, asyncH((req, res) => { deleteChild(db, user(req), idParam.parse(req.params.childId)); res.status(204).end(); }));

  /* ---------------- Learning paths & levels ---------------- */
  const pathDto = (p: any) => ({ id: p.id, ageGroup: p.age_group, title: p.title, description: p.description });
  r.get("/learning-paths", auth, asyncH((_req, res) => res.json({ paths: db.prepare("SELECT * FROM learning_paths ORDER BY age_group").all().map(pathDto) })));
  r.get("/learning-paths/:pathId", auth, asyncH((req, res) => {
    const p = db.prepare("SELECT * FROM learning_paths WHERE id = ?").get(idParam.parse(req.params.pathId));
    if (!p) throw notFound("Parcours");
    const levels = db.prepare("SELECT * FROM levels ORDER BY level_order").all().map((l) => ({ id: l.id, title: l.title, subtitle: l.subtitle, description: l.description, order: l.level_order, difficulty: l.difficulty, activities: levelActivities(db, l.id, p.age_group) }));
    res.json({ path: pathDto(p), levels });
  }));
  r.get("/children/:childId/learning-path", auth, asyncH((req, res) => {
    const c = child(req);
    res.json({ path: pathDto(db.prepare("SELECT * FROM learning_paths WHERE id = ?").get(c.learning_path_id)!), levels: levelStates(db, c.id) });
  }));
  r.get("/children/:childId/activities", auth, asyncH((req, res) => res.json({ activities: activityList(db, child(req)) })));
  r.get("/children/:childId/levels", auth, asyncH((req, res) => res.json({ levels: levelStates(db, child(req).id) })));
  const levelDef = (id: number) => { const l = db.prepare("SELECT * FROM levels WHERE id = ?").get(id); if (!l) throw notFound("Niveau"); return l; };
  r.get("/levels/:levelId", auth, asyncH((req, res) => {
    const l = levelDef(levelParam(req.params.levelId as string));
    res.json({ level: { id: l.id, title: l.title, subtitle: l.subtitle, description: l.description, category: l.category, order: l.level_order, difficulty: l.difficulty, unlockRequires: l.unlock_requires, requiredActivities: l.required_activities } });
  }));
  r.get("/children/:childId/levels/:levelId", auth, asyncH((req, res) => {
    const c = child(req), id = levelParam(req.params.levelId as string);
    const state = levelStates(db, c.id).find((l) => l.id === id);
    if (!state) throw notFound("Niveau");
    res.json({ level: state, activities: levelActivities(db, id, c.age_group) });
  }));

  /* ---------------- Activities (answers never leave the server) ---------------- */
  r.get("/levels/:levelId/activities", auth, asyncH((req, res) => {
    const g = req.query.ageGroup === undefined ? undefined : group.parse(req.query.ageGroup);
    res.json({ activities: levelActivities(db, levelDef(levelParam(req.params.levelId as string)).id, g) });
  }));
  r.get("/activities/:activityId", auth, asyncH((req, res) => {
    const a = db.prepare("SELECT * FROM activities WHERE id = ?").get(idParam.parse(req.params.activityId));
    if (!a) throw notFound("Activité");
    res.json({ activity: publicActivity(a) });
  }));
  r.post("/children/:childId/activities/:activityId/start", auth, asyncH((req, res) => res.status(201).json(startAttempt(db, child(req), idParam.parse(req.params.activityId)))));
  const attemptChild = (req: any, attemptId: string) => {
    const a = db.prepare("SELECT child_id FROM activity_attempts WHERE id = ?").get(attemptId);
    if (!a) throw notFound("Tentative");
    return ownedChild(db, req.user.id, a.child_id);
  };
  r.post("/attempts/:attemptId/answer", auth, asyncH((req, res) => {
    const b = parse(z.object({ questionId: z.string().max(16), optionId: z.string().max(32) }).strict(), req.body);
    res.json(answerQuestion(db, attemptChild(req, idParam.parse(req.params.attemptId)), req.params.attemptId as string, b.questionId, b.optionId));
  }));
  // NOTE: the body can only contain the attempt id and raw play data (moves / cells). Stars and rewards are computed server side.
  r.post("/activities/:activityId/submit", auth, asyncH((req, res) => {
    const b = parse(z.object({ attemptId: idParam, moves: z.number().int().optional(), cells: z.number().int().optional() }).strict(), req.body);
    res.json(submitAttempt(db, attemptChild(req, b.attemptId), idParam.parse(req.params.activityId), b.attemptId, b));
  }));

  /* ---------------- Progress & rewards ---------------- */
  r.get("/children/:childId/progress", auth, asyncH((req, res) => { const c = child(req); res.json(fullProgress(db, c.id, c)); }));
  r.get("/children/:childId/progress/summary", auth, asyncH((req, res) => { const c = child(req); res.json(progressSummary(db, c.id, c)); }));
  r.get("/children/:childId/history", auth, asyncH((req, res) => res.json({ history: history(db, child(req).id, Math.min(100, Number(req.query.limit) || 50)) })));
  r.get("/children/:childId/rewards", auth, asyncH((req, res) => res.json({ rewards: listRewards(db, child(req).id) })));
  r.get("/children/:childId/stars", auth, asyncH((req, res) => {
    const c = child(req);
    res.json({ totalStars: totalStars(db, c.id), ledger: db.prepare("SELECT amount, reason, level_id, created_at FROM star_ledger WHERE child_id = ? ORDER BY id").all(c.id).map((l) => ({ amount: l.amount, reason: l.reason, levelId: l.level_id, createdAt: l.created_at })) });
  }));

  /* ---------------- Le Métier à Tisser Magique (AI) ---------------- */
  r.get("/ai/status", auth, asyncH((_req, res) => res.json({ configured: !!ai, features: ["loom"] })));
  r.post("/children/:childId/loom/adventures", auth, asyncH(async (req, res) => {
    const b = parse(z.object({ language: z.enum(["fr", "ar"]), topic: z.string().trim().max(40).regex(/^[\p{L}\p{N} '’-]*$/u).optional() }).strict(), req.body);
    res.status(201).json({ adventure: await createAdventure(db, ai, child(req), b) });
  }));
  r.get("/children/:childId/loom/adventures", auth, asyncH((req, res) => res.json({ adventures: db.prepare("SELECT * FROM ai_adventures WHERE child_id = ? ORDER BY created_at DESC LIMIT 20").all(child(req).id).map(publicAdventure) })));
  const adventure = (req: any) => {
    const a = db.prepare("SELECT * FROM ai_adventures WHERE id = ?").get(idParam.parse(req.params.adventureId));
    if (!a) throw notFound("Aventure");
    ownedChild(db, req.user.id, a.child_id);
    return a;
  };
  r.get("/adventures/:adventureId/hint/:index", auth, asyncH((req, res) => res.json(adventureHint(adventure(req), Number(req.params.index)))));
  r.post("/adventures/:adventureId/submit", auth, asyncH((req, res) => {
    const b = parse(z.object({ answers: z.array(z.number().int().min(0).max(3)).min(1).max(5) }).strict(), req.body);
    res.json(submitAdventure(db, adventure(req), b.answers));
  }));

  return r;
}
