import { ArrowRight } from "lucide-react";
import { Button, Logo, Mascot, SkyBackdrop } from "../components/ui";
import { useApp } from "../store";

export default function Welcome() {
  const { state, go, onboarded } = useApp();
  const returning = state.authed && !!state.profile?.group;
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <SkyBackdrop />
      <div className="relative z-10 flex min-h-full flex-col items-center px-6 pb-8 pt-8 text-center">
        <div className="rise"><Logo className="h-32" /></div>
        <div className="rise relative -mb-1 mt-1 flex flex-1 items-center justify-center" style={{ animationDelay: ".1s" }}>
          <Mascot mood="assis" className="w-[58%] max-w-[240px]" />
        </div>
        <div className="rise w-full rounded-card bg-cream/95 p-5 shadow-card" style={{ animationDelay: ".2s" }}>
          <h1 className="text-[28px] font-black leading-tight text-teal-dark">Bienvenue sur NASJ !</h1>
          <p className="mx-auto mt-1 max-w-[19rem] text-base font-bold leading-snug text-mute">Ton compagnon pour apprendre, explorer et grandir.</p>
          <Button size="lg" className="mt-5 w-full" onClick={() => go(returning ? "dashboard" : onboarded ? "auth" : "onboarding")}>Commencer <ArrowRight size={22} strokeWidth={3} /></Button>
        </div>
      </div>
    </div>
  );
}
