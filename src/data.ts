import {
  Apple, Bike, BookOpen, Bird, Calculator, Car, Cat, Compass, Dog, Fish, Flower2, Heart, Home,
  Languages, Moon, Palette, Puzzle, Rocket, Sparkles, Star, Sun, Telescope, TreePine, Trophy, Brain, Wand2,
} from "lucide-react";
import type { AgeGroup, Badge, Band, Category, Level, Option, Profile, Progress, Question } from "./types";

/** Internal rule: the age 5 belongs to BOTH public ranges, so the child chooses the range. Legacy single ages <= 5 map to "3-5". */
export const groupFromAge = (age: number): AgeGroup => (age <= 5 ? "3-5" : "5-10");
export const groupOf = (p: Profile | null): AgeGroup => p?.group ?? "5-10";
export const GROUPS: Record<AgeGroup, { label: string; title: string; desc: string }> = {
  "3-5": { label: "3–5 ans", title: "Petits explorateurs", desc: "Activités faciles, vocabulaire de base, couleurs, formes, comptage et jeux de mémoire simples." },
  "5-10": { label: "5–10 ans", title: "Grands explorateurs", desc: "Lecture, orthographe, mathématiques, logique, sciences et défis plus avancés." },
};
/** Difficulty band used by the games: 3–5 is always gentle; 5–10 gets harder level after level. */
export const bandFor = (g: AgeGroup, levelId: number): Band => (g === "3-5" ? "easy" : levelId >= 3 ? "hard" : "medium");
export const difficultyOf = (g: AgeGroup, levelId: number): 1 | 2 | 3 => (g === "3-5" ? (levelId <= 2 ? 1 : 2) : levelId <= 2 ? 2 : 3);
export const difficultyLabel = ["", "Facile", "Moyen", "Défi"] as const;

export const CATEGORIES: Category[] = [
  { id: "langues", title: "Langues", desc: "Arabe & français", topics: ["Vocabulaire", "Lettres", "Lecture", "Orthographe"], icon: Languages, card: "bg-teal-soft", chip: "bg-teal text-white", level: 1 },
  { id: "maths", title: "Mathématiques", desc: "Nombres & calculs", topics: ["Nombres", "Calculs", "Formes", "Suites"], icon: Calculator, card: "bg-sun-soft", chip: "bg-sun text-white", level: 2 },
  { id: "logique", title: "Logique", desc: "Jeux & mémoire", topics: ["Mémoire", "Puzzles", "Suites logiques", "Problèmes"], icon: Puzzle, card: "bg-grape-soft", chip: "bg-grape text-white", level: 3 },
  { id: "creativite", title: "Créativité", desc: "Couleurs & tissage", topics: ["Dessin", "Couleurs", "Tissage", "Motifs"], icon: Palette, card: "bg-coral-soft", chip: "bg-coral text-white", level: 4 },
  { id: "decouverte", title: "Découverte", desc: "Nature & monde", topics: ["Sciences", "Nature", "Animaux", "Espace"], icon: Telescope, card: "bg-sky-soft", chip: "bg-[#4fa9d8] text-white", level: 5 },
];

export const LEVELS: Level[] = [
  { id: 1, title: "Niveau 1", sub: "Je découvre", kind: "vocab", category: "langues", icon: BookOpen, desc: "Je découvre mes premiers mots en arabe et en français, en associant chaque mot à son image.", activity: "Vocabulaire · 5 questions en images" },
  { id: 2, title: "Niveau 2", sub: "J'apprends", kind: "math", category: "maths", icon: Calculator, desc: "J'apprends à compter et à calculer avec des nombres, pas à pas.", activity: "Mathématiques · 5 calculs à choisir" },
  { id: 3, title: "Niveau 3", sub: "Je relève des défis", kind: "memory", category: "logique", icon: Brain, desc: "Je muscle ma mémoire en retrouvant les paires cachées.", activity: "Mémoire · retrouver les paires" },
  { id: 4, title: "Niveau 4", sub: "Je crée", kind: "paint", category: "creativite", icon: Palette, desc: "Je tisse mon propre motif en mélangeant les couleurs des fils.", activity: "Créativité · tissage en couleurs" },
  { id: 5, title: "Niveau 5", sub: "Je m'émerveille", kind: "discover", category: "decouverte", icon: Telescope, desc: "Je découvre la nature, les animaux et le ciel en répondant à des devinettes.", activity: "Découverte · 5 devinettes illustrées" },
];

export const BADGES: Badge[] = [
  { id: "first", title: "Premier fil", desc: "Termine une activité", icon: Sparkles, tone: "bg-sun" },
  { id: "reader", title: "Petit lecteur", desc: "Réussis le niveau 1", icon: BookOpen, tone: "bg-teal" },
  { id: "math", title: "Compte-étoiles", desc: "Réussis le niveau 2", icon: Calculator, tone: "bg-coral" },
  { id: "memory", title: "Mémoire de fil", desc: "Réussis le niveau 3", icon: Brain, tone: "bg-grape" },
  { id: "artist", title: "Artiste tisseur", desc: "Réussis le niveau 4", icon: Wand2, tone: "bg-coral" },
  { id: "scientist", title: "Curieux du monde", desc: "Réussis le niveau 5", icon: Compass, tone: "bg-[#4fa9d8]" },
  { id: "explorer", title: "Explorateur", desc: "Découvre 3 univers", icon: Telescope, tone: "bg-teal" },
  { id: "stars10", title: "Ramasse-étoiles", desc: "Récolte 10 étoiles", icon: Trophy, tone: "bg-sun" },
];

export const totalStars = (p: Progress) => Object.values(p.levelStars).reduce((a, b) => a + b, 0) + p.bonus;
export const isUnlocked = (p: Progress, id: number) => (p.unlocked ? p.unlocked.includes(id) : id === 1 || p.levelStars[id - 1] !== undefined);
export const currentLevel = (p: Progress) => LEVELS.find((l) => p.levelStars[l.id] === undefined)?.id ?? LEVELS[LEVELS.length - 1].id;
export const todayKey = () => new Date().toISOString().slice(0, 10);

export function earnedBadges(p: Progress): string[] {
  const done = Object.keys(p.levelStars).map(Number);
  const ids: string[] = [];
  if (done.length) ids.push("first");
  if (done.includes(1)) ids.push("reader");
  if (done.includes(2)) ids.push("math");
  if (done.includes(3)) ids.push("memory");
  if (done.includes(4)) ids.push("artist");
  if (done.includes(5)) ids.push("scientist");
  if (p.explored.length >= 3) ids.push("explorer");
  if (totalStars(p) >= 10) ids.push("stars10");
  return ids;
}

/* ---------- Vocabulary & discovery content ---------- */
const TONES = ["bg-teal-soft text-teal-dark", "bg-coral-soft text-coral", "bg-sun-soft text-sun", "bg-grape-soft text-grape", "bg-sky-soft text-[#3b8fc0]"];
export const VOCAB = [
  { id: "chat", fr: "chat", ar: "قطة", icon: Cat }, { id: "chien", fr: "chien", ar: "كلب", icon: Dog },
  { id: "poisson", fr: "poisson", ar: "سمكة", icon: Fish }, { id: "pomme", fr: "pomme", ar: "تفاحة", icon: Apple },
  { id: "soleil", fr: "soleil", ar: "شمس", icon: Sun }, { id: "lune", fr: "lune", ar: "قمر", icon: Moon },
  { id: "oiseau", fr: "oiseau", ar: "عصفور", icon: Bird }, { id: "fleur", fr: "fleur", ar: "وردة", icon: Flower2 },
  { id: "arbre", fr: "arbre", ar: "شجرة", icon: TreePine }, { id: "maison", fr: "maison", ar: "بيت", icon: Home },
  { id: "voiture", fr: "voiture", ar: "سيارة", icon: Car }, { id: "livre", fr: "livre", ar: "كتاب", icon: BookOpen },
  { id: "velo", fr: "vélo", ar: "دراجة", icon: Bike }, { id: "coeur", fr: "cœur", ar: "قلب", icon: Heart },
];
export const MEMORY_ICONS = [Cat, Fish, Apple, Sun, Moon, Flower2, Bird, Heart, Rocket, Star].map((icon, i) => ({ id: `m${i}`, icon, tone: TONES[i % 5] }));

const DISCOVER = [
  { q: "Qui brille dans le ciel la nuit ?", a: "lune" }, { q: "Qui nous donne la lumière le jour ?", a: "soleil" },
  { q: "Qui miaule ?", a: "chat" }, { q: "Qui pousse dans le jardin ?", a: "fleur" },
  { q: "Qui nage dans l'eau ?", a: "poisson" }, { q: "Qui vole dans le ciel ?", a: "oiseau" },
  { q: "Qui aboie ?", a: "chien" }, { q: "Qui est un fruit ?", a: "pomme" },
];

export const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const vopt = (id: string, i: number): Option => { const v = VOCAB.find((x) => x.id === id)!; return { id, label: v.fr, icon: v.icon, tone: TONES[i % 5] }; };

export function makeVocab(band: Band): Question[] {
  const pool = VOCAB.slice(0, band === "easy" ? 6 : band === "medium" ? 12 : 14);
  return shuffle(pool).slice(0, 5).map((t) => {
    const others = shuffle(pool.filter((p) => p.id !== t.id)).slice(0, 2);
    const options = shuffle([t, ...others]).map((o, i) => vopt(o.id, i));
    return band === "hard"
      ? { prompt: t.ar, sub: "Trouve l'image qui correspond", options, answer: t.id }
      : { prompt: `Trouve : « ${t.fr} »`, sub: t.ar, options, answer: t.id };
  });
}
export function makeDiscover(): Question[] {
  return shuffle(DISCOVER).slice(0, 5).map((d) => {
    const others = shuffle(VOCAB.filter((p) => p.id !== d.a && DISCOVER.some((x) => x.a === p.id))).slice(0, 2);
    return { prompt: d.q, sub: "Touche la bonne image", options: shuffle([d.a, ...others.map((o) => o.id)]).map(vopt), answer: d.a };
  });
}
export function makeMath(band: Band): Question[] {
  // 3–5 group (easy band): counting stars + tiny additions, 3 answer buttons.
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  return Array.from({ length: 5 }, () => {
    let text: string, ans: number;
    if (band === "easy") {
      if (Math.random() < .6) { ans = r(1, 6); const stars = Array(ans).fill("★").join(" "); const set = new Set<number>([ans]); while (set.size < 3) set.add(r(1, 7)); return { prompt: stars, sub: "Combien d'étoiles ?", options: shuffle([...set]).map((n) => ({ id: String(n), label: String(n) })), answer: String(ans) }; }
      const a = r(1, 4), b = r(1, 3); text = `${a} + ${b}`; ans = a + b;
    }
    else if (band === "medium") { const k = r(0, 2); if (k === 0) { const a = r(5, 12), b = r(3, 9); text = `${a} + ${b}`; ans = a + b; } else if (k === 1) { const a = r(10, 20), b = r(2, 9); text = `${a} − ${b}`; ans = a - b; } else { const a = r(2, 5), b = r(2, 5); text = `${a} × ${b}`; ans = a * b; } }
    else { const k = r(0, 2); if (k === 0) { const a = r(3, 9), b = r(3, 9); text = `${a} × ${b}`; ans = a * b; } else if (k === 1) { const a = r(15, 45), b = r(10, 30); text = `${a} + ${b}`; ans = a + b; } else { const a = r(30, 60), b = r(5, 25); text = `${a} − ${b}`; ans = a - b; } }
    const set = new Set<number>([ans]);
    for (const d of shuffle([1, 2, 3, 10, -1, -2, -3])) { if (set.size >= 4) break; if (ans + d > 0) set.add(ans + d); }
    return { prompt: `${text} = ?`, sub: "Choisis la bonne réponse", options: shuffle([...set]).map((n) => ({ id: String(n), label: String(n) })), answer: String(ans) };
  });
}

/** Remote mode: turns the server's public questions (no answers) into the shape the Quiz component renders. */
export function fromServerQuestions(qs: { id: string; prompt: string; sub?: string; options: { id: string; label: string; icon?: string }[] }[]): Question[] {
  return qs.map((q) => ({
    id: q.id, prompt: q.prompt, sub: q.sub,
    options: q.options.map((o, i) => { const v = o.icon ? VOCAB.find((x) => x.id === o.icon) : undefined; return { id: o.id, label: o.label, icon: v?.icon, tone: v ? TONES[i % 5] : undefined }; }),
  }));
}
