import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Home, Inbox, Loader2, Map as MapIcon, Star, Trophy, XCircle, type LucideIcon } from "lucide-react";
import logoImg from "../assets/logo.png";
import hello from "../assets/mascot/hello.png";
import joyeux from "../assets/mascot/joyeux.png";
import encourageant from "../assets/mascot/encourageant.png";
import curieux from "../assets/mascot/curieux.png";
import motive from "../assets/mascot/motive.png";
import bravo from "../assets/mascot/bravo.png";
import concentre from "../assets/mascot/concentre.png";
import assis from "../assets/mascot/assis.png";
import lecture from "../assets/mascot/lecture.png";
import salut from "../assets/mascot/salut.png";
import fete from "../assets/mascot/fete.png";
import { BraidPath } from "./Weave";
import type { Mood } from "../types";

/** The original NASJ logo, extracted from the brand reference. */
export const Logo = ({ className = "h-16" }: { className?: string }) => (
  <img src={logoImg} alt="NASJ – نسج" className={`${className} w-auto select-none`} draggable={false} />
);

const MOODS: Record<Mood, { src: string; alt: string }> = {
  hello: { src: hello, alt: "Le personnage NASJ te salue" },
  joyeux: { src: joyeux, alt: "Le personnage NASJ, joyeux" },
  encourageant: { src: encourageant, alt: "Le personnage NASJ t'encourage" },
  curieux: { src: curieux, alt: "Le personnage NASJ, curieux" },
  motive: { src: motive, alt: "Le personnage NASJ, motivé" },
  bravo: { src: bravo, alt: "Le personnage NASJ te dit bravo" },
  concentre: { src: concentre, alt: "Le personnage NASJ, concentré" },
  assis: { src: assis, alt: "Le personnage NASJ, assis, te fait coucou" },
  lecture: { src: lecture, alt: "Le personnage NASJ lit un livre" },
  salut: { src: salut, alt: "Le personnage NASJ, souriant" },
  fete: { src: fete, alt: "Le personnage NASJ tient une étoile" },
};
/** ONE character, several expressions: every image is cut from the original NASJ reference sheets. */
export const Mascot = ({ mood = "joyeux", className = "w-32", bob = true, flip = false }: { mood?: Mood; className?: string; bob?: boolean; flip?: boolean }) => (
  <img src={MOODS[mood].src} alt={MOODS[mood].alt} draggable={false} className={`${className} h-auto select-none ${bob ? "bob" : ""} ${flip ? "-scale-x-100" : ""}`} />
);

export const Bubble = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`relative rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-teal-dark shadow-soft ${className}`}>{children}</div>
);

/* ------------------------------------------------------------------ buttons & inputs */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "teal" | "white" | "sun" | "coral"; size?: "md" | "lg"; loading?: boolean };
export function Button({ tone = "teal", size = "md", loading, className = "", children, disabled, ...p }: BtnProps) {
  const t = { teal: "bg-teal text-white", white: "bg-white text-teal-dark border-2 border-teal/30", sun: "bg-sun text-white", coral: "bg-coral text-white" }[tone];
  return (
    <button {...p} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`${t} ${size === "lg" ? "py-4 text-lg" : "py-3 text-base"} flex items-center justify-center gap-2 rounded-pill px-6 font-extrabold shadow-pop transition active:translate-y-0.5 active:shadow-none disabled:pointer-events-none disabled:opacity-50 ${className}`}>
      {loading && <Loader2 size={20} className="animate-spin" aria-hidden />}{children}
    </button>
  );
}

export const BackButton = ({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) => (
  <button onClick={onClick} aria-label={label} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-teal-dark shadow-soft active:scale-95">
    <ArrowLeft size={22} strokeWidth={3} />
  </button>
);

/** Top bar used by inner screens: back button, centered title, optional right slot. */
export const ScreenHeader = ({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) => (
  <header className="flex items-center gap-3">
    {onBack ? <BackButton onClick={onBack} /> : <span className="w-11" />}
    <div className="min-w-0 flex-1 text-center">{subtitle && <p className="truncate text-xs font-extrabold uppercase tracking-wider text-teal-dark/70">{subtitle}</p>}<h1 className="truncate text-xl font-black text-teal-dark">{title}</h1></div>
    <div className="flex min-w-[2.75rem] justify-end">{right}</div>
  </header>
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> { label: string; icon?: LucideIcon; error?: string | null; hint?: string }
/** Labelled input with icon and inline error. Scrolls into view on focus so the keyboard never hides it. */
export function Field({ label, icon: Icon, error, hint, className = "", ...p }: FieldProps) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-extrabold text-ink">{label}</label>
      <div className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 transition focus-within:ring-2 ${error ? "ring-coral" : "ring-teal/25 focus-within:ring-teal"}`}>
        {Icon && <Icon size={20} className="shrink-0 text-teal" aria-hidden />}
        <input id={id} {...p} onFocus={(e) => { p.onFocus?.(e); window.setTimeout(() => e.target.scrollIntoView?.({ block: "center", behavior: "smooth" }), 250); }}
          aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className={`w-full min-w-0 bg-transparent text-base font-bold text-ink outline-none placeholder:font-semibold placeholder:text-[#9aaba7] ${className}`} />
      </div>
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-xs font-bold text-[#c0484d]">{error}</p> : hint ? <p className="mt-1 text-xs font-semibold text-mute">{hint}</p> : null}
    </div>
  );
}
/** Password input with a working show/hide control. */
export function PasswordField(props: Omit<FieldProps, "type">) {
  const [show, setShow] = useState(false);
  const id = useId();
  const { label, icon: Icon, error, hint, ...rest } = props;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-extrabold text-ink">{label}</label>
      <div className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 transition focus-within:ring-2 ${error ? "ring-coral" : "ring-teal/25 focus-within:ring-teal"}`}>
        {Icon && <Icon size={20} className="shrink-0 text-teal" aria-hidden />}
        <input id={id} {...rest} type={show ? "text" : "password"} aria-invalid={!!error} onFocus={(e) => { rest.onFocus?.(e); window.setTimeout(() => e.target.scrollIntoView?.({ block: "center", behavior: "smooth" }), 250); }}
          className="w-full min-w-0 bg-transparent text-base font-bold text-ink outline-none placeholder:font-semibold placeholder:text-[#9aaba7]" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Cacher le mot de passe" : "Montrer le mot de passe"} aria-pressed={show} className="shrink-0 text-teal">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
      </div>
      {error ? <p role="alert" className="mt-1 text-xs font-bold text-[#c0484d]">{error}</p> : hint ? <p className="mt-1 text-xs font-semibold text-mute">{hint}</p> : null}
    </div>
  );
}

export const StarCount = ({ n }: { n: number }) => (
  <div className="flex items-center gap-1.5 rounded-pill bg-white/90 px-3 py-1.5 text-base font-black text-[#b86a14] shadow-soft" aria-label={`${n} étoiles`}>
    <Star size={20} className="fill-sun text-sun" /> {n}
  </div>
);

export const Notice = ({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) => (
  <div role={kind === "error" ? "alert" : "status"} className={`rise flex items-start gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold ${kind === "ok" ? "bg-teal-soft text-teal-dark" : "bg-coral-soft text-[#a83f44]"}`}>
    {kind === "ok" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />} <span>{children}</span>
  </div>
);

export const ProgressBar = ({ value, className = "" }: { value: number; className?: string }) => (
  <div className={`h-3 overflow-hidden rounded-full bg-black/10 ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full rounded-full bg-gradient-to-r from-teal via-sun to-coral transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

/** Friendly loading / error / empty states with a recovery action. */
export function StateCard({ kind, title, text, action, mood }: { kind: "loading" | "error" | "empty"; title: string; text?: string; action?: ReactNode; mood?: Mood }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "empty" ? Inbox : Loader2;
  return (
    <div className="rounded-card bg-white p-5 text-center shadow-soft" role={kind === "error" ? "alert" : "status"}>
      {mood ? <Mascot mood={mood} className="mx-auto -mt-16 mb-1 w-24" /> : <Icon size={30} className={`mx-auto mb-2 ${kind === "loading" ? "animate-spin text-teal" : kind === "error" ? "text-coral" : "text-sun"}`} aria-hidden />}
      <p className="text-lg font-black text-teal-dark">{title}</p>
      {text && <p className="mt-1 text-sm font-semibold text-mute">{text}</p>}
      {action && <div className="mt-4 grid gap-2">{action}</div>}
    </div>
  );
}

/** Accessible confirmation dialog (focus moves into it, Escape cancels). */
export function ConfirmDialog({ title, text, confirmLabel, cancelLabel = "Annuler", danger, onConfirm, onCancel, children, busy }: {
  title: string; text?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  // Focus the dialog ONCE when it opens (re-running this on every render would steal focus from the input being typed in).
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && cancelRef.current(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/45 p-3 sm:items-center" onClick={onCancel}>
      <div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="rise mx-auto max-h-full w-full max-w-sm overflow-y-auto rounded-card bg-cream p-5 outline-none">
        <h2 className="text-xl font-black text-teal-dark">{title}</h2>
        {text && <p className="mt-1 text-sm font-semibold text-ink/80">{text}</p>}
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button tone="white" onClick={onCancel}>{cancelLabel}</Button>
          <Button tone={danger ? "coral" : "teal"} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ decoration */
export const Yarn = ({ d, color, w = 7 }: { d: string; color: string; w?: number }) => (
  <g fill="none" strokeLinecap="round">
    <path d={d} stroke={color} strokeWidth={w} />
    <path d={d} stroke="#000" strokeOpacity=".15" strokeWidth={w} strokeDasharray="1.5 6" />
    <path d={d} stroke="#fff" strokeOpacity=".4" strokeWidth={w * 0.26} transform="translate(-1 -1.4)" />
  </g>
);
export const PALETTE = ["#2E9185", "#F39A9B", "#F6BB48", "#9B7FC8", "#BDE8FA", "#F6C6D0"];

/** Rolling hills made of yarn: soft green layers with braided strands and small flowers (SVG, no raster). */
export function YarnHills({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${className}`} viewBox="0 0 400 190" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M0 70 C70 20 150 60 230 40 S350 20 400 55 V190 H0Z" fill="#cfe9b8" />
      <path d="M0 105 C90 70 170 118 260 92 S360 80 400 100 V190 H0Z" fill="#B7DCA1" />
      <path d="M0 140 C100 112 190 150 280 128 S370 120 400 134 V190 H0Z" fill="#9ccf86" />
      <BraidPath a={{ x: -10, y: 120 }} b={{ x: 410, y: 98 }} c1={{ x: 120, y: 78 }} c2={{ x: 280, y: 150 }} colors={["#2E9185", "#F39A9B", "#F6BB48"]} w={7} />
      <BraidPath a={{ x: -10, y: 160 }} b={{ x: 410, y: 150 }} c1={{ x: 130, y: 128 }} c2={{ x: 290, y: 182 }} colors={["#9B7FC8", "#BDE8FA", "#F39A9B"]} w={6} />
      {[[40, 128, "#F39A9B"], [78, 150, "#fff"], [330, 124, "#F6BB48"], [362, 152, "#F39A9B"], [210, 168, "#fff"]].map(([x, y, c], i) => (
        <g key={i}><circle cx={x as number} cy={y as number} r="5" fill={c as string} /><circle cx={x as number} cy={y as number} r="2" fill="#F6BB48" /></g>
      ))}
    </svg>
  );
}

/** Soft sky, fluffy clouds and (optionally) the yarn hills. */
export function SkyBackdrop({ hills = true }: { hills?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#a9dcf5] via-sky to-[#e9f7fc]" aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        {[[60, 90, 1], [335, 150, 1.2], [80, 330, .9], [350, 440, .8]].map(([x, y, s], i) => (
          <g key={i} fill="#fff" opacity=".93" transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx="0" cy="0" rx="46" ry="20" /><ellipse cx="-26" cy="8" rx="30" ry="16" /><ellipse cx="28" cy="8" rx="34" ry="16" /><ellipse cx="2" cy="-14" rx="26" ry="18" />
          </g>
        ))}
      </svg>
      {hills && <YarnHills className="h-[30%] min-h-[150px]" />}
    </div>
  );
}

/* ------------------------------------------------------------------ navigation */
type Tab = "dashboard" | "map" | "progress";
/** Bottom tab bar. It is a flex child of MainScreen (never inside the scroller), so it always sits at the bottom edge. */
export function BottomNav({ active, onGo }: { active?: Tab; onGo: (s: Tab) => void }) {
  const items: [Tab, string, typeof Home][] = [["dashboard", "Accueil", Home], ["map", "Parcours", MapIcon], ["progress", "Récompenses", Trophy]];
  return (
    <nav className="relative z-20 flex shrink-0 justify-around gap-1 rounded-t-[26px] bg-white px-3 pb-3 pt-2 shadow-[0_-6px_20px_rgba(23,107,99,.18)]" aria-label="Navigation principale">
      {items.map(([id, label, Icon]) => (
        <button key={id} onClick={() => onGo(id)} aria-current={active === id ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-extrabold transition ${active === id ? "bg-teal-soft text-teal-dark" : "text-mute"}`}>
          <Icon size={22} /> {label}
        </button>
      ))}
    </nav>
  );
}

/** Layout of the main screens: [scrollable content] + [bottom nav]. Overlays (sheets, dialogs) are siblings of the scroller. */
export function MainScreen({ active, onGo, overlay, children }: { active?: Tab; onGo: (s: Tab) => void; overlay?: ReactNode; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth" data-scroll>{children}</div>
      <BottomNav active={active} onGo={onGo} />
      {overlay}
    </div>
  );
}

/** Sky banner behind the top of a scrolling page. */
export const TopSky = ({ h = 260 }: { h?: number }) => (
  <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: h }}><SkyBackdrop hills={false} /></div>
);

/** Round profile picture made from the original mascot face (no photo of the child is ever needed). */
export const Avatar = ({ className = "h-12 w-12" }: { className?: string }) => (
  <span className={`${className} inline-block shrink-0 overflow-hidden rounded-full bg-sky-soft ring-2 ring-white`}>
    <img src={salut} alt="" draggable={false} className="h-full w-full scale-[1.25] object-cover object-[50%_35%]" />
  </span>
);
