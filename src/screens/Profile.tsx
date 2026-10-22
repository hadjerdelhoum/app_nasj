import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { BackButton, Bubble, Button, Mascot, Notice, SkyBackdrop } from "../components/ui";
import { GROUPS } from "../data";
import { useApp } from "../store";

export default function Profile() {
  const { state, go, saveName, remote, children, selectChild, newProfile } = useApp();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(state.profile?.name ?? "");
  const ready = name.trim().length > 0;
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <SkyBackdrop />
      <div className="relative z-10 flex min-h-full flex-col px-6 pb-8 pt-5">
        <BackButton onClick={() => go(state.profile?.group ? "dashboard" : remote ? "welcome" : "auth")} />
        <div className="mt-2 flex items-end justify-center gap-2">
          <Mascot mood="encourageant" className="w-36" />
          <Bubble className="mb-24 max-w-[10.5rem]">Coucou ! Dis-moi comment tu t'appelles pour commencer l'aventure.</Bubble>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) saveName(name.trim()); }} className="-mt-2 rounded-[30px] bg-cream p-5 shadow-soft">
          <h1 className="text-2xl font-black text-teal-dark">Ton profil</h1>
          {remote && children.length > 0 && (
            <div className="mt-3 grid gap-2">
              {children.map((c) => (
                <button type="button" key={c.id} onClick={() => selectChild(c.id).catch((e) => setErr(e.message))} className={`rounded-2xl px-4 py-2.5 text-left text-sm font-extrabold ${c.id === state.childId ? "bg-teal text-white" : "bg-teal-soft text-teal-dark"}`}>
                  Reprendre avec {c.displayName} · {GROUPS[c.ageGroup].label}
                </button>
              ))}
              <button type="button" onClick={() => { newProfile(); setName(""); }} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-left text-sm font-extrabold text-teal-dark ring-1 ring-teal/30"><Plus size={16} /> Ajouter un autre enfant</button>
            </div>
          )}
          {err && <div className="mt-3"><Notice kind="error">{err}</Notice></div>}
          <label className="mt-4 block text-sm font-extrabold text-[#4b625e]" htmlFor="kid">Ton prénom (ou un surnom)</label>
          <input id="kid" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Ex : Lina" className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-lg font-bold ring-1 ring-teal/20 placeholder:font-semibold placeholder:text-[#9aaba7]" />
          <p className="mt-3 text-xs font-semibold text-[#7b8c88]">Pas de nom de famille, pas de photo : seulement un prénom. Ton âge se choisit à l'étape suivante.</p>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={!ready}>Continuer <ArrowRight size={22} strokeWidth={3} /></Button>
        </form>
      </div>
    </div>
  );
}
