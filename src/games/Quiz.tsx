import { useState } from "react";
import { ArrowRight, Check, Volume2 } from "lucide-react";
import { canSpeak, speak } from "../audio";
import { Button } from "../components/ui";
import type { Band, Mood, Question } from "../types";

interface Props {
  questions: Question[]; band?: Band;
  /** Remote mode: the server checks each answer (answers never reach the browser). */
  check?: (questionId: string, optionId: string) => Promise<boolean>;
  onError?: (message: string) => void;
  /** Show the speaker button (user preference + device support). */
  audio?: boolean;
  onSay: (m: string, mood?: Mood) => void; onDone: (mistakes: number) => void;
}

const GOOD = ["Bravo !", "Bien joué !", "Super, c'est ça !"];
const RETRY = ["Essaie encore !", "Tu progresses à chaque essai !", "Presque ! Regarde bien."];
const hasArabic = (s?: string) => !!s && /[\u0600-\u06FF]/.test(s);

/** Multiple-choice game (vocabulary, maths, discovery): choose a card, press "Valider", get gentle feedback. */
export default function Quiz({ questions, band = "medium", check, onError, audio = true, onSay, onDone }: Props) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const q = questions[i];
  const big = band === "easy";
  const picture = q.options.every((o) => o.icon);
  const cols = picture ? (q.options.length === 2 ? "grid-cols-2" : "grid-cols-3") : q.options.length === 3 ? "grid-cols-3" : "grid-cols-2";

  async function validate() {
    if (!picked || solved || checking) return;
    let ok = picked === q.answer;
    if (check) {
      setChecking(true);
      try { ok = await check(q.id ?? "", picked); }
      catch (e) { onError?.(e instanceof Error ? e.message : "Erreur réseau"); return; }
      finally { setChecking(false); }
    }
    if (ok) { setSolved(true); setFeedback({ ok: true, text: GOOD[(i + mistakes) % GOOD.length] }); onSay("Bravo, c'est ça !", "bravo"); }
    else { setWrong((w) => [...w, picked]); setMistakes((m) => m + 1); setPicked(null); setFeedback({ ok: false, text: RETRY[mistakes % RETRY.length] }); onSay("Tu y es presque ! Essaie encore.", "encourageant"); }
  }
  function next() {
    if (i + 1 >= questions.length) return onDone(mistakes);
    setI(i + 1); setPicked(null); setSolved(false); setWrong([]); setFeedback(null); onSay("Question suivante !");
  }
  function listen() {
    const fr = /«\s*([^»]+?)\s*»/.exec(q.prompt)?.[1];
    speak([{ text: fr ?? q.prompt, lang: "fr-FR" }, ...(hasArabic(q.sub) ? [{ text: q.sub!, lang: "ar-SA" as const }] : [])]);
  }

  return (
    <div>
      <div className="mb-4 flex justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={i + 1} aria-label={`Question ${i + 1} sur ${questions.length}`}>
        {questions.map((_, n) => <span key={n} className={`h-2.5 w-9 rounded-full ${n < i ? "bg-teal" : n === i ? "bg-sun" : "bg-black/10"}`} />)}
      </div>
      <div className="relative rounded-card bg-white p-5 text-center shadow-soft">
        {audio && canSpeak && <button onClick={listen} aria-label="Écouter" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-sky-soft text-teal-dark active:scale-95"><Volume2 size={20} /></button>}
        <p className={`${q.prompt.length < 12 || big ? "text-5xl" : "text-2xl"} font-black text-teal-dark ${hasArabic(q.prompt) ? "font-ar" : ""} ${big ? "tracking-widest" : ""}`} dir="auto">{q.prompt}</p>
        {q.sub && <p className={`mt-1 font-bold text-mute ${hasArabic(q.sub) ? "font-ar text-3xl text-coral" : "text-lg"}`} dir="auto" lang={hasArabic(q.sub) ? "ar" : undefined}>{q.sub}</p>}
      </div>
      <div className={`mt-4 grid gap-3 ${cols}`}>
        {q.options.map((o) => {
          const Icon = o.icon, bad = wrong.includes(o.id), good = solved && picked === o.id, sel = picked === o.id && !solved;
          return (
            <button key={o.id} onClick={() => !solved && !bad && setPicked(o.id)} aria-label={o.label} aria-pressed={sel || good} disabled={bad || (solved && !good)}
              className={`${bad ? "shake bg-coral-soft text-coral ring-4 ring-coral/40" : good ? "pop bg-teal text-white ring-4 ring-teal/40" : sel ? `${o.tone ?? "bg-sun-soft text-[#9a6412]"} ring-4 ring-teal` : (o.tone ?? "bg-sun-soft text-[#9a6412]")} relative grid ${picture ? "aspect-square" : "h-20 text-4xl"} place-items-center rounded-card font-black shadow-pop transition active:scale-95 disabled:opacity-40`}>
              {Icon ? <Icon size={big ? 68 : 54} strokeWidth={2.1} /> : o.label}
              {good && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-teal"><Check size={16} strokeWidth={4} /></span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-[3.25rem]" aria-live="polite">
        {feedback && <p className={`rise mb-3 rounded-2xl px-4 py-2.5 text-center text-base font-black ${feedback.ok ? "bg-teal-soft text-teal-dark" : "bg-sun-soft text-[#8a5a0a]"}`}>{feedback.text}</p>}
        {solved
          ? <Button size="lg" className="w-full" onClick={next}>{i + 1 >= questions.length ? "Terminer" : "Suivant"} <ArrowRight size={22} strokeWidth={3} /></Button>
          : <Button size="lg" className="w-full" disabled={!picked} loading={checking} onClick={validate}>Valider</Button>}
      </div>
    </div>
  );
}
