import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childFor, parent, playQuiz, setup, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(() => ctx.close());

describe("child profiles", () => {
  it("creates and retrieves a profile with its learning path and level 1 available", async () => {
    const { token } = await parent(ctx);
    const c = await ctx.api("POST", "/api/children", { token, body: { displayName: "Lina", ageGroup: "5-10" } });
    expect(c.status).toBe(201);
    expect(c.body.child).toMatchObject({ displayName: "Lina", ageGroup: "5-10", learningPathId: "grands-explorateurs" });
    const g = await ctx.api("GET", `/api/children/${c.body.child.id}`, { token });
    expect(g.body.child.id).toBe(c.body.child.id);
    expect((await ctx.api("GET", "/api/children", { token })).body.children).toHaveLength(1);
    const lp = await ctx.api("GET", `/api/children/${c.body.child.id}/learning-path`, { token });
    expect(lp.body.path.ageGroup).toBe("5-10");
    expect(lp.body.levels.map((l: any) => l.status)).toEqual(["available", "locked", "locked", "locked", "locked"]);
  });
  it("validates input and collects nothing unnecessary", async () => {
    const { token } = await parent(ctx);
    for (const body of [{ displayName: "", ageGroup: "3-5" }, { displayName: "<script>", ageGroup: "3-5" }, { displayName: "Ok", ageGroup: "11-12" }, { displayName: "Ok" }, { displayName: "Ok", ageGroup: "3-5", lastName: "Dupont", address: "x" }])
      expect((await ctx.api("POST", "/api/children", { token, body })).status).toBe(400);
  });
  it("applies the documented age-5 rule and rejects conflicts instead of silently reassigning", async () => {
    const { token } = await parent(ctx);
    const five = await ctx.api("POST", "/api/children", { token, body: { displayName: "Cinq", age: 5 } });
    expect(five.body.child.ageGroup).toBe("3-5"); // default AGE_FIVE_GROUP
    const explicit = await ctx.api("POST", "/api/children", { token, body: { displayName: "Cinq2", age: 5, ageGroup: "5-10" } });
    expect(explicit.body.child.ageGroup).toBe("5-10"); // 5 is compatible with both: the explicit choice wins
    expect((await ctx.api("POST", "/api/children", { token, body: { displayName: "Neuf", age: 9 } })).body.child.ageGroup).toBe("5-10");
    expect((await ctx.api("POST", "/api/children", { token, body: { displayName: "Quatre", age: 4 } })).body.child.ageGroup).toBe("3-5");
    const bad = await ctx.api("POST", "/api/children", { token, body: { displayName: "Bad", age: 8, ageGroup: "3-5" } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("AGE_GROUP_MISMATCH");
    const other = await setup({ AGE_FIVE_GROUP: "5-10" });
    const t2 = (await parent(other)).token;
    expect((await other.api("POST", "/api/children", { token: t2, body: { displayName: "Cinq", age: 5 } })).body.child.ageGroup).toBe("5-10"); // configurable
    await other.close();
  });
  it("changing the age group keeps all progress, stars and rewards", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token, "5-10");
    const play = await playQuiz(ctx, token, id, "l1-vocab-5-10");
    expect((await play.submit!()).status).toBe(200);
    const before = (await ctx.api("GET", `/api/children/${id}/progress`, { token })).body;
    const p = await ctx.api("PATCH", `/api/children/${id}`, { token, body: { ageGroup: "3-5" } });
    expect(p.status).toBe(200);
    expect(p.body.child).toMatchObject({ ageGroup: "3-5", learningPathId: "petits-explorateurs" });
    const after = (await ctx.api("GET", `/api/children/${id}/progress`, { token })).body;
    expect(after.levels).toEqual(before.levels);
    expect(after.summary.totalStars).toBe(before.summary.totalStars);
    expect(after.rewards).toEqual(before.rewards);
    expect(after.levels[0].status).toBe("completed");
  });
  it("stores only whitelisted preferences", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    expect((await ctx.api("PATCH", `/api/children/${id}`, { token, body: { preferences: { explored: ["langues", "maths"] } } })).body.child.preferences.explored).toEqual(["langues", "maths"]);
    expect((await ctx.api("PATCH", `/api/children/${id}`, { token, body: { preferences: { secret: "x" } } })).status).toBe(400);
    expect((await ctx.api("PATCH", `/api/children/${id}`, { token, body: { stars: 999 } })).status).toBe(400); // children cannot edit stars through the profile
  });
  it("prevents another parent from reading, changing or deleting a profile", async () => {
    const a = await parent(ctx), b = await parent(ctx);
    const id = await childFor(ctx, a.token);
    for (const [m, p, body] of [["GET", `/api/children/${id}`], ["PATCH", `/api/children/${id}`, { displayName: "Hack" }], ["DELETE", `/api/children/${id}`], ["GET", `/api/children/${id}/progress`], ["GET", `/api/children/${id}/rewards`], ["GET", `/api/children/${id}/history`], ["POST", `/api/children/${id}/activities/l1-vocab-5-10/start`]] as const)
      expect((await ctx.api(m, p, { token: b.token, body })).status, `${m} ${p}`).toBe(404);
    expect((await ctx.api("GET", "/api/children", { token: b.token })).body.children).toHaveLength(0);
    expect((await ctx.api("GET", `/api/children/${id}`, { token: a.token })).body.child.displayName).toBe("Lina"); // untouched
  });
  it("deleting a profile erases all of its data", async () => {
    const { token } = await parent(ctx);
    const id = await childFor(ctx, token);
    await (await playQuiz(ctx, token, id, "l1-vocab-5-10")).submit!();
    expect((await ctx.api("DELETE", `/api/children/${id}`, { token })).status).toBe(204);
    for (const t of ["child_level_progress", "activity_attempts", "star_ledger", "rewards"])
      expect(ctx.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE child_id = ?`).get(id)!.n, t).toBe(0);
  });
});
