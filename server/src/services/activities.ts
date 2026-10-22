import type { AgeGroup } from "../config";
import { starsFromMistakes, starsFromMoves } from "../catalog";
import type { Db, Row } from "../db";
import { tx } from "../db";
import { ApiError, notFound } from "../http";
import { makeDiscover, makeMath, makeVocab, type Question } from "../generators";
import { newId } from "../security";
import { assertUnlocked } from "./progression";
import { evaluateBadges, totalStars } from "./rewards";

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

/** What the client may see about an activity: no pools, no answers, no evaluation rules. */
export function publicActivity(a: Row) {
  const c = JSON.parse(a.content);
  const config: Record<string, number> = {};
  for (const k of ["questions", "pairs", "minCells", "grid"]) if (typeof c[k] === "number") config[k] = c[k];
  return { id: a.id, levelId: a.level_id, ageGroup: a.age_group, kind: a.kind, category: a.category, title: a.title, description: a.description, instructions: a.instructions, difficulty: a.difficulty, position: a.position, config };
}

interface QuizState { kind: "quiz"; questions: Question[]; solved: string[]; wrong: Record<string, string[]> }
interface MemoryState { kind: "memory"; pairs: number }
interface PaintState { kind: "paint"; minCells: number; grid: number }
type State = QuizState | MemoryState | PaintState;

const stripAnswers = (qs: Question[]) => qs.map(({ answer: _a, ...q }) => q);

export function startAttempt(db: Db, child: Row, activityId: string) {
  const a = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
  if (!a) throw notFound("Activité");
  if (a.age_group !== child.age_group) throw new ApiError(409, "ACTIVITY_NOT_FOR_GROUP", "Cette activité ne correspond pas au parcours de l'enfant.");
  assertUnlocked(db, child.id, a.level_id);
  const c = JSON.parse(a.content);
  let state: State;
  if (a.kind === "vocab") state = { kind: "quiz", questions: makeVocab(c.pool, c.questions, c.choices ?? 3), solved: [], wrong: {} };
  else if (a.kind === "discover") state = { kind: "quiz", questions: makeDiscover(c.questions, c.choices ?? 3), solved: [], wrong: {} };
  else if (a.kind === "math") state = { kind: "quiz", questions: makeMath(c.band, c.questions), solved: [], wrong: {} };
  else if (a.kind === "memory") state = { kind: "memory", pairs: c.pairs };
  else state = { kind: "paint", minCells: c.minCells, grid: c.grid };
  const id = newId();
  tx(db, () => {
    db.prepare("UPDATE activity_attempts SET status='abandoned' WHERE child_id=? AND activity_id=? AND status='started'").run(child.id, activityId);
    db.prepare("INSERT INTO activity_attempts(id, child_id, activity_id, level_id, state) VALUES (?,?,?,?,?)").run(id, child.id, activityId, a.level_id, JSON.stringify(state));
  });
  return { attemptId: id, activity: publicActivity(a), questions: state.kind === "quiz" ? stripAnswers(state.questions) : undefined, config: state.kind === "quiz" ? undefined : state };
}

function ownedAttempt(db: Db, child: Row, attemptId: string) {
  const at = db.prepare("SELECT * FROM activity_attempts WHERE id = ? AND child_id = ?").get(attemptId, child.id);
  if (!at) throw notFound("Tentative");
  return at;
}

/** Checks one answer against the secret answer stored with the attempt. Replaying the same wrong option is not counted twice. */
export function answerQuestion(db: Db, child: Row, attemptId: string, questionId: string, optionId: string) {
  return tx(db, () => {
    const at = ownedAttempt(db, child, attemptId);
    if (at.status !== "started") throw new ApiError(409, "ATTEMPT_CLOSED", "Cette tentative est terminée.");
    const st = JSON.parse(at.state) as State;
    if (st.kind !== "quiz") throw new ApiError(400, "NOT_A_QUIZ", "Cette activité n'a pas de questions.");
    const q = st.questions.find((x) => x.id === questionId);
    if (!q || !q.options.some((o) => o.id === optionId)) throw new ApiError(400, "VALIDATION_ERROR", "Question ou réponse inconnue.");
    if (st.solved.includes(questionId)) return { correct: optionId === q.answer, solved: true, mistakes: at.mistakes as number };
    let correct = optionId === q.answer;
    if (correct) st.solved.push(questionId);
    else (st.wrong[questionId] ??= []).includes(optionId) || st.wrong[questionId].push(optionId);
    const mistakes = Object.values(st.wrong).reduce((n, w) => n + w.length, 0);
    db.prepare("UPDATE activity_attempts SET state = ?, mistakes = ? WHERE id = ?").run(JSON.stringify(st), mistakes, attemptId);
    return { correct, solved: st.solved.includes(questionId), mistakes };
  });
}

export interface SubmitResult {
  attemptId: string; activityId: string; levelId: number; stars: number; deltaStars: number; dailyBonus: boolean; totalStars: number;
  levelCompleted: boolean; unlockedLevelId: number | null; newRewards: string[]; duplicate: boolean;
}

/** Validates the attempt, computes stars on the server, then updates attempt + progress + stars + rewards in ONE transaction. Idempotent. */
export function submitAttempt(db: Db, child: Row, activityId: string, attemptId: string, payload: { moves?: number; cells?: number }): SubmitResult {
  return tx(db, () => {
    const at = ownedAttempt(db, child, attemptId);
    if (at.activity_id !== activityId) throw new ApiError(400, "VALIDATION_ERROR", "Cette tentative ne correspond pas à l'activité.");
    if (at.status === "completed") return { ...(JSON.parse(at.result) as SubmitResult), duplicate: true, totalStars: totalStars(db, child.id) };
    if (at.status !== "started") throw new ApiError(409, "ATTEMPT_CLOSED", "Cette tentative n'est plus active.");
    assertUnlocked(db, child.id, at.level_id);

    const st = JSON.parse(at.state) as State;
    let stars: number, mistakes = 0;
    if (st.kind === "quiz") {
      if (st.solved.length !== st.questions.length) throw new ApiError(422, "INCOMPLETE", "Réponds d'abord à toutes les questions.");
      mistakes = at.mistakes; stars = starsFromMistakes(mistakes);
    } else if (st.kind === "memory") {
      const m = payload.moves;
      if (!Number.isInteger(m) || m! < st.pairs || m! > st.pairs * 12) throw new ApiError(422, "INVALID_RESULT", "Résultat impossible pour ce jeu.");
      stars = starsFromMoves(m!, st.pairs); mistakes = Math.max(0, m! - st.pairs);
    } else {
      const c = payload.cells;
      if (!Number.isInteger(c) || c! > st.grid * st.grid) throw new ApiError(422, "INVALID_RESULT", "Résultat impossible pour ce jeu.");
      if (c! < st.minCells) throw new ApiError(422, "INCOMPLETE", `Colorie au moins ${st.minCells} cases.`);
      stars = 3;
    }

    const ts = now(), day = today();
    const spent = Math.min(3600, Math.max(0, Math.round((Date.parse(ts) - Date.parse(at.started_at)) / 1000)));
    const claimed = db.prepare("UPDATE activity_attempts SET status='completed', stars=?, score=?, mistakes=?, completed_at=?, time_spent_s=? WHERE id=? AND status='started'").run(stars, stars, mistakes, ts, spent, attemptId);
    if (Number(claimed.changes) !== 1) throw new ApiError(409, "ATTEMPT_CLOSED", "Cette tentative est déjà terminée.");

    const lvl = db.prepare("SELECT * FROM levels WHERE id = ?").get(at.level_id)!;
    const prog = db.prepare("SELECT * FROM child_level_progress WHERE child_id = ? AND level_id = ?").get(child.id, at.level_id)!;
    const done = db.prepare("SELECT COUNT(DISTINCT activity_id) n FROM activity_attempts WHERE child_id=? AND level_id=? AND status='completed'").get(child.id, at.level_id)!.n as number;
    const levelDone = done >= (lvl.required_activities as number);
    const best = Math.max(prog.best_stars as number, stars);
    db.prepare("UPDATE child_level_progress SET best_stars=?, completed_activities=?, progress_pct=?, status=?, last_activity_at=?, completed_at=COALESCE(completed_at, ?) WHERE child_id=? AND level_id=?")
      .run(best, done, Math.min(100, Math.round((done / lvl.required_activities) * 100)), levelDone ? "completed" : "available", ts, levelDone ? ts : null, child.id, at.level_id);

    // Stars: only the improvement over the previous best is added (replaying never farms stars).
    const delta = Math.max(0, stars - (prog.best_stars as number));
    if (delta > 0) db.prepare("INSERT INTO star_ledger(child_id, amount, reason, level_id, attempt_id) VALUES (?,?,?,?,?)").run(child.id, delta, "level_best", at.level_id, attemptId);
    const bonus = Number(db.prepare("INSERT OR IGNORE INTO star_ledger(child_id, amount, reason, day, attempt_id) VALUES (?,?,?,?,?)").run(child.id, 1, "daily_bonus", day, attemptId).changes) === 1;

    let unlocked: number | null = null;
    if (levelDone) {
      const next = db.prepare("SELECT id FROM levels WHERE unlock_requires = ?").get(at.level_id);
      if (next) {
        const r = db.prepare("UPDATE child_level_progress SET unlocked=1, status='available' WHERE child_id=? AND level_id=? AND unlocked=0").run(child.id, next.id);
        if (Number(r.changes) === 1) unlocked = next.id as number;
      }
    }
    const newRewards = evaluateBadges(db, child.id);
    const result: SubmitResult = { attemptId, activityId, levelId: at.level_id, stars, deltaStars: delta + (bonus ? 1 : 0), dailyBonus: bonus, totalStars: totalStars(db, child.id), levelCompleted: levelDone, unlockedLevelId: unlocked, newRewards, duplicate: false };
    db.prepare("UPDATE activity_attempts SET result = ? WHERE id = ?").run(JSON.stringify(result), attemptId);
    return result;
  });
}

export const levelActivities = (db: Db, levelId: number, group?: AgeGroup) =>
  db.prepare(`SELECT * FROM activities WHERE level_id = ? ${group ? "AND age_group = ?" : ""} ORDER BY age_group, position`).all(...(group ? [levelId, group] : [levelId])).map(publicActivity);

/** Every activity of the child's age group with its state (for the "Activités" screen). */
export function activityList(db: Db, child: Row) {
  return db.prepare(
    `SELECT a.*, p.unlocked, p.status AS level_status,
            (SELECT MAX(stars) FROM activity_attempts t WHERE t.child_id = ? AND t.activity_id = a.id AND t.status = 'completed') AS best,
            (SELECT COUNT(*) FROM activity_attempts t WHERE t.child_id = ? AND t.activity_id = a.id AND t.status = 'completed') AS plays
     FROM activities a JOIN child_level_progress p ON p.level_id = a.level_id AND p.child_id = ?
     WHERE a.age_group = ? ORDER BY a.level_id, a.position`).all(child.id, child.id, child.id, child.age_group)
    .map((r) => ({ ...publicActivity(r), unlocked: r.unlocked === 1, completed: (r.plays as number) > 0, bestStars: (r.best as number | null) ?? 0, plays: r.plays as number }));
}
