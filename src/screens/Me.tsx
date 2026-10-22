import { HelpCircle, LogOut, Settings, Star, Trophy, UserCheck } from "lucide-react";
import { Avatar, MainScreen, ProgressBar, ScreenHeader, TopSky } from "../components/ui";
import { BADGES, GROUPS, LEVELS, groupOf, totalStars } from "../data";
import { useApp } from "../store";

export default function Me() {
  const { state, go, logout } = useApp();
  const p = state.progress, stars = totalStars(p), group = groupOf(state.profile);
  const doneLevels = Object.keys(p.levelStars).length;
  const activities = p.completedActivities ?? doneLevels;
  const level = Math.floor(stars / 6) + 1;
  const items = [
    [Trophy, "Mes progrès", () => go("map"), "text-teal"],
    [UserCheck, "Mes badges", () => go("progress"), "text-grape"],
    [Settings, "Réglages", () => go("settings"), "text-teal-dark"],
    [HelpCircle, "Aide & FAQ", () => go("help"), "text-sun"],
  ] as const;
  return (
    <MainScreen onGo={go}>
      <div className="relative">
        <TopSky h={230} />
        <div className="relative z-10 px-5 pb-8 pt-4">
          <ScreenHeader title="Mon profil" onBack={() => go("dashboard")} />
          <div className="mt-4 flex flex-col items-center text-center">
            <Avatar className="h-28 w-28" />
            <h2 className="mt-2 text-2xl font-black text-teal-dark">{state.profile?.name || "Petit explorateur"}</h2>
            <p className="text-sm font-extrabold text-mute">Niveau {level} · {GROUPS[group].label}</p>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {([[Star, stars, "Étoiles", "text-sun"], [Trophy, p.badges.length, "Badges", "text-grape"], [UserCheck, activities, "Activités", "text-coral"]] as const).map(([I, n, l, c]) => (
              <div key={l} className="rounded-card bg-white p-3 shadow-soft"><I size={22} className={`mx-auto ${c}`} /><dd className="text-2xl font-black text-ink">{n}</dd><dt className="text-xs font-extrabold text-mute">{l}</dt></div>
            ))}
          </dl>
          <section className="mt-3 rounded-card bg-white p-4 shadow-soft" aria-label="Mes progrès">
            <div className="mb-1 flex justify-between text-sm font-extrabold text-ink"><span>Niveaux terminés</span><span>{doneLevels} / {LEVELS.length}</span></div>
            <ProgressBar value={(doneLevels / LEVELS.length) * 100} />
            <p className="mt-1 text-xs font-semibold text-mute">{p.badges.length} badge{p.badges.length > 1 ? "s" : ""} sur {BADGES.length}</p>
          </section>
          <ul className="mt-4 grid gap-2">
            {items.map(([I, label, fn, c]) => <li key={label}><button onClick={fn} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left font-extrabold text-ink shadow-soft"><I size={22} className={c} /> {label}<span className="ml-auto text-mute" aria-hidden>›</span></button></li>)}
            <li><button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left font-extrabold text-[#b04a50] shadow-soft"><LogOut size={22} /> Se déconnecter</button></li>
          </ul>
        </div>
      </div>
    </MainScreen>
  );
}
