import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Heart, Map as MapIcon, Sparkles, Star, Trophy, Wand2 } from "lucide-react";
import { Button, Mascot, SkyBackdrop } from "../components/ui";
import { useApp } from "../store";
import type { Mood } from "../types";

const SLIDES: { title: string; text: string; mood: Mood; chips: [typeof Star, string][] }[] = [
  { title: "Apprendre en s'amusant !", text: "Avec NASJ, chaque découverte est une nouvelle aventure.", mood: "lecture", chips: [[BookOpen, "Découvre de nouveaux savoirs"], [Sparkles, "Développe tes compétences"], [Heart, "Révèle ton potentiel"]] },
  { title: "Gagne des étoiles et des badges", text: "Chaque activité réussie te rapporte des étoiles. Essaie encore autant que tu veux, il n'y a pas de course !", mood: "fete", chips: [[Star, "Des étoiles à collectionner"], [Trophy, "Des badges brodés"], [Wand2, "Un défi par jour"]] },
  { title: "Avance sur ton parcours tissé", text: "Chaque apprentissage est un fil, chaque réussite est un nœud, et tous les fils forment ton parcours.", mood: "assis", chips: [[MapIcon, "5 niveaux à débloquer"], [BookOpen, "Des activités variées"], [Heart, "À ton rythme"]] },
];

export default function Onboarding() {
  const { go, finishOnboarding } = useApp();
  const [i, setI] = useState(0);
  const s = SLIDES[i], last = i === SLIDES.length - 1;
  const done = () => { finishOnboarding(); go("auth"); };
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <SkyBackdrop />
      <div className="relative z-10 flex min-h-full flex-col px-6 pb-8 pt-5">
        <div className="flex justify-end"><button onClick={done} className="rounded-pill bg-white/80 px-4 py-2 text-sm font-extrabold text-teal-dark shadow-soft">Passer</button></div>
        <div key={i} className="rise flex flex-1 flex-col items-center text-center">
          <h1 className="mt-2 max-w-[18rem] text-[30px] font-black leading-tight text-teal-dark">{s.title}</h1>
          <p className="mt-2 max-w-[20rem] text-base font-bold leading-snug text-ink/80">{s.text}</p>
          <Mascot mood={s.mood} className="my-4 w-[46%] max-w-[190px]" />
          <ul className="grid w-full grid-cols-3 gap-2" aria-label="Points clés">
            {s.chips.map(([Icon, label]) => (
              <li key={label} className="flex flex-col items-center gap-1 rounded-2xl bg-white/90 p-2.5 text-[11.5px] font-extrabold leading-tight text-teal-dark shadow-soft"><Icon size={26} className="text-teal" />{label}</li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 mt-6 flex justify-center gap-2" role="tablist" aria-label="Progression">
          {SLIDES.map((_, n) => <span key={n} role="tab" aria-selected={n === i} aria-label={`Écran ${n + 1}`} className={`h-2.5 rounded-full transition-all ${n === i ? "w-7 bg-teal" : "w-2.5 bg-white/80"}`} />)}
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[auto_1fr] gap-3">
          {i > 0 ? <Button tone="white" onClick={() => setI(i - 1)} aria-label="Précédent"><ArrowLeft size={20} strokeWidth={3} /> Précédent</Button> : <span />}
          <Button size="lg" className={i === 0 ? "col-span-2" : ""} onClick={() => (last ? done() : setI(i + 1))}>{last ? "C'est parti !" : "Suivant"} <ArrowRight size={22} strokeWidth={3} /></Button>
        </div>
      </div>
    </div>
  );
}
