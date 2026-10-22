import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { BackButton, Bubble, Button, Mascot, Notice, SkyBackdrop } from "../components/ui";
import { GROUPS } from "../data";
import { useApp } from "../store";
import type { AgeGroup, Mood } from "../types";

const CARDS: { id: AgeGroup; tone: string; ring: string; mood: Mood }[] = [
  { id: "3-5", tone: "bg-sun-soft", ring: "ring-sun", mood: "joyeux" },
  { id: "5-10", tone: "bg-teal-soft", ring: "ring-teal", mood: "curieux" },
];

export default function PathSelect() {
  const { state, go, savePath } = useApp();
  const [group, setGroup] = useState<AgeGroup | null>(state.profile?.group ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function confirm() {
    if (!group) return;
    setBusy(true); setErr(null);
    try { await savePath(group); } catch (e) { setErr(e instanceof Error ? e.message : "Une erreur est survenue."); } finally { setBusy(false); }
  }
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <SkyBackdrop />
      <div className="relative z-10 flex min-h-full flex-col px-5 pb-8 pt-5">
        <BackButton onClick={() => go(state.profile?.group ? "dashboard" : "profile")} />
        <div className="mt-1 text-center"><h1 className="text-[30px] font-black leading-tight text-teal-dark">Choisis ton parcours !</h1><Bubble className="mx-auto mt-2 inline-block">Ton progrès est gardé quand tu changes.</Bubble></div>
        <div className="mt-4 grid gap-4" role="radiogroup" aria-label="Parcours">
          {CARDS.map((c) => {
            const g = GROUPS[c.id], on = group === c.id;
            return (
              <button key={c.id} role="radio" aria-checked={on} onClick={() => setGroup(c.id)} className={`${c.tone} relative flex items-center gap-3 overflow-hidden rounded-[30px] p-4 text-left shadow-soft transition active:scale-[.98] ${on ? `ring-4 ${c.ring}` : ""}`}>
                <Mascot mood={c.mood} bob={on} className={c.id === "3-5" ? "w-24 shrink-0" : "w-20 shrink-0"} />
                <span className="flex-1"><b className="block text-[26px] font-black leading-none text-teal-dark">{g.label}</b><b className="block text-[17px] font-extrabold text-[#3d5551]">{g.title}</b><span className="mt-1 block text-[13px] font-semibold leading-snug text-[#5f7470]">{g.desc}</span></span>
                {on && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-teal text-white"><Check size={16} strokeWidth={4} /></span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs font-bold text-teal-dark/80">À 5 ans, tu peux choisir l'un ou l'autre : prends celui qui te plaît !</p>
        {err && <div className="mt-3"><Notice kind="error">{err}</Notice></div>}
        <Button size="lg" className="mt-auto w-full" disabled={!group || busy} onClick={confirm}>{busy ? "Un instant…" : "Voir mes 5 niveaux"} <ArrowRight size={22} strokeWidth={3} /></Button>
      </div>
    </div>
  );
}
