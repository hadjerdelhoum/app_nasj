import { useEffect, useMemo, useState } from "react";
import { MEMORY_ICONS, shuffle } from "../data";
import type { Band, Mood } from "../types";

interface Card { uid: number; key: string; idx: number }
export default function Memory({ band, pairs: pairsOverride, onSay, onDone }: { band: Band; pairs?: number; onSay: (m: string, mood?: Mood) => void; onDone: (mistakes: number, raw?: { moves?: number }) => void }) {
  const pairs = pairsOverride ?? (band === "easy" ? 3 : band === "medium" ? 4 : 6);
  const cards = useMemo<Card[]>(() => shuffle(MEMORY_ICONS.slice(0, pairs).flatMap((m, idx) => [0, 1].map((k) => ({ uid: idx * 2 + k, key: m.id, idx })))), [pairs]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  function flip(uid: number) {
    if (locked || open.includes(uid) || matched.includes(cards.find((c) => c.uid === uid)!.key)) return;
    const next = [...open, uid];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1); setLocked(true);
    const [a, b] = next.map((u) => cards.find((c) => c.uid === u)!);
    if (a.key === b.key) {
      window.setTimeout(() => { setMatched((m) => [...m, a.key]); setOpen([]); setLocked(false); onSay("Une paire ! Bravo !", "bravo"); }, 450);
    } else {
      onSay("Pas la même… retiens bien !", "encourageant");
      window.setTimeout(() => { setOpen([]); setLocked(false); }, 900);
    }
  }
  useEffect(() => {
    if (matched.length === pairs) { const t = window.setTimeout(() => onDone(Math.max(0, moves - pairs - 1), { moves }), 700); return () => window.clearTimeout(t); }
  }, [matched, pairs, moves, onDone]);

  return (
    <div>
      <p className="mb-3 text-center text-lg font-black text-teal-dark">Trouve les paires identiques</p>
      <div className={`grid gap-3 ${pairs === 6 ? "grid-cols-4" : "grid-cols-4"}`}>
        {cards.map((c) => {
          const m = MEMORY_ICONS[c.idx], Icon = m.icon, shown = open.includes(c.uid) || matched.includes(c.key);
          return (
            <button key={c.uid} onClick={() => flip(c.uid)} aria-label={shown ? "Carte retournée" : "Carte cachée"} className={`aspect-square rounded-2xl shadow-pop transition active:scale-95 ${shown ? m.tone + (matched.includes(c.key) ? " pop ring-4 ring-teal/40" : "") : "bg-gradient-to-br from-teal to-[#5bb8a8] text-white"}`}>
              <span className="grid h-full w-full place-items-center">{shown ? <Icon size={34} strokeWidth={2.4} /> : <span className="text-3xl font-black opacity-80">?</span>}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm font-extrabold text-[#6b7f7b]">Paires trouvées : {matched.length} / {pairs} · Essais : {moves}</p>
    </div>
  );
}
