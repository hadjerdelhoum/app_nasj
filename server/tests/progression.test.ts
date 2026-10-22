import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childFor, parent, playQuiz, setup, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => ctx.close());
const levels = async (token: string, id: string) => (await ctx.api("GET", `/api/children/${id}/levels`, { token })).body.levels as any[];

describe("level progression (enforced by the server)", () => {
  it("starts with level 1 only and rejects direct requests to locked levels", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    expect((await levels(token, id)).map((l) => [l.status, l.unlocked])).toEqual([["available", true], ["locked", false], ["locked", false], ["locked", false], ["locked", false]]);
    for (const a of ["l2-math-5-10", "l3-memory-5-10", "l5-discover-5-10"]) {
      const r = await ctx.api("POST", `/api/children/${id}/activities/${a}/start`, { token });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("LEVEL_LOCKED");
    }
  });
  it("never exposes answers or pools in public activity data", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    const pub = JSON.stringify([(await ctx.api("GET", "/api/levels/1/activities", { token })).body, (await ctx.api("GET", "/api/activities/l1-vocab-5-10", { token })).body, (await ctx.api("GET", `/api/children/${id}/levels/1`, { token })).body]);
    expect(pub).not.toMatch(/"answer"|pool|"content"/);
    const s = await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-5-10/start`, { token });
    expect(JSON.stringify(s.body)).not.toMatch(/"answer"/);
    expect(s.body.questions).toHaveLength(5);
  });
  it("rejects an activity from the wrong age group and incomplete or impossible submissions", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token, "5-10");
    expect((await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-3-5/start`, { token })).body.error.code).toBe("ACTIVITY_NOT_FOR_GROUP");
    const s = await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-5-10/start`, { token });
    const early = await ctx.api("POST", "/api/activities/l1-vocab-5-10/submit", { token, body: { attemptId: s.body.attemptId } });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe("INCOMPLETE");
    expect((await ctx.api("POST", "/api/activities/l2-math-5-10/submit", { token, body: { attemptId: s.body.attemptId } })).status).toBe(400); // attempt belongs to another activity
    expect((await levels(token, id))[0].status).toBe("in_progress");
  });
  it("completing the required activity updates progress and unlocks the next level; progress survives a new session", async () => {
    const { token, email } = await parent(ctx);
    const id = await childFor(ctx, token);
    const r = await (await playQuiz(ctx, token, id, "l1-vocab-5-10")).submit!();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ stars: 3, levelCompleted: true, unlockedLevelId: 2, duplicate: false });
    const ls = await levels(token, id);
    expect(ls[0]).toMatchObject({ status: "completed", bestStars: 3, completedActivities: 1, progressPct: 100 });
    expect(ls[1]).toMatchObject({ status: "available", unlocked: true });
    expect(ls[2].status).toBe("locked");
    // brand-new session (logout/login, "new device")
    await ctx.api("POST", "/api/auth/logout", { token });
    const t2 = (await ctx.api("POST", "/api/auth/login", { body: { email, password: "correct horse 42" } })).body.token;
    const after = await levels(t2, id);
    expect(after.map((l) => l.status)).toEqual(["completed", "available", "locked", "locked", "locked"]);
    expect((await ctx.api("GET", `/api/children/${id}/progress/summary`, { token: t2 })).body).toMatchObject({ completedLevels: 1, currentLevelId: 2 });
    expect((await ctx.api("GET", `/api/children/${id}/history`, { token: t2 })).body.history[0]).toMatchObject({ activityId: "l1-vocab-5-10", status: "completed", stars: 3, attemptNumber: 1 });
  });
  it("plays the whole journey for both age groups (quiz, memory, painting, discovery)", async () => {
    for (const group of ["3-5", "5-10"] as const) {
      const { token } = await parent(ctx);
      const id = await childFor(ctx, token, group);
      expect((await (await playQuiz(ctx, token, id, `l1-vocab-${group}`)).submit!()).body.levelCompleted).toBe(true);
      expect((await (await playQuiz(ctx, token, id, `l2-math-${group}`)).submit!()).body.unlockedLevelId).toBe(3);
      const m = await ctx.api("POST", `/api/children/${id}/activities/l3-memory-${group}/start`, { token });
      const pairs = m.body.config.pairs;
      expect(pairs).toBe(group === "3-5" ? 3 : 6);
      expect((await ctx.api("POST", `/api/activities/l3-memory-${group}/submit`, { token, body: { attemptId: m.body.attemptId, moves: pairs - 1 } })).status).toBe(422); // impossible
      expect((await ctx.api("POST", `/api/activities/l3-memory-${group}/submit`, { token, body: { attemptId: m.body.attemptId, moves: pairs + 2 } })).body.stars).toBe(3);
      const p = await ctx.api("POST", `/api/children/${id}/activities/l4-paint-${group}/start`, { token });
      expect((await ctx.api("POST", `/api/activities/l4-paint-${group}/submit`, { token, body: { attemptId: p.body.attemptId, cells: 3 } })).status).toBe(422); // too few cells
      expect((await ctx.api("POST", `/api/activities/l4-paint-${group}/submit`, { token, body: { attemptId: p.body.attemptId, cells: 999 } })).status).toBe(422);
      expect((await ctx.api("POST", `/api/activities/l4-paint-${group}/submit`, { token, body: { attemptId: p.body.attemptId, cells: 20 } })).body.unlockedLevelId).toBe(5);
      expect((await (await playQuiz(ctx, token, id, `l5-discover-${group}`, 2)).submit!()).body).toMatchObject({ levelCompleted: true, stars: 2, unlockedLevelId: null });
      const sum = (await ctx.api("GET", `/api/children/${id}/progress/summary`, { token })).body;
      expect(sum.completedLevels).toBe(5);
      const rewards = (await ctx.api("GET", `/api/children/${id}/rewards`, { token })).body.rewards.map((r: any) => r.code);
      expect(rewards).toEqual(expect.arrayContaining(["first", "reader", "math", "memory", "artist", "scientist", "stars10"]));
    }
  });
  it("counts wrong answers once per option and ignores answers on closed attempts", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    const s = await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-5-10/start`, { token });
    const st = JSON.parse(ctx.db.prepare("SELECT state FROM activity_attempts WHERE id = ?").get(s.body.attemptId)!.state);
    const q = st.questions[0], bad = q.options.find((o: any) => o.id !== q.answer).id;
    for (let i = 0; i < 4; i++) await ctx.api("POST", `/api/attempts/${s.body.attemptId}/answer`, { token, body: { questionId: q.id, optionId: bad } });
    expect(ctx.db.prepare("SELECT mistakes FROM activity_attempts WHERE id = ?").get(s.body.attemptId)!.mistakes).toBe(1);
    expect((await ctx.api("POST", `/api/attempts/${s.body.attemptId}/answer`, { token, body: { questionId: "zz", optionId: bad } })).status).toBe(400);
    await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-5-10/start`, { token }); // a new start abandons the old attempt
    expect((await ctx.api("POST", `/api/attempts/${s.body.attemptId}/answer`, { token, body: { questionId: q.id, optionId: q.answer } })).status).toBe(409);
  });
  it("lets only the owner use an attempt", async () => {
    const a = await parent(ctx), b = await parent(ctx);
    const id = await childFor(ctx, a.token);
    const s = await ctx.api("POST", `/api/children/${id}/activities/l1-vocab-5-10/start`, { token: a.token });
    expect((await ctx.api("POST", `/api/attempts/${s.body.attemptId}/answer`, { token: b.token, body: { questionId: "q1", optionId: "chat" } })).status).toBe(404);
    expect((await ctx.api("POST", "/api/activities/l1-vocab-5-10/submit", { token: b.token, body: { attemptId: s.body.attemptId } })).status).toBe(404);
  });
});
