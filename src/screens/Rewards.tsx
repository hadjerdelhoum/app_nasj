import { Check, Lock, Star } from "lucide-react";
import { Button, MainScreen, Mascot, ProgressBar, ScreenHeader, StateCard, StarCount, TopSky } from "../components/ui";
import { StarsRow } from "../components/Weave";
import { BADGES, LEVELS, totalStars } from "../data";
import { useApp } from "../store";

export default function Rewards() {
  const { state, go, openLevel } = useApp();
  const p = state.progress, stars = totalStars(p);
  const earned = BADGES.filter((b) => p.badges.includes(b.id)).length;
  const toNext = 6 - (stars % 6), levelNow = Math.floor(stars / 6) + 1;
  return (
    <MainScreen active="progress" onGo={go}>
      <div className="relative">
        <TopSky h={290} />
        <div className="relative z-10 px-5 pt-4">
          <ScreenHeader title="Récompenses" onBack={() => go("dashboard")} right={<StarCount n={stars} />} />
          <div className="mt-2 flex items-end justify-center"><Mascot mood={stars ? "fete" : "encourageant"} className="w-36" /></div>
        </div>
        <div className="relative z-10 -mt-2 rounded-t-[34px] bg-cream px-5 pb-8 pt-5 shadow-[0_-8px_24px_rgba(23,107,99,.13)]">
          <section className="rounded-card bg-white p-4 text-center shadow-card" aria-label="Mes étoiles">
            <h2 className="text-2xl font-black text-teal-dark">{stars ? "Bravo !" : "Ta collection commence !"}</h2>
            <p className="text-sm font-bold text-mute">{stars ? `Tu as gagné ${stars} étoile${stars > 1 ? "s" : ""} !` : "Joue une première activité pour gagner tes premières étoiles."}</p>
            <div className="mt-3 text-left">
              <div className="mb-1 flex justify-between text-xs font-extrabold text-ink"><span>Prochaine récompense : niveau {levelNow + 1}</span><span>{stars % 6} / 6</span></div>
              <ProgressBar value={((stars % 6) / 6) * 100} />
              <p className="mt-1 text-xs font-semibold text-mute">Encore {toNext} étoile{toNext > 1 ? "s" : ""}. Chaque essai te fait grandir : pas de course !</p>
            </div>
          </section>

          <div className="mt-5 flex items-end justify-between"><h2 className="text-lg font-black text-teal-dark">Badges</h2><span className="text-sm font-extrabold text-mute">{earned} / {BADGES.length}</span></div>
          {earned === 0 && <div className="mt-2"><StateCard kind="empty" title="Pas encore de badge" text="Ton premier badge t'attend dès ta première activité terminée !" action={<Button onClick={() => go("map")}>Voir mon parcours</Button>} /></div>}
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {BADGES.map((b) => {
              const on = p.badges.includes(b.id), I = b.icon;
              return (
                <li key={b.id} className={`flex items-center gap-3 rounded-card p-3 shadow-soft ${on ? "bg-white" : "bg-[#efe9dc]"}`}>
                  <span className={`${on ? b.tone : "bg-[#b9b09f]"} grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ring-2 ring-dashed ring-white/70`}>{on ? <I size={24} /> : <Lock size={20} />}</span>
                  <span className="min-w-0"><b className={`block text-[13px] font-black leading-tight ${on ? "text-ink" : "text-mute"}`}>{b.title}</b><span className="block text-[11px] font-semibold leading-tight text-mute">{on ? "Obtenu !" : b.desc}</span></span>
                </li>
              );
            })}
          </ul>

          <h2 className="mb-2 mt-6 text-lg font-black text-teal-dark">Mes niveaux</h2>
          <div className="grid gap-2">
            {LEVELS.map((l) => {
              const s = p.levelStars[l.id], I = l.icon, open = l.id === 1 || p.levelStars[l.id - 1] !== undefined || (p.unlocked?.includes(l.id) ?? false);
              return (
                <button key={l.id} onClick={() => (open ? openLevel(l.id) : go("map"))} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft">
                  <span className={`grid h-11 w-11 place-items-center rounded-full text-white ${s !== undefined ? "bg-teal" : open ? "bg-sun" : "bg-[#b9b09f]"}`}>{s !== undefined ? <Check size={22} strokeWidth={4} /> : open ? <I size={22} /> : <Lock size={20} />}</span>
                  <span className="flex-1"><b className="block text-[15px] font-black text-ink">{l.title} · {l.sub}</b><span className="text-xs font-bold text-mute">{s !== undefined ? "Terminé" : open ? "À jouer" : "Verrouillé"}</span></span>
                  {s !== undefined ? <StarsRow n={s} size={16} /> : <Star size={18} className="text-black/10" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MainScreen>
  );
}
