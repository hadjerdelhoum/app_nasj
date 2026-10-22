import { useCallback, useEffect, useState } from "react";
import { Lock, Play } from "lucide-react";
import { REMOTE, api } from "../api";
import { Button, MainScreen, Notice, ScreenHeader, StateCard, TopSky } from "../components/ui";
import { StarsRow } from "../components/Weave";
import { LEVELS, groupOf, isUnlocked } from "../data";
import { useApp } from "../store";

interface Item { id: string; levelId: number; title: string; description: string; unlocked: boolean; completed: boolean; bestStars: number }

export default function Activities() {
  const { state, go, openLevel } = useApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const group = groupOf(state.profile);

  const load = useCallback(() => {
    setErr(null); setItems(null);
    if (!REMOTE) {
      const p = state.progress;
      setItems(LEVELS.map((l) => ({ id: `l${l.id}`, levelId: l.id, title: l.sub, description: l.activity, unlocked: isUnlocked(p, l.id), completed: p.levelStars[l.id] !== undefined, bestStars: p.levelStars[l.id] ?? 0 })));
      return;
    }
    api<{ activities: Item[] }>("GET", `/children/${state.childId}/activities`).then((r) => setItems(r.activities)).catch((e) => setErr(e.message));
  }, [state.childId, state.progress]);
  useEffect(load, [load]);

  return (
    <MainScreen onGo={go}>
      <div className="relative">
        <TopSky h={150} />
        <div className="relative z-10 px-5 pb-6 pt-4">
          <ScreenHeader title="Activités" subtitle={group === "3-5" ? "Petits explorateurs" : "Grands explorateurs"} onBack={() => go("dashboard")} />
          <div className="mt-6 grid gap-3">
            {err && <StateCard kind="error" title="Oups, impossible de charger les activités" text={err} action={<Button onClick={load}>Réessayer</Button>} />}
            {!err && !items && <StateCard kind="loading" title="Je prépare tes activités…" />}
            {items && items.length === 0 && <StateCard kind="empty" title="Aucune activité pour l'instant" text="Reviens bientôt : de nouvelles activités arrivent !" />}
            {locked && <Notice kind="error">{locked}</Notice>}
            {items?.map((a) => {
              const L = LEVELS.find((l) => l.id === a.levelId)!, Icon = L.icon;
              return (
                <button key={a.id} onClick={() => (a.unlocked ? openLevel(a.levelId) : setLocked(`Termine d'abord le niveau ${a.levelId - 1} pour débloquer « ${a.title} ».`))}
                  aria-disabled={!a.unlocked} className={`flex items-center gap-3 rounded-card p-4 text-left shadow-soft transition active:scale-[.98] ${a.unlocked ? "bg-white" : "bg-[#ece6d9]"}`}>
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-pop ${a.completed ? "bg-teal" : a.unlocked ? "bg-sun" : "bg-[#b9b09f]"}`}>{a.unlocked ? <Icon size={28} /> : <Lock size={24} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-extrabold uppercase tracking-wider text-mute">{L.title}</span><b className="block truncate text-base font-black text-teal-dark">{a.title}</b><span className="block text-xs font-semibold text-mute">{a.description}</span></span>
                  {a.completed ? <StarsRow n={a.bestStars} size={15} /> : a.unlocked ? <Play size={22} className="fill-teal text-teal" aria-label="Jouer" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MainScreen>
  );
}
