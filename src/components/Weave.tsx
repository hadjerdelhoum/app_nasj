import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { Level } from "../types";

/* ------------------------------------------------------------------ geometry */
export const MAP_H = 1220;
export const STEP = 205;
export const Y0 = 130;
export const NODE_X = [125, 275, 125, 275, 125];
export const nodes = NODE_X.map((x, i) => ({ x, y: Y0 + i * STEP }));
export const waypoints = [{ x: 200, y: 0 }, ...nodes, { x: 200, y: MAP_H - 80 }];
type Pt = { x: number; y: number };

const ctrl = (a: Pt, b: Pt): [Pt, Pt] => { const d = (b.y - a.y) * 0.5; return [{ x: a.x, y: a.y + d }, { x: b.x, y: b.y - d }]; };
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => { const u = 1 - t; return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }; };
export const segMid = (k: number): Pt => { const a = waypoints[k], b = waypoints[k + 1], [c1, c2] = ctrl(a, b); return bez(a, c1, c2, b, 0.5); };

function hexMix(hex: string, to: string, f: number) {
  const full = (h: string) => (h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h);
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(full(h).slice(i, i + 2), 16));
  const [a, b] = [n(hex), n(to)];
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ braided yarn */
const N = 44, W = 10, AMP = 7.5, OMEGA = (2 * Math.PI) / 46;
export const buildBraid = (segment: number) => { const a = waypoints[segment], b = waypoints[segment + 1], [c1, c2] = ctrl(a, b); return buildBraidFrom(a, b, c1, c2); };
export function buildBraidFrom(a: Pt, b: Pt, c1: Pt, c2: Pt, amp = AMP, omega = OMEGA) {
  const S: { x: number; y: number; nx: number; ny: number; s: number }[] = [];
  let s = 0, prev: Pt | null = null;
  const n = Math.min(500, Math.max(N, Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) * 1.15) / (amp > 5 ? 2 : 1.5)))); // enough samples for smooth strands on long curves
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, p = bez(a, c1, c2, b, t);
    const dx = 3 * u * u * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x);
    const dy = 3 * u * u * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y);
    const l = Math.hypot(dx, dy) || 1;
    if (prev) s += Math.hypot(p.x - prev.x, p.y - prev.y);
    S.push({ ...p, nx: -dy / l, ny: dx / l, s }); prev = p;
  }
  const strands = [0, 1, 2].map((k) => S.map((q) => { const ph = omega * q.s + (2 * Math.PI * k) / 3; return { x: q.x + q.nx * amp * Math.sin(ph), y: q.y + q.ny * amp * Math.sin(ph), bin: Math.cos(ph) < -0.34 ? 0 : Math.cos(ph) < 0.34 ? 1 : 2 }; }));
  const runs: { k: number; pass: number; d: string }[] = [];
  for (let pass = 0; pass < 3; pass++) for (let k = 0; k < 3; k++) {
    let run: Pt[] = [];
    const flush = () => { if (run.length > 1) runs.push({ k, pass, d: "M" + run.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L") }); run = []; };
    strands[k].forEach((q, i) => {
      if (q.bin === pass) { if (!run.length && i > 0) run.push(strands[k][i - 1]); run.push(q); }
      else if (run.length) { run.push(q); flush(); }
    });
    flush();
  }
  const center = "M" + S.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L");
  return { runs, center };
}

export const LIVE_COLORS: [string, string, string][] = [
  ["#2f8f83", "#f48a8a", "#f7a93b"], ["#9b7fc8", "#2f8f83", "#f48a8a"], ["#f7a93b", "#9b7fc8", "#7cc4ee"],
  ["#f48a8a", "#7cc4ee", "#2f8f83"], ["#f7a93b", "#2f8f83", "#9b7fc8"], ["#f48a8a", "#f7a93b", "#9b7fc8"],
];
const MUTED: [string, string, string] = ["#d6cfc1", "#c6bdac", "#e0d9cb"];

/** One braided connection (3 interlaced strands) between two waypoints. */
export function Braid({ segment, live }: { segment: number; live: boolean }) {
  const colors = live ? LIVE_COLORS[segment % LIVE_COLORS.length] : MUTED;
  return <BraidShape data={buildBraid(segment)} colors={colors} w={W} />;
}
/** A braided yarn along any cubic Bézier curve (used for decorations). */
export function BraidPath({ a, b, c1, c2, colors, w = 7 }: { a: Pt; b: Pt; c1: Pt; c2: Pt; colors: [string, string, string]; w?: number }) {
  return <BraidShape data={buildBraidFrom(a, b, c1, c2, w * 0.75, (2 * Math.PI) / (w * 4.6))} colors={colors} w={w} />;
}
function BraidShape({ data, colors, w }: { data: ReturnType<typeof buildBraidFrom>; colors: [string, string, string]; w: number }) {
  const { runs, center } = data;
  return (
    <g>
      <path d={center} fill="none" stroke="#5a4630" strokeOpacity=".16" strokeWidth={w * 2.3} strokeLinecap="round" transform="translate(0 5)" />
      {runs.map((r, i) => (
        <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={r.d} stroke={hexMix(colors[r.k], "#000000", 0.38)} strokeWidth={w + 3} />
          <path d={r.d} stroke={colors[r.k]} strokeWidth={w} />
          <path d={r.d} stroke={hexMix(colors[r.k], "#ffffff", 0.5)} strokeOpacity=".85" strokeWidth={w * 0.26} transform="translate(-1.2 -1.6)" />
        </g>
      ))}
    </g>
  );
}

/** Decorative "marbouta" knot: three interlaced loops (woven over/under), a bead and two tails. */
export function Knot({ x, y, live, scale = 1 }: { x: number; y: number; live: boolean; scale?: number }) {
  const c = live ? ["#f7a93b", "#f48a8a", "#2f8f83"] : ["#cfc6b6", "#bdb3a1", "#d9d1c3"];
  const loop = (rot: number, col: string, key: string) => (
    <g key={key} transform={`rotate(${rot})`} fill="none"><ellipse rx="20" ry="8.5" stroke={hexMix(col, "#000", .35)} strokeWidth="9.5" /><ellipse rx="20" ry="8.5" stroke={col} strokeWidth="6.5" /><ellipse rx="20" ry="8.5" stroke="#fff" strokeOpacity=".4" strokeWidth="1.6" transform="translate(-1 -1.5)" /></g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="16" rx="24" ry="5" fill="#000" opacity=".14" />
      <path d="M-6 8 Q-14 24 -26 26" stroke={c[0]} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M6 8 Q14 24 26 24" stroke={c[1]} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      {loop(0, c[0], "a")}{loop(60, c[1], "b")}{loop(120, c[2], "c")}
      <path d="M-20 0 A20 8.5 0 0 1 -10 -7.4" stroke={c[0]} strokeWidth="6.5" fill="none" strokeLinecap="round" />
      <circle r="6.5" fill="#fffaf0" stroke={hexMix(c[0], "#000", .3)} strokeWidth="2" /><circle r="2.6" fill={c[1]} />
    </g>
  );
}

/** Embroidered cross-stitch side borders. */
export function StitchBorder({ h }: { h: number }) {
  const cols = ["#2f8f83", "#f48a8a", "#f7a93b", "#9b7fc8"];
  const cells: ReactNode[] = [];
  for (let i = 0; i * 17 < h; i++) for (const [side, x] of [[0, 4], [1, 388]] as const) {
    const c = cols[(i + side) % 4], y = i * 17 + 4, o = i % 2 ? 0 : 0;
    cells.push(<g key={`${i}-${side}`} fill={c}><rect x={x + o} y={y + 3} width="8" height="3.4" rx="1.7" /><rect x={x + 2.3 + o} y={y} width="3.4" height="9" rx="1.7" /></g>);
  }
  return <g opacity=".85">{cells}</g>;
}

/* ------------------------------------------------------------------ medallions */
const poly = (n: number, ro: number, ri: number, rot: number) => "M" + Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = rot + (Math.PI * i) / n; return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`; }).join(" L") + "Z";
const scallop = (k: number, base: number, amp: number) => "M" + Array.from({ length: 96 }, (_, i) => { const a = (2 * Math.PI * i) / 96, r = base + amp * Math.cos(k * a); return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`; }).join(" L") + "Z";
const SHAPES = [
  scallop(10, 45, 4.5),
  poly(3, 50, 50, -Math.PI / 2),
  poly(2, 55, 55, -Math.PI / 2),
  "M36 10 H84 Q110 10 110 36 V84 Q110 110 84 110 H36 Q10 110 10 84 V36 Q10 10 36 10 Z",
  poly(8, 54, 41, -Math.PI / 2),
];
const TONES = [["#59c1b0", "#2f8f83"], ["#ffcb70", "#f2a032"], ["#bda3e6", "#8a6bbf"], ["#ffa6a6", "#e9706f"], ["#86cbf0", "#3b8fc0"]];
const MUTED_TONE = ["#e3ddd0", "#c7beae"];

export type NodeState = "done" | "current" | "locked";

/** Woven padlock for locked levels. */
export const WovenLock = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 46" className={className} aria-hidden>
    <defs><pattern id="wv" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a39a8a" /><rect width="3" height="3" fill="#c2b9a8" /><rect x="3" y="3" width="3" height="3" fill="#c2b9a8" /></pattern></defs>
    <path d="M11 20 V14 a9 9 0 0 1 18 0 V20" fill="none" stroke="#8d8474" strokeWidth="5.5" strokeLinecap="round" />
    <path d="M11 20 V14 a9 9 0 0 1 18 0 V20" fill="none" stroke="#b9b09f" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 3" />
    <rect x="5" y="19" width="30" height="24" rx="7" fill="url(#wv)" stroke="#8d8474" strokeWidth="2.5" />
    <circle cx="20" cy="29.5" r="3.4" fill="#f6efe2" /><rect x="18.7" y="30" width="2.6" height="7" rx="1.3" fill="#f6efe2" />
  </svg>
);

export function Medallion({ level, state, stars = 0 }: { level: Level; state: NodeState; stars?: number }) {
  const i = level.id - 1, shape = SHAPES[i], Icon = level.icon, id = `m${level.id}${state}`;
  const tone = state === "locked" ? MUTED_TONE : TONES[i];
  const stitch = state === "done" ? ["#f7c04a", "#fff0c4", "#e8932a"] : state === "current" ? ["#f48a8a", "#f7a93b", "#2f8f83"] : ["#cfc6b6", "#bdb3a1", "#dbd4c6"];
  const inner = "translate(60 60) scale(.8) translate(-60 -60)", inner2 = "translate(60 60) scale(.66) translate(-60 -60)";
  return (
    <span className="relative block w-full">
      <svg viewBox="0 0 120 124" className="block h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone[0]} /><stop offset="1" stopColor={tone[1]} /></linearGradient>
          <filter id={`b${id}`}><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {state === "current" && <circle className="spin-slow" cx="60" cy="60" r="60" fill="none" stroke="#f48a8a" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="14 9" style={{ transformOrigin: "60px 60px" }} />}
        {state === "current" && <circle className="spin-rev" cx="60" cy="60" r="56" fill="none" stroke="#9b7fc8" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 12" style={{ transformOrigin: "60px 60px" }} />}
        <ellipse cx="62" cy="114" rx="40" ry="6" fill="#4a3a28" opacity=".22" filter={`url(#b${id})`} />
        <path d={shape} transform="translate(0 4)" fill="#4a3a28" opacity=".22" filter={`url(#b${id})`} />
        {/* felt rim + coloured stitches */}
        <path d={shape} fill="#fffaf0" stroke="#fffaf0" strokeWidth="9" strokeLinejoin="round" />
        {[0, 1, 2].map((k) => <path key={k} d={shape} fill="none" stroke={stitch[k]} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 12" strokeDashoffset={-k * 6} />)}
        {/* embroidered body */}
        <path d={shape} transform={inner} fill={`url(#g${id})`} stroke={hexMix(tone[1], "#000", .25)} strokeWidth="2.4" strokeLinejoin="round" />
        <path d={shape} transform={inner2} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.2 3.6" />
        <path d={shape} transform="translate(60 60) scale(.8) translate(-60 -60)" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeDasharray="30 200" strokeLinecap="round" />
        {/* level number */}
        <g transform="translate(20 20)">
          <circle r="14" fill="#fffaf0" stroke={state === "done" ? "#e8a92e" : tone[1]} strokeWidth="3.2" />
          <circle r="10.2" fill="none" stroke={state === "done" ? "#f7c04a" : tone[0]} strokeWidth="1.4" strokeDasharray="2 2.6" />
          <text textAnchor="middle" y="5.6" fontSize="16" fontWeight="900" fontFamily="Nunito, sans-serif" fill={state === "locked" ? "#8d8474" : "#24413d"}>{level.id}</text>
        </g>
        {state === "done" && (
          <g>
            <path transform="translate(100 18) scale(.5)" d="M0 -16 L4.6 -5 L16 -4.4 L7.2 3 L10 14 L0 8 L-10 14 L-7.2 3 L-16 -4.4 L-4.6 -5Z" fill="#f7c04a" stroke="#e8932a" strokeWidth="2.4" strokeLinejoin="round" />
            <g transform="translate(98 100) scale(.55)"><path d="M-14 4 Q-8 -8 0 0 Q8 8 14 -4" stroke="#e8932a" strokeWidth="6" fill="none" strokeLinecap="round" /><circle r="6" fill="#f7c04a" stroke="#fffaf0" strokeWidth="2.5" /></g>
          </g>
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center pb-[4%] text-white">
        {state === "locked" ? <WovenLock className="h-[46%] w-[46%]" /> : <Icon className="h-[40%] w-[40%] drop-shadow-[0_2px_2px_rgba(0,0,0,.25)]" strokeWidth={2.4} />}
      </span>
    </span>
  );
}

export const StarsRow = ({ n, size = 16 }: { n: number; size?: number }) => (
  <span className="flex justify-center gap-0.5" aria-label={`${n} étoiles sur 3`}>
    {[1, 2, 3].map((s) => <Star key={s} size={size} className={s <= n ? "fill-sun text-sun drop-shadow" : "fill-black/10 text-black/10"} />)}
  </span>
);
