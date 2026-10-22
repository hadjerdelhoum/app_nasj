import { useState } from "react";
import { Eraser } from "lucide-react";
import { Button, PALETTE } from "../components/ui";
import type { Mood } from "../types";

const N = 7;
export default function Paint({ onSay, onDone }: { onSay: (m: string, mood?: Mood) => void; onDone: (mistakes: number, raw?: { cells?: number }) => void }) {
  const [color, setColor] = useState(PALETTE[0]);
  const [cells, setCells] = useState<(string | null)[]>(Array(N * N).fill(null));
  const used = cells.filter(Boolean).length;
  const paint = (i: number) => { setCells((c) => c.map((v, k) => (k === i ? (v === color ? null : color) : v))); if (used === 8) onSay("Ton tissage devient magnifique !"); };
  return (
    <div>
      <p className="mb-3 text-center text-lg font-black text-teal-dark">Tisse ton motif en couleurs</p>
      <div className="mx-auto grid max-w-[320px] gap-1 rounded-3xl bg-white p-3 shadow-soft" style={{ gridTemplateColumns: `repeat(${N},1fr)` }}>
        {cells.map((c, i) => <button key={i} aria-label={c ? "Case colorée" : "Case vide"} onClick={() => paint(i)} className="aspect-square rounded-md ring-1 ring-black/5 transition active:scale-90" style={{ background: c ?? "#f3ede0" }} />)}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3" role="radiogroup" aria-label="Couleurs">
        {PALETTE.map((p) => <button key={p} role="radio" aria-checked={color === p} aria-label={`Couleur ${p}`} onClick={() => setColor(p)} className={`h-11 w-11 rounded-full shadow-pop transition ${color === p ? "scale-110 ring-4 ring-white outline outline-2 outline-teal-dark" : ""}`} style={{ background: p }} />)}
        <button aria-label="Tout effacer" onClick={() => setCells(Array(N * N).fill(null))} className="grid h-11 w-11 place-items-center rounded-full bg-white text-teal-dark shadow-pop"><Eraser size={20} /></button>
      </div>
      <Button size="lg" className="mt-5 w-full" disabled={used < 12} onClick={() => onDone(0, { cells: used })}>{used < 12 ? `Colorie encore ${12 - used} case(s)` : "J'ai fini mon tissage !"}</Button>
    </div>
  );
}
