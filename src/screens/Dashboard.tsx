import { useState } from "react";
import { ArrowRight, Heart, Home, ListChecks, Lock, LogOut, Map as MapIcon, Menu, Play, Route, Settings, Trophy, UserRound, X } from "lucide-react";
import { Avatar, Bubble, Button, Logo, MainScreen, Mascot, ProgressBar, StarCount, TopSky } from "../components/ui";
import { BADGES, CATEGORIES, GROUPS, LEVELS, currentLevel, groupOf, isUnlocked, totalStars } from "../data";
import { useApp } from "../store";
import type { Category } from "../types";

const MESSAGES = ["Chaque petit pas compte !", "Tu progresses à chaque essai !", "Aujourd'hui, on tisse une belle réussite !", "Tu es capable de grandes choses !"];

export default function Dashboard() {
  const { state, go, openLevel, explore, logout, remote } = useApp();
  const [sheet, setSheet] = useState<Category | null>(null);
  const [menu, setMenu] = useState(false);
  const { profile, progress } = state;
  const stars = totalStars(progress), group = groupOf(profile);
  const doneLevels = Object.keys(progress.levelStars).length;
  const cur = LEVELS.find((l) => l.id === currentLevel(progress))!;
  const pct = Math.round((doneLevels / LEVELS.length) * 100);
  const started = doneLevels > 0 || progress.started.length > 0;
  const lastLevel = doneLevels ? LEVELS.filter((l) => progress.levelStars[l.id] !== undefined).slice(-1)[0] : null;
  const lastTitle = progress.lastActivity?.title ?? lastLevel?.activity.split(" · ")[0] ?? null;
  const msg = MESSAGES[(stars + doneLevels) % MESSAGES.length];
  const earned = BADGES.filter((b) => progress.badges.includes(b.id));
  const CurIcon = cur.icon;

  const overlay = (<>
    {menu && (
      <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={() => setMenu(false)}>
        <div role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()} className="rise w-full rounded-t-[32px] bg-cream p-6 pb-8">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-black text-teal-dark">Menu</h2><button aria-label="Fermer" onClick={() => setMenu(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><X size={20} /></button></div>
          <div className="grid gap-2">
            {([
              [Home, "Retour à l'accueil initial", "text-teal", () => go("welcome")],
              [Route, `Changer mon parcours · ${GROUPS[group].label}`, "text-sun", () => go("path")],
              [UserRound, "Changer de profil", "text-grape", () => go("profile")],
              [Settings, "Réglages", "text-teal-dark", () => go("settings")],
              [LogOut, "Se déconnecter", "text-coral", () => void logout()],
            ] as const).map(([Icon, label, color, fn]) => (
              <button key={label} onClick={fn} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left font-extrabold shadow-soft"><Icon size={22} className={color} /> {label}</button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-mute">{remote ? "Ta progression est enregistrée sur ton compte." : "Ta progression est conservée sur cet appareil."}</p>
        </div>
      </div>
    )}
    {sheet && (
      <div className="absolute inset-0 z-30 flex items-end bg-black/35" onClick={() => setSheet(null)}>
        <div role="dialog" aria-label={sheet.title} onClick={(e) => e.stopPropagation()} className="rise w-full rounded-t-[32px] bg-cream p-6 pb-8">
          <div className="flex items-start justify-between"><div><h3 className="text-2xl font-black text-teal-dark">{sheet.title}</h3><p className="text-sm font-bold text-mute">{sheet.desc}</p></div><button aria-label="Fermer" onClick={() => setSheet(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><X size={20} /></button></div>
          <div className="mt-3 flex flex-wrap gap-2">{sheet.topics.map((t) => <span key={t} className={`${sheet.chip} rounded-pill px-3 py-1 text-sm font-extrabold`}>{t}</span>)}</div>
          {isUnlocked(progress, sheet.level)
            ? <Button size="lg" className="mt-5 w-full" onClick={() => { setSheet(null); openLevel(sheet.level); }}><Play size={20} className="fill-white" /> Jouer · niveau {sheet.level}</Button>
            : <Button tone="white" size="lg" className="mt-5 w-full" onClick={() => { setSheet(null); go("map"); }}><Lock size={18} /> Termine d'abord le niveau {sheet.level - 1}</Button>}
        </div>
      </div>
    )}
  </>);

  return (
    <MainScreen active="dashboard" onGo={go} overlay={overlay}>
      <div className="relative">
        <TopSky h={300} />
        <div className="relative z-10 px-5 pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => go("me")} aria-label="Mon profil" className="active:scale-95"><Avatar className="h-14 w-14" /></button>
            <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-teal-dark/80">Bonjour !</p><h1 className="truncate text-2xl font-black leading-tight text-teal-dark">{profile?.name || "Petit explorateur"}</h1></div>
            <StarCount n={stars} />
            <button onClick={() => setMenu(true)} aria-label="Menu" className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-teal-dark shadow-soft"><Menu size={22} /></button>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-card bg-white/90 p-3 shadow-soft">
            <Mascot mood={started ? "joyeux" : "curieux"} className="w-20 shrink-0" />
            <p className="text-[13.5px] font-bold italic leading-snug text-teal-dark">Chaque apprentissage est un fil, chaque réussite est un nœud, et tous les fils forment ton parcours.</p>
          </div>
        </div>

        <div className="relative z-10 mt-3 rounded-t-[34px] bg-cream px-5 pb-8 pt-5 shadow-[0_-8px_24px_rgba(23,107,99,.13)]">
          {/* Mon parcours / Reprendre */}
          <section aria-label="Mon parcours" className="rounded-card bg-white p-4 shadow-card">
            {started ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal text-white shadow-pop"><CurIcon size={30} /></span>
                  <div className="min-w-0 flex-1"><p className="text-xs font-extrabold uppercase tracking-wider text-mute">Reprendre mon parcours</p><h2 className="truncate text-lg font-black text-teal-dark">{cur.title} · {cur.sub}</h2></div>
                </div>
                <div className="mt-3 flex items-center gap-3"><ProgressBar value={pct} className="flex-1" /><span className="text-sm font-black text-teal-dark">{pct} %</span></div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Mascot mood="encourageant" className="w-16 shrink-0" />
                <div><h2 className="text-lg font-black text-teal-dark">Ton aventure commence ici !</h2><p className="text-sm font-semibold text-mute">Le niveau 1 t'attend : « {cur.sub} ».</p></div>
              </div>
            )}
            <Button size="lg" className="mt-4 w-full" onClick={() => openLevel(cur.id)}>{started ? "Continuer" : "Commencer"} <ArrowRight size={22} strokeWidth={3} /></Button>
            <p className="mt-3 rounded-2xl bg-sun-soft px-3 py-2 text-center text-xs font-extrabold text-[#8a5a0a]">{lastTitle ? `Dernière activité : ${lastTitle} · À suivre : ${cur.sub}` : `Activité recommandée : ${cur.activity}`}</p>
          </section>

          <Bubble className="mt-4 text-center">{msg}</Bubble>

          {/* Quick access */}
          <h2 className="mb-3 mt-5 text-lg font-black text-teal-dark">Accès rapide</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              [MapIcon, "Parcours", "map", "bg-teal-soft", "text-teal-dark"],
              [ListChecks, "Activités", "activities", "bg-sun-soft", "text-[#a8690c]"],
              [Trophy, "Récompenses", "progress", "bg-lavender/60", "text-[#6a4f8c]"],
              [Heart, "Profil", "me", "bg-coral-soft", "text-[#b04a50]"],
            ] as const).map(([Icon, label, to, bg, fg]) => (
              <button key={label} onClick={() => go(to)} className={`${bg} flex items-center gap-3 rounded-card p-4 text-left shadow-soft transition active:scale-[.97]`}>
                <Icon size={28} className={fg} /><span className="text-base font-black text-ink">{label}</span>
              </button>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-lg font-black text-teal-dark">Explore tes univers</h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c, i) => {
              const Icon = c.icon, done = progress.explored.includes(c.id);
              return (
                <button key={c.id} onClick={() => { explore(c.id); setSheet(c); }} className={`${c.card} ${i === 4 ? "col-span-2 flex-row justify-start gap-4" : "flex-col"} relative flex items-center rounded-card p-4 text-left shadow-soft transition active:scale-[.97]`}>
                  <span className={`${c.chip} grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-pop`}><Icon size={30} /></span>
                  <span className={i === 4 ? "" : "mt-2 text-center"}><b className="block text-[17px] font-black text-ink">{c.title}</b><span className="text-xs font-bold text-mute">{c.desc}</span></span>
                  {done && <span className="absolute right-3 top-3 h-3 w-3 rounded-full bg-teal ring-2 ring-white" aria-label="Exploré" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between"><h2 className="text-lg font-black text-teal-dark">Mes réussites</h2><button onClick={() => go("progress")} className="text-sm font-extrabold text-teal underline">Tout voir</button></div>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {earned.length === 0 && <p className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-mute">Termine ta première activité pour gagner un badge !</p>}
            {earned.map((b) => { const I = b.icon; return <div key={b.id} className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl bg-white p-3 text-center shadow-soft"><span className={`${b.tone} grid h-12 w-12 place-items-center rounded-full text-white`}><I size={24} /></span><span className="text-[11px] font-extrabold leading-tight">{b.title}</span></div>; })}
          </div>
          <div className="mt-5 flex justify-center opacity-90"><Logo className="h-14" /></div>
        </div>
      </div>
    </MainScreen>
  );
}
