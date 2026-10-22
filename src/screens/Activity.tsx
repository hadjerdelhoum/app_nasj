import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Map as MapIcon, RotateCcw, Star } from "lucide-react";
import { ApiFailure, REMOTE, api, type SubmitDto } from "../api";
import { BackButton, Bubble, Button, Mascot, Notice, SkyBackdrop, StarCount } from "../components/ui";
import Memory from "../games/Memory";
import Paint from "../games/Paint";
import Quiz from "../games/Quiz";
import { BADGES, LEVELS, bandFor, fromServerQuestions, groupOf, makeDiscover, makeMath, makeVocab, totalStars } from "../data";
import { useApp, type CompletionResult } from "../store";
import type { Mood, Question } from "../types";

export default function Activity() {
  const { state, go, openLevel, complete, refresh } = useApp();
  const level = LEVELS.find((l) => l.id === state.levelId) ?? LEVELS[0];
  const band = bandFor(groupOf(state.profile), level.id);
  const idle: Mood = band === "hard" ? "motive" : level.kind === "vocab" || level.kind === "discover" ? "curieux" : level.kind === "paint" ? "joyeux" : "concentre";
  const [mood, setMood] = useState<Mood | null>(null);
  const [round, setRound] = useState(0);
  const [say, setSay] = useState("Tu peux le faire !");
  const [result, setResult] = useState<{ stars: number; r: CompletionResult } | null>(null);
  // ---- Remote mode: the server creates the attempt, checks every answer and computes stars/rewards ----
  const [attempt, setAttempt] = useState<{ id: string; questions?: Question[]; pairs?: number; minCells?: number } | null>(null);
  const [loadErr, setLoadErr] = useState<{ code: string; message: string } | null>(null);
  const [subErr, setSubErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const group = groupOf(state.profile);
  const activityId = `l${level.id}-${level.kind}-${group}`;
  useEffect(() => {
    if (!REMOTE || !state.childId) return;
    let alive = true;
    setAttempt(null); setLoadErr(null); setResult(null); setSubErr(null);
    api<{ attemptId: string; questions?: { id: string; prompt: string; sub?: string; options: { id: string; label: string; icon?: string }[] }[]; config?: { pairs?: number; minCells?: number } }>("POST", `/children/${state.childId}/activities/${activityId}/start`)
      .then((r) => { if (alive) setAttempt({ id: r.attemptId, questions: r.questions ? fromServerQuestions(r.questions) : undefined, pairs: r.config?.pairs, minCells: r.config?.minCells }); })
      .catch((e) => { if (alive) setLoadErr(e instanceof ApiFailure ? { code: e.code, message: e.message } : { code: "ERROR", message: "Une erreur est survenue." }); });
    return () => { alive = false; };
  }, [activityId, round, state.childId]);
  const remoteCheck = async (qid: string, optionId: string) => (await api<{ correct: boolean }>("POST", `/attempts/${attempt!.id}/answer`, { questionId: qid, optionId })).correct;
  const questions = useMemo(() => (REMOTE ? [] : level.kind === "vocab" ? makeVocab(band) : level.kind === "math" ? makeMath(band) : level.kind === "discover" ? makeDiscover() : []), [level.kind, band, round]);

  async function finishRemote(raw?: { moves?: number; cells?: number }) {
    if (!attempt || submitting) return;
    setSubmitting(true); setSubErr(null);
    try {
      const r = await api<SubmitDto>("POST", `/activities/${activityId}/submit`, { attemptId: attempt.id, ...raw });
      setResult({ stars: r.stars, r: { delta: r.deltaStars, bonus: r.dailyBonus, newBadges: r.newRewards, total: r.totalStars } });
      await refresh();
    } catch (e) { setSubErr(e instanceof Error ? e.message : "Erreur réseau"); }
    finally { setSubmitting(false); }
  }
  function finish(mistakes: number, raw?: { moves?: number; cells?: number }) {
    if (REMOTE) return void finishRemote(raw);
    const stars = Math.max(1, 3 - Math.min(2, mistakes >= 4 ? 2 : mistakes >= 2 ? 1 : 0));
    setResult({ stars, r: complete(level.id, stars) });
  }
  const retry = () => { setResult(null); setRound((n) => n + 1); setSay("On recommence, tu vas y arriver !"); };
  const hasNext = level.id < LEVELS.length;

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <SkyBackdrop hills={false} />
      <div className="relative z-10 px-5 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <BackButton onClick={() => go("map")} label="Retour au parcours" />
          <div className="text-center"><p className="text-xs font-extrabold text-teal-dark/80">{level.title}</p><h1 className="text-lg font-black text-teal-dark">{level.sub}</h1></div>
          <StarCount n={totalStars(state.progress)} />
        </div>

        {REMOTE && !result && !attempt && (
          <div className="mt-6 text-center">
            <Mascot mood={loadErr ? "encourageant" : idle} className="mx-auto w-32" />
            <div className="-mt-2 rounded-[28px] bg-cream p-5 shadow-card">
              {loadErr
                ? <><Notice kind="error">{loadErr.code === "LEVEL_LOCKED" ? "Ce niveau est verrouillé : termine d'abord le niveau précédent." : loadErr.message}</Notice>
                    <div className="mt-4 grid gap-2">{loadErr.code !== "LEVEL_LOCKED" && <Button onClick={retry}>Réessayer</Button>}<Button tone="white" onClick={() => go("map")}>Retour au parcours</Button></div></>
                : <p className="font-extrabold text-teal-dark" role="status">Je prépare ton activité…</p>}
            </div>
          </div>
        )}
        {!result && (!REMOTE || attempt) && (
          <>
            <div className="mt-2 flex items-end gap-2">
              <Mascot mood={mood ?? idle} bob={mood === "bravo"} className="w-24 shrink-0" />
              <Bubble className="mb-10 flex-1" key={say}>{say}</Bubble>
            </div>
            <div className="-mt-1 rounded-[32px] bg-cream p-5 shadow-card">
              {subErr && <div className="mb-3"><Notice kind="error">{subErr}</Notice></div>}
              {(level.kind === "vocab" || level.kind === "math" || level.kind === "discover") && <Quiz key={`${round}-${attempt?.id ?? "local"}`} band={band} audio={state.prefs?.audio !== false} questions={REMOTE ? attempt?.questions ?? [] : questions} check={REMOTE ? remoteCheck : undefined} onError={setSubErr} onSay={(m, md) => { setSay(m); setMood(md ?? null); }} onDone={finish} />}
              {level.kind === "memory" && <Memory key={`${round}-${attempt?.id ?? "local"}`} band={band} pairs={attempt?.pairs} onSay={(m, md) => { setSay(m); setMood(md ?? null); }} onDone={finish} />}
              {level.kind === "paint" && <Paint key={`${round}-${attempt?.id ?? "local"}`} onSay={(m, md) => { setSay(m); setMood(md ?? null); }} onDone={finish} />}
            </div>
          </>
        )}

        {result && (
          <div className="pop mt-4 text-center">
            <Mascot mood="bravo" className="mx-auto w-40" />
            <div className="-mt-3 rounded-[32px] bg-cream p-6 shadow-soft">
              <h2 className="text-3xl font-black text-teal-dark">{result.stars === 3 ? "Magnifique !" : "Bien joué !"}</h2>
              <div className="my-3 flex justify-center gap-2">{[1, 2, 3].map((n) => <Star key={n} size={52} style={{ animationDelay: `${n * 160}ms` }} className={`pop ${n <= result.stars ? "fill-sun text-sun" : "fill-black/10 text-black/10"}`} />)}</div>
              <p className="font-extrabold text-[#4b625e]">{result.r.delta > 0 ? `+${result.r.delta} étoile(s) ajoutée(s) · total ${result.r.total}` : `Tu connais déjà bien ce niveau · total ${result.r.total}`}</p>
              {result.r.bonus && <p className="mt-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm font-extrabold text-[#9a6412]">Défi du jour réussi : +1 étoile bonus !</p>}
              {result.r.newBadges.length > 0 && <p className="mt-2 rounded-2xl bg-grape-soft px-3 py-2 text-sm font-extrabold text-[#6a4f8c]">Nouveau badge : {result.r.newBadges.map((b) => BADGES.find((x) => x.id === b)?.title).join(", ")}</p>}
              <p className="mt-2 text-sm font-semibold text-[#6b7f7b]">Chaque essai te fait grandir.</p>
              <div className="mt-5 grid gap-3">
                {hasNext ? <Button size="lg" onClick={() => openLevel(level.id + 1)}>Activité suivante <ArrowRight size={22} strokeWidth={3} /></Button> : <Button size="lg" onClick={() => go("progress")}>Voir mes récompenses</Button>}
                <div className="grid grid-cols-2 gap-3"><Button tone="white" onClick={retry}><RotateCcw size={18} /> Rejouer</Button><Button tone="white" onClick={() => go("map")}><MapIcon size={18} /> Parcours</Button></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
