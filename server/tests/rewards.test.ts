import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childFor, parent, playQuiz, setup, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => ctx.close());
const stars = async (token: string, id: string) => (await ctx.api("GET", `/api/children/${id}/stars`, { token })).body;

describe("stars and rewards", () => {
  it("awards stars computed by the server (+1 daily bonus) and badges", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    const r = (await (await playQuiz(ctx, token, id, "l1-vocab-5-10", 2)).submit!()).body; // 2 wrong answers -> 2 stars
    expect(r).toMatchObject({ stars: 2, dailyBonus: true, deltaStars: 3, totalStars: 3 });
    expect(r.newRewards).toEqual(expect.arrayContaining(["first", "reader"]));
    expect((await stars(token, id)).totalStars).toBe(3);
    expect((await ctx.api("GET", `/api/children/${id}/rewards`, { token })).body.rewards.map((x: any) => x.code)).toEqual(expect.arrayContaining(["first", "reader"]));
  });
  it("is idempotent: submitting the same attempt twice (or in parallel) never duplicates stars or rewards", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    const play = await playQuiz(ctx, token, id, "l1-vocab-5-10");
    const [a, b] = await Promise.all([play.submit!(), play.submit!()]);
    expect([a.status, b.status].filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    const again = await play.submit!();
    expect(again.body.duplicate).toBe(true);
    expect((await stars(token, id)).totalStars).toBe(4); // 3 + daily bonus, once
    const rewards = (await ctx.api("GET", `/api/children/${id}/rewards`, { token })).body.rewards;
    expect(new Set(rewards.map((r: any) => r.code)).size).toBe(rewards.length);
    expect(ctx.db.prepare("SELECT COUNT(*) n FROM star_ledger WHERE child_id = ?").get(id)!.n).toBe(2);
  });
  it("replaying only adds the improvement and gives the daily bonus once a day", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    expect((await (await playQuiz(ctx, token, id, "l1-vocab-5-10", 4)).submit!()).body).toMatchObject({ stars: 1, deltaStars: 2, totalStars: 2 }); // 1 star + bonus
    const worse = (await (await playQuiz(ctx, token, id, "l1-vocab-5-10", 5)).submit!()).body;
    expect(worse).toMatchObject({ stars: 1, deltaStars: 0, dailyBonus: false, totalStars: 2 });
    const better = (await (await playQuiz(ctx, token, id, "l1-vocab-5-10", 0)).submit!()).body;
    expect(better).toMatchObject({ stars: 3, deltaStars: 2, totalStars: 4 });
    expect((await ctx.api("GET", `/api/children/${id}/levels/1`, { token })).body.level.bestStars).toBe(3);
    expect((await ctx.api("GET", `/api/children/${id}/history`, { token })).body.history).toHaveLength(3); // history keeps every attempt
  });
  it("rejects manipulated star counts and reward requests from the client", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    const play = await playQuiz(ctx, token, id, "l1-vocab-5-10", 5);
    for (const body of [{ attemptId: play.attemptId, stars: 999 }, { attemptId: play.attemptId, totalStars: 999 }, { attemptId: play.attemptId, rewards: ["loom"] }, { attemptId: play.attemptId, score: 100 }])
      expect((await ctx.api("POST", "/api/activities/l1-vocab-5-10/submit", { token, body })).status).toBe(400);
    expect((await stars(token, id)).totalStars).toBe(0);
    expect((await play.submit!()).body.stars).toBe(1); // real result: 5 mistakes -> 1 star
    for (const [m, p] of [["POST", `/api/children/${id}/stars`], ["PUT", `/api/children/${id}/stars`], ["POST", `/api/children/${id}/rewards`], ["PATCH", `/api/children/${id}/progress`]] as const)
      expect([404, 405].includes((await ctx.api(m, p, { token, body: { totalStars: 99 } })).status), `${m} ${p}`).toBe(true);
    expect((await stars(token, id)).totalStars).toBe(2);
  });
  it("keeps the reward and star history", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    await (await playQuiz(ctx, token, id, "l1-vocab-5-10")).submit!();
    await (await playQuiz(ctx, token, id, "l2-math-5-10")).submit!();
    const s = await stars(token, id);
    expect(s.ledger.map((l: any) => l.reason)).toEqual(["level_best", "daily_bonus", "level_best"]);
    expect(s.totalStars).toBe(7);
    const rewards = (await ctx.api("GET", `/api/children/${id}/rewards`, { token })).body.rewards;
    expect(rewards.every((r: any) => r.achievedAt && r.name)).toBe(true);
    expect(rewards.map((r: any) => r.code)).toEqual(expect.arrayContaining(["first", "reader", "math"]));
    expect(rewards.map((r: any) => r.code)).not.toContain("stars10"); // only 7 stars so far
  });
  it("awards the explorer badge from saved preferences", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    await ctx.api("PATCH", `/api/children/${id}`, { token, body: { preferences: { explored: ["langues", "maths", "logique"] } } });
    expect((await ctx.api("GET", `/api/children/${id}/rewards`, { token })).body.rewards.map((r: any) => r.code)).toContain("explorer");
  });
});
