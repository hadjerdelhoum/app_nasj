import { useApp } from "./store";
import Activities from "./screens/Activities";
import Activity from "./screens/Activity";
import Auth from "./screens/Auth";
import Dashboard from "./screens/Dashboard";
import LearningMap from "./screens/LearningMap";
import PathSelect from "./screens/PathSelect";
import Help from "./screens/Help";
import Me from "./screens/Me";
import Onboarding from "./screens/Onboarding";
import Profile from "./screens/Profile";
import Recover from "./screens/Recover";
import Register from "./screens/Register";
import Settings from "./screens/Settings";
import Rewards from "./screens/Rewards";
import Welcome from "./screens/Welcome";
import { Button, Mascot, SkyBackdrop, Yarn } from "./components/ui";

export default function App() {
  const { state, status, retry, logout } = useApp();
  const screens = { welcome: Welcome, onboarding: Onboarding, auth: Auth, register: Register, recover: Recover, profile: Profile, path: PathSelect, dashboard: Dashboard, map: LearningMap, activities: Activities, activity: Activity, progress: Rewards, me: Me, settings: Settings, help: Help };
  const Screen = screens[state.screen];
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden md:p-4">
      {/* Desktop surround: sky + threads */}
      <svg className="absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Yarn d="M-20 200 C200 120 300 320 520 240 S820 90 1040 200" color="#2f8f83" w={8} />
        <Yarn d="M-20 640 C180 520 380 760 600 660 S900 520 1040 640" color="#f48a8a" w={8} />
        <Yarn d="M140 -20 C80 200 260 330 170 560 S60 740 150 840" color="#f7a93b" w={7} />
        <Yarn d="M880 -20 C940 200 790 320 890 520 S980 720 860 840" color="#9b7fb8" w={7} />
      </svg>
      <main className="relative h-full w-full max-w-[460px] overflow-hidden bg-cream md:h-[min(920px,calc(100dvh-32px))] md:rounded-[38px] md:shadow-[0_24px_70px_rgba(30,90,110,.35)]">
        {status === "ready" ? <Screen key={state.screen} /> : (
          <div className="absolute inset-0"><SkyBackdrop />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <Mascot mood={status === "error" ? "encourageant" : "hello"} className="w-40" />
              {status === "loading" ? <p className="rounded-2xl bg-white/90 px-4 py-2 font-extrabold text-teal-dark" role="status">Je retrouve ta progression…</p> : (
                <div className="rounded-3xl bg-cream p-5 shadow-soft"><p className="font-extrabold text-teal-dark">Impossible de joindre le serveur NASJ.</p><p className="mt-1 text-sm font-semibold text-[#5f7470]">Ta progression est en sécurité. Vérifie ta connexion puis réessaie.</p>
                  <div className="mt-4 grid gap-2"><Button onClick={retry}>Réessayer</Button><Button tone="white" onClick={() => void logout()}>Se déconnecter</Button></div></div>)}
            </div></div>)}
      </main>
    </div>
  );
}
