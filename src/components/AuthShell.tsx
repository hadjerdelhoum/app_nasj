import type { ReactNode } from "react";
import { BackButton, Logo, SkyBackdrop } from "./ui";

/** Shared layout of the authentication screens: sky + yarn hills, logo, and a cream card. Scrolls when the keyboard is open. */
export function AuthShell({ title, subtitle, onBack, children }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <SkyBackdrop />
      <div className="relative z-10 flex min-h-full flex-col px-5 pb-28 pt-5">
        <div className="flex items-center justify-between">{onBack ? <BackButton onClick={onBack} /> : <span className="w-11" />}<span className="w-11" /></div>
        <div className="rise -mt-9 flex justify-center"><Logo className="h-28" /></div>
        <div className="rise mt-1 rounded-card bg-cream/95 p-5 shadow-card" style={{ animationDelay: ".08s" }}>
          <h1 className="text-center text-[28px] font-black leading-tight text-teal-dark">{title}</h1>
          {subtitle && <p className="mt-1 text-center text-sm font-bold text-mute">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** One-time recovery code panel (shown after sign-up and after a password reset). */
export function RecoveryCodePanel({ code, onDone, doneLabel }: { code: string; onDone: () => void; doneLabel: string }) {
  return <RecoveryInner code={code} onDone={onDone} doneLabel={doneLabel} />;
}
import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button, Notice } from "./ui";

function RecoveryInner({ code, onDone, doneLabel }: { code: string; onDone: () => void; doneLabel: string }) {
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: the code is selectable */ }
  }
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-teal-dark"><KeyRound size={22} /><h2 className="text-lg font-black">Ton code de récupération</h2></div>
      <p className="text-sm font-semibold text-ink/80">Si tu oublies ton mot de passe, ce code est le seul moyen de retrouver ton compte. Il ne sera <b>plus jamais affiché</b> : note-le ou prends-le en photo, et garde-le en lieu sûr.</p>
      <p data-testid="recovery-code" className="mt-3 select-all rounded-2xl bg-white px-3 py-4 text-center font-mono text-xl font-black tracking-widest text-teal-dark ring-2 ring-sun">{code}</p>
      <Button tone="white" className="mt-3 w-full" onClick={copy}>{copied ? <><Check size={18} /> Copié !</> : <><Copy size={18} /> Copier le code</>}</Button>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-extrabold text-ink">
        <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2E9185]" /> J'ai noté mon code de récupération.
      </label>
      {!noted && <div className="mt-3"><Notice kind="ok">Coche la case pour continuer.</Notice></div>}
      <Button size="lg" className="mt-4 w-full" disabled={!noted} onClick={onDone}>{doneLabel}</Button>
    </div>
  );
}
