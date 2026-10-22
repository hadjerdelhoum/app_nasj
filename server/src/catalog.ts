import type { AgeGroup } from "./config";

export const AGE_GROUPS: AgeGroup[] = ["3-5", "5-10"];

export const PATHS = [
  { id: "petits-explorateurs", age_group: "3-5" as AgeGroup, title: "Petits explorateurs", description: "Activités faciles, vocabulaire de base, couleurs, formes, comptage et jeux de mémoire simples." },
  { id: "grands-explorateurs", age_group: "5-10" as AgeGroup, title: "Grands explorateurs", description: "Lecture, orthographe, mathématiques, logique, sciences et défis plus avancés." },
];

export const LEVELS = [
  { id: 1, code: "decouvre", title: "Niveau 1", subtitle: "Je découvre", category: "langues", difficulty: 1, description: "Je découvre mes premiers mots en arabe et en français, en associant chaque mot à son image." },
  { id: 2, code: "apprends", title: "Niveau 2", subtitle: "J'apprends", category: "maths", difficulty: 2, description: "J'apprends à compter et à calculer avec des nombres, pas à pas." },
  { id: 3, code: "defis", title: "Niveau 3", subtitle: "Je relève des défis", category: "logique", difficulty: 2, description: "Je muscle ma mémoire en retrouvant les paires cachées." },
  { id: 4, code: "cree", title: "Niveau 4", subtitle: "Je crée", category: "creativite", difficulty: 2, description: "Je tisse mon propre motif en mélangeant les couleurs des fils." },
  { id: 5, code: "emerveille", title: "Niveau 5", subtitle: "Je m'émerveille", category: "decouverte", difficulty: 3, description: "Je découvre la nature, les animaux et le ciel en répondant à des devinettes." },
];

export const BADGES: Record<string, { name: string; description: string; levelId?: number }> = {
  first: { name: "Premier fil", description: "Termine une activité" },
  reader: { name: "Petit lecteur", description: "Réussis le niveau 1", levelId: 1 },
  math: { name: "Compte-étoiles", description: "Réussis le niveau 2", levelId: 2 },
  memory: { name: "Mémoire de fil", description: "Réussis le niveau 3", levelId: 3 },
  artist: { name: "Artiste tisseur", description: "Réussis le niveau 4", levelId: 4 },
  scientist: { name: "Curieux du monde", description: "Réussis le niveau 5", levelId: 5 },
  explorer: { name: "Explorateur", description: "Découvre 3 univers" },
  stars10: { name: "Ramasse-étoiles", description: "Récolte 10 étoiles" },
  loom: { name: "Tisseur magique", description: "Termine une aventure du Métier à Tisser Magique" },
};

/** icon = key understood by the frontend (VOCAB id). */
export const VOCAB = [
  { id: "chat", fr: "chat", ar: "قطة" }, { id: "chien", fr: "chien", ar: "كلب" }, { id: "poisson", fr: "poisson", ar: "سمكة" },
  { id: "pomme", fr: "pomme", ar: "تفاحة" }, { id: "soleil", fr: "soleil", ar: "شمس" }, { id: "lune", fr: "lune", ar: "قمر" },
  { id: "oiseau", fr: "oiseau", ar: "عصفور" }, { id: "fleur", fr: "fleur", ar: "وردة" }, { id: "arbre", fr: "arbre", ar: "شجرة" },
  { id: "maison", fr: "maison", ar: "بيت" }, { id: "voiture", fr: "voiture", ar: "سيارة" }, { id: "livre", fr: "livre", ar: "كتاب" },
  { id: "velo", fr: "vélo", ar: "دراجة" }, { id: "coeur", fr: "cœur", ar: "قلب" },
];
export const DISCOVER = [
  { q: "Qui brille dans le ciel la nuit ?", a: "lune" }, { q: "Qui nous donne la lumière le jour ?", a: "soleil" },
  { q: "Qui miaule ?", a: "chat" }, { q: "Qui pousse dans le jardin ?", a: "fleur" },
  { q: "Qui nage dans l'eau ?", a: "poisson" }, { q: "Qui vole dans le ciel ?", a: "oiseau" },
  { q: "Qui aboie ?", a: "chien" }, { q: "Qui est un fruit ?", a: "pomme" },
];

export type Kind = "vocab" | "math" | "memory" | "paint" | "discover";
export interface ActivityDef { id: string; levelId: number; group: AgeGroup; kind: Kind; title: string; description: string; instructions: string; difficulty: number; content: Record<string, unknown> }

const gentle = (g: AgeGroup) => g === "3-5";
export const ACTIVITIES: ActivityDef[] = (["3-5", "5-10"] as AgeGroup[]).flatMap((g): ActivityDef[] => [
  { id: `l1-vocab-${g}`, levelId: 1, group: g, kind: "vocab", title: "Les mots en images", description: "Associe chaque mot à son image.", instructions: gentle(g) ? "Touche la bonne image." : "Trouve l'image qui correspond au mot.", difficulty: gentle(g) ? 1 : 2, content: { pool: gentle(g) ? 6 : 12, questions: 5, choices: gentle(g) ? 2 : 3 } },
  { id: `l2-math-${g}`, levelId: 2, group: g, kind: "math", title: gentle(g) ? "Compte les étoiles" : "Calcule !", description: "Des calculs et du comptage.", instructions: "Choisis la bonne réponse.", difficulty: gentle(g) ? 1 : 2, content: { band: gentle(g) ? "easy" : "medium", questions: 5 } },
  { id: `l3-memory-${g}`, levelId: 3, group: g, kind: "memory", title: "Les paires cachées", description: "Retrouve les cartes identiques.", instructions: "Retourne deux cartes à la fois.", difficulty: gentle(g) ? 2 : 3, content: { pairs: gentle(g) ? 3 : 6 } },
  { id: `l4-paint-${g}`, levelId: 4, group: g, kind: "paint", title: "Mon tissage", description: "Colorie un motif tissé.", instructions: "Touche les cases pour les colorier.", difficulty: 2, content: { minCells: 12, grid: 7 } },
  { id: `l5-discover-${g}`, levelId: 5, group: g, kind: "discover", title: "Devinettes de la nature", description: "Réponds aux devinettes illustrées.", instructions: "Touche la bonne image.", difficulty: gentle(g) ? 2 : 3, content: { questions: 5, choices: gentle(g) ? 2 : 3 } },
]);

/** Stars from the number of wrong answers (quiz) or flips (memory). Computed server side only. */
export const starsFromMistakes = (m: number) => (m >= 4 ? 1 : m >= 2 ? 2 : 3);
export const starsFromMoves = (moves: number, pairs: number) => (moves <= pairs * 2 ? 3 : moves <= pairs * 3 ? 2 : 1);
