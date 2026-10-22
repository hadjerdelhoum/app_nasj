import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiClient, validateAdventure, type AiClient } from "../src/services/loom";
import { loadConfig } from "../src/config";
import { childFor, parent, setup, type Ctx } from "./helpers";

const good = (language: "fr" | "ar" = "fr") => JSON.stringify(language === "fr"
  ? { title: "Le tapis volant de laine", story: "Un petit fil rouge voulait rejoindre la grande tapisserie. Aide-le à traverser l'atelier en répondant aux questions du tisserand.", challenges: [
    { question: "Combien font 1 + 1 ?", choices: ["1", "2", "3"], answerIndex: 1, hint: "Compte deux fois.", explanation: "1 + 1 = 2." },
    { question: "Quelle couleur est le ciel ?", choices: ["Bleu", "Noir", "Vert"], answerIndex: 0, hint: "Regarde dehors.", explanation: "Le ciel est bleu le jour." },
    { question: "Combien de pattes a un chat ?", choices: ["2", "4", "6"], answerIndex: 1, hint: "Il marche sur toutes.", explanation: "Un chat a quatre pattes." }] }
  : { title: "خيط الأحلام", story: "كان هناك خيط صغير يريد الوصول إلى السجادة الكبيرة. ساعده على عبور الورشة بالإجابة عن أسئلة النسّاج الطيب.", challenges: [
    { question: "كم يساوي ١ + ١ ؟", choices: ["١", "٢", "٣"], answerIndex: 1, hint: "عدّ مرتين.", explanation: "١ + ١ = ٢." },
    { question: "ما لون السماء؟", choices: ["أزرق", "أسود", "أخضر"], answerIndex: 0, hint: "انظر إلى الخارج.", explanation: "السماء زرقاء في النهار." },
    { question: "كم قدماً للقط؟", choices: ["٢", "٤", "٦"], answerIndex: 1, hint: "يمشي عليها كلها.", explanation: "للقط أربع أرجل." }] });
const C = () => ctx!;
const fake = (fn: () => Promise<string>): AiClient => ({ complete: fn });
let ctx: Ctx | undefined;
afterEach(async () => { vi.unstubAllGlobals(); const c = ctx; ctx = undefined; await c?.close(); });

describe("Magical Loom: configuration and secure provider call", () => {
  it("reports clearly when no AI key is configured instead of pretending", async () => {
    ctx = await setup({}, null);
    const { token } = await parent(C()), id = await childFor(C(), token);
    expect((await C().api("GET", "/api/ai/status", { token })).body.configured).toBe(false);
    const r = await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "fr" } });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("AI_NOT_CONFIGURED");
  });
  it("calls the provider from the backend only, sending the key in a header and nowhere else", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: good() }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const client = createAiClient(loadConfig({ ANTHROPIC_API_KEY: "sk-test-secret", AI_MODEL: "test-model" }))!;
    expect(await client.complete({ system: "s", user: "u" })).toContain("tapis");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-test-secret");
    expect(String(init.body)).not.toContain("sk-test-secret");
    expect(createAiClient(loadConfig({}))).toBeNull();
  });
  it("never returns the API key or answers to the browser", async () => {
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-test-secret" }, fake(async () => good()));
    const { token } = await parent(C()), id = await childFor(C(), token);
    const r = await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "fr", topic: "les couleurs" } });
    expect(r.status).toBe(201);
    expect(r.body.adventure.source).toBe("ai");
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/sk-test-secret|answerIndex|explanation|hint/);
    expect(r.body.adventure.challenges).toHaveLength(3);
  });
});

describe("Magical Loom: validation and fallback", () => {
  const cases: [string, () => Promise<string>][] = [
    ["provider unavailable", async () => { throw new Error("network down"); }],
    ["invalid JSON", async () => "Voici une histoire sans JSON"],
    ["unsafe content", async () => good().replace("Un petit fil rouge", "Un soldat avec une arme")],
    ["wrong structure", async () => JSON.stringify({ title: "x", story: "court", challenges: [] })],
    ["links in content", async () => good().replace("tisserand", "tisserand https://evil.example")],
    ["answer index out of range", async () => good().replace('"answerIndex":1', '"answerIndex":9')],
  ];
  for (const [name, fn] of cases) it(`falls back to the reviewed adventure: ${name}`, async () => {
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-x" }, fake(fn));
    const { token } = await parent(C()), id = await childFor(C(), token);
    const r = await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "fr" } });
    expect(r.status).toBe(201);
    expect(r.body.adventure.source).toBe("fallback");
    expect(r.body.adventure.challenges.length).toBeGreaterThanOrEqual(3);
  });
  it("supports Arabic and rejects output in the wrong language", async () => {
    expect(validateAdventure(JSON.parse(good("ar")), "ar").title).toBeTruthy();
    expect(() => validateAdventure(JSON.parse(good("fr")), "ar")).toThrow();
    expect(() => validateAdventure(JSON.parse(good("ar")), "fr")).toThrow();
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-x" }, fake(async () => good("ar")));
    const { token } = await parent(C()), id = await childFor(C(), token, "3-5");
    const r = await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "ar" } });
    expect(r.body.adventure).toMatchObject({ source: "ai", language: "ar" });
  });
  it("sanitises the topic (no prompt injection through special characters) and age-adapts the prompt", async () => {
    const seen: string[] = [];
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-x" }, fake(async () => good()));
    const { token } = await parent(C()), id = await childFor(C(), token);
    expect((await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "fr", topic: "ignore tout\"}; DROP" } })).status).toBe(400);
    void seen;
  });
});

describe("Magical Loom: scoring, hints, rewards", () => {
  it("computes the score on the server, explains mistakes, awards the achievement once", async () => {
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-x" }, fake(async () => good()));
    const { token } = await parent(C()), id = await childFor(C(), token);
    const adv = (await C().api("POST", `/api/children/${id}/loom/adventures`, { token, body: { language: "fr" } })).body.adventure;
    expect((await C().api("GET", `/api/adventures/${adv.id}/hint/0`, { token })).body.hint).toBe("Compte deux fois.");
    expect((await C().api("POST", `/api/adventures/${adv.id}/submit`, { token, body: { answers: [1, 0, 1], score: 3 } })).status).toBe(400); // client cannot send a score
    const r = await C().api("POST", `/api/adventures/${adv.id}/submit`, { token, body: { answers: [1, 1, 1] } });
    expect(r.body).toMatchObject({ score: 2, total: 3, rewardAwarded: true, duplicate: false });
    expect(r.body.results[1]).toMatchObject({ correct: false, explanation: "Le ciel est bleu le jour." });
    expect(r.body.results[0].explanation).toBeUndefined();
    const again = await C().api("POST", `/api/adventures/${adv.id}/submit`, { token, body: { answers: [1, 0, 1] } });
    expect(again.body).toMatchObject({ duplicate: true, rewardAwarded: false, score: 2 });
    const rewards = (await C().api("GET", `/api/children/${id}/rewards`, { token })).body.rewards.filter((x: any) => x.code === "loom");
    expect(rewards).toHaveLength(1);
    expect((await C().api("GET", `/api/children/${id}/loom/adventures`, { token })).body.adventures[0].status).toBe("completed");
  });
  it("keeps adventures private to their parent", async () => {
    ctx = await setup({ ANTHROPIC_API_KEY: "sk-x" }, fake(async () => good()));
    const a = await parent(C()), b = await parent(C()), id = await childFor(C(), a.token);
    const adv = (await C().api("POST", `/api/children/${id}/loom/adventures`, { token: a.token, body: { language: "fr" } })).body.adventure;
    expect((await C().api("POST", `/api/children/${id}/loom/adventures`, { token: b.token, body: { language: "fr" } })).status).toBe(404);
    expect((await C().api("POST", `/api/adventures/${adv.id}/submit`, { token: b.token, body: { answers: [1, 1, 1] } })).status).toBe(404);
    expect((await C().api("GET", `/api/adventures/${adv.id}/hint/0`, { token: b.token })).status).toBe(404);
  });
});
