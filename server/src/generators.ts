import { DISCOVER, VOCAB } from "./catalog";

export interface QOption { id: string; label: string; icon?: string }
export interface Question { id: string; prompt: string; sub?: string; options: QOption[]; answer: string }

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
const vopt = (id: string): QOption => { const v = VOCAB.find((x) => x.id === id)!; return { id, label: v.fr, icon: id }; };

export function makeVocab(poolSize: number, count: number, choices = 3): Question[] {
  const pool = VOCAB.slice(0, poolSize);
  return shuffle(pool).slice(0, count).map((t, i) => ({
    id: `q${i + 1}`, prompt: poolSize <= 6 ? `Trouve : « ${t.fr} »` : `Trouve : « ${t.fr} »`, sub: t.ar, answer: t.id,
    options: shuffle([t, ...shuffle(pool.filter((p) => p.id !== t.id)).slice(0, choices - 1)]).map((o) => vopt(o.id)),
  }));
}
export function makeDiscover(count: number, choices = 3): Question[] {
  const known = new Set(DISCOVER.map((d) => d.a));
  return shuffle(DISCOVER).slice(0, count).map((d, i) => ({
    id: `q${i + 1}`, prompt: d.q, sub: "Touche la bonne image", answer: d.a,
    options: shuffle([d.a, ...shuffle(VOCAB.filter((v) => v.id !== d.a && known.has(v.id))).slice(0, choices - 1).map((v) => v.id)]).map(vopt),
  }));
}
export function makeMath(band: "easy" | "medium" | "hard", count: number): Question[] {
  return Array.from({ length: count }, (_, i) => {
    let prompt: string, sub = "Choisis la bonne réponse", ans: number, n = 4;
    if (band === "easy") {
      n = 3;
      if (Math.random() < 0.6) { ans = rnd(1, 6); prompt = Array(ans).fill("★").join(" "); sub = "Combien d'étoiles ?"; }
      else { const a = rnd(1, 4), b = rnd(1, 3); prompt = `${a} + ${b} = ?`; ans = a + b; }
    } else if (band === "medium") {
      const k = rnd(0, 2);
      if (k === 0) { const a = rnd(5, 12), b = rnd(3, 9); prompt = `${a} + ${b} = ?`; ans = a + b; }
      else if (k === 1) { const a = rnd(10, 20), b = rnd(2, 9); prompt = `${a} − ${b} = ?`; ans = a - b; }
      else { const a = rnd(2, 5), b = rnd(2, 5); prompt = `${a} × ${b} = ?`; ans = a * b; }
    } else {
      const k = rnd(0, 2);
      if (k === 0) { const a = rnd(3, 9), b = rnd(3, 9); prompt = `${a} × ${b} = ?`; ans = a * b; }
      else if (k === 1) { const a = rnd(15, 45), b = rnd(10, 30); prompt = `${a} + ${b} = ?`; ans = a + b; }
      else { const a = rnd(30, 60), b = rnd(5, 25); prompt = `${a} − ${b} = ?`; ans = a - b; }
    }
    const set = new Set<number>([ans]);
    for (const d of shuffle([1, 2, 3, 10, -1, -2, -3, 4, -4])) { if (set.size >= n) break; if (ans + d > 0) set.add(ans + d); }
    return { id: `q${i + 1}`, prompt, sub, answer: String(ans), options: shuffle([...set]).map((v) => ({ id: String(v), label: String(v) })) };
  });
}
