import { useState } from "react";
import { Lock, Play, X } from "lucide-react";
import { Braid, Knot, MAP_H, Medallion, NODE_X, StarsRow, StitchBorder, nodes, segMid, type NodeState } from "../components/Weave";
import { Bubble, Button, MainScreen, Mascot, ProgressBar, StarCount, YarnHills } from "../components/ui";
import { CATEGORIES, GROUPS, LEVELS, currentLevel, difficultyLabel, difficultyOf, groupOf, isUnlocked, totalStars } from "../data";
import { useApp } from "../store";
import type { Level, Mood } from "../types";

const moodFor = (id: number): Mood => (id === 1 || id === 5 ? "curieux" : id === 3 ? "motive" : id === 2 ? "concentre" : "joyeux");

export default function LearningMap() {
  const { state, go, openLevel } = useApp();
  const [sel, setSel] = useState<Level | null>(null);
  const p = state.progress, group = groupOf(state.profile), cur = currentLevel(p);
  const stateOf = (id: number): NodeState => (p.levelStars[id] !== undefined ? "done" : isUnlocked(p, id) ? "current" : "locked");
  const live = (seg: number) => seg === 0 || p.levelStars[seg] !== undefined; // braid k leads away from level k
  const kids = group === "3-5";

  return (
    <MainScreen active="map" onGo={go} overlay={sel && <LevelSheet level={sel} onClose={() => setSel(null)} onStart={(id) => openLevel(id)} />}>
      <div className="relative bg-gradient-to-b from-[#a9dcf5] via-[#d8effa] to-[#FFF7E9]">
        <header className="relative px-5 pb-1 pt-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-wider text-teal-dark/70">{GROUPS[group].label} · {GROUPS[group].title}</p><h1 className="text-[28px] font-black leading-tight text-teal-dark">Mon parcours</h1></div>
            <StarCount n={totalStars(p)} />
          </div>
          <div className="mt-1 flex items-end gap-2">
            <Mascot mood="hello" className="w-24 shrink-0" />
            <p className="mb-3 rounded-2xl bg-white/85 px-3 py-2 text-[13px] font-bold italic leading-snug text-teal-dark shadow-soft">Chaque apprentissage est un fil, chaque réussite est un nœud, et tous les fils forment ton parcours.</p>
          </div>
        </header>

        <div className="relative mx-auto w-full" style={{ aspectRatio: `400 / ${MAP_H}` }}>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 400 ${MAP_H}`} aria-hidden>
            <StitchBorder h={MAP_H} />
            {[0, 1, 2, 3, 4, 5].map((k) => <Braid key={k} segment={k} live={live(k)} />)}
            {[1, 2, 3, 4].map((k) => <Knot key={k} x={segMid(k).x} y={segMid(k).y} live={live(k)} />)}
            <Knot x={200} y={MAP_H - 60} live={p.levelStars[5] !== undefined} scale={1.5} />
          </svg>

          {LEVELS.map((l, i) => {
            const st = stateOf(l.id), big = st === "current", w = big ? 33 : 26, { x, y } = nodes[i], r = (w / 100) * 200;
            const stars = p.levelStars[l.id] ?? 0;
            return (
              <div key={l.id}>
                <button onClick={() => setSel(l)} aria-disabled={st === "locked"} aria-label={`${l.title} : ${l.sub}. ${st === "done" ? "Terminé" : st === "current" ? "Niveau en cours" : "Verrouillé"}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 transition active:scale-95 ${big ? "breathe" : ""}`} style={{ left: `${(x / 400) * 100}%`, top: `${(y / MAP_H) * 100}%`, width: `${w}%` }}>
                  <Medallion level={l} state={st} stars={stars} />
                </button>
                <div className="pointer-events-none absolute w-[44%] -translate-x-1/2 text-center" style={{ left: `${(x / 400) * 100}%`, top: `${((y + r + 4) / MAP_H) * 100}%` }}>
                  <p className={`mx-auto inline-block rounded-full px-3 py-1 text-[12px] font-black leading-tight shadow-soft ${st === "locked" ? "bg-[#ece6d9] text-[#8d8474]" : "bg-white text-teal-dark"}`}>{l.title} · {l.sub}</p>
                  {st === "done" && <div className="mt-1"><StarsRow n={stars} /></div>}
                  {st === "locked" && <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold leading-tight text-[#8d8474]"><Lock size={11} /> Termine le niveau {l.id - 1}</p>}
                </div>
                {big && (
                  <>
                    <button onClick={() => openLevel(l.id)} className="absolute -translate-x-1/2 rounded-full bg-teal px-5 py-2 text-sm font-black text-white shadow-pop active:translate-y-0.5" style={{ left: `${(x / 400) * 100}%`, top: `${((y + r + 40) / MAP_H) * 100}%` }}>
                      <span className="flex items-center gap-1.5"><Play size={15} className="fill-white" /> Continuer</span>
                    </button>
                    <div className="pointer-events-none absolute" style={{ left: `${((x < 200 ? 300 : 100) / 400) * 100}%`, top: `${((y - 10) / MAP_H) * 100}%`, width: kids ? "30%" : "26%", transform: "translate(-50%,-50%)" }}>
                      <Bubble className="absolute -top-10 left-1/2 w-28 -translate-x-1/2 text-center text-xs">{kids ? "On y va !" : "On continue ensemble !"}</Bubble>
                      <Mascot mood="encourageant" flip={x >= 200} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <p className="absolute inset-x-0 text-center text-xs font-extrabold text-teal-dark/70" style={{ top: `${((MAP_H - 18) / MAP_H) * 100}%` }}>Ton fil continue bientôt…</p>
        </div>
        <div className="relative h-[110px] overflow-hidden"><YarnHills className="h-[170px]" /></div>
      </div>
    </MainScreen>
  );
}

function LevelSheet({ level, onClose, onStart }: { level: Level; onClose: () => void; onStart: (id: number) => void }) {
  const { state } = useApp();
  const p = state.progress, group = groupOf(state.profile);
  const done = p.levelStars[level.id] !== undefined, open = isUnlocked(p, level.id), stars = p.levelStars[level.id] ?? 0;
  const started = p.started.includes(level.id), diff = difficultyOf(group, level.id);
  const Icon = level.icon;
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label={`${level.title} : ${level.sub}`} onClick={(e) => e.stopPropagation()} className="rise relative max-h-[88%] w-full overflow-y-auto rounded-t-[32px] bg-cream p-6 pb-7">
        <button aria-label="Fermer" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><X size={20} /></button>
        <div className="flex items-center gap-4 pr-12">
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-white shadow-pop ${open ? "bg-teal" : "bg-[#b9b09f]"}`}>{open ? <Icon size={32} /> : <Lock size={28} />}</span>
          <div><p className="text-xs font-extrabold uppercase tracking-wider text-teal-dark/70">{level.title}</p><h2 className="text-[26px] font-black leading-tight text-teal-dark">{level.sub}</h2></div>
        </div>
        <div className="relative mt-3 rounded-2xl bg-white p-4 shadow-soft">
          <Mascot mood={moodFor(level.id)} bob={false} className="absolute -top-14 right-3 w-16" />
          <p className="pr-10 text-[15px] font-bold leading-snug text-[#3d5551]">{level.desc}</p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-sun-soft p-3"><dt className="text-xs font-extrabold text-[#9a6412]">Difficulté</dt><dd className="mt-0.5 flex items-center gap-1 font-black">{[1, 2, 3].map((d) => <span key={d} className={`h-2.5 w-2.5 rounded-full ${d <= diff ? "bg-sun" : "bg-black/15"}`} />)}<span className="ml-1">{difficultyLabel[diff]}</span></dd></div>
          <div className="rounded-2xl bg-teal-soft p-3"><dt className="text-xs font-extrabold text-teal-dark">Étoiles</dt><dd className="mt-0.5"><StarsRow n={stars} size={18} /></dd></div>
        </dl>
        <div className="mt-2 rounded-2xl bg-grape-soft p-3 text-sm"><p className="text-xs font-extrabold text-[#6a4f8c]">Activités</p><p className="font-bold">{level.activity}</p></div>
        <div className="mt-2 rounded-2xl bg-sky-soft p-3 text-sm"><p className="text-xs font-extrabold text-[#2f6f91]">Compétences</p><p className="font-bold">{(CATEGORIES.find((c) => c.id === level.category)?.topics ?? []).join(" · ")}</p></div>
        <div className="mt-3"><div className="mb-1 flex justify-between text-xs font-extrabold text-[#4b625e]"><span>Progression</span><span>{Math.round((stars / 3) * 100)} %</span></div><ProgressBar value={(stars / 3) * 100} /></div>
        <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-[#4b625e]">
          {done ? "Niveau terminé : tu peux le rejouer pour gagner plus d'étoiles." : open ? "Niveau débloqué, à toi de jouer !" : `Verrouillé : termine d'abord le niveau ${level.id - 1} pour le débloquer.`}
        </p>
        {open
          ? <Button size="lg" className="mt-4 w-full" onClick={() => onStart(level.id)}><Play size={20} className="fill-white" /> {done ? "Rejouer" : started ? "Continuer" : "Commencer"}</Button>
          : <Button tone="white" size="lg" className="mt-4 w-full" onClick={onClose}><Lock size={18} /> Niveau verrouillé</Button>}
      </div>
    </div>
  );
}
