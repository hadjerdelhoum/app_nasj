import { MainScreen, ScreenHeader, TopSky, Mascot } from "../components/ui";
import { useApp } from "../store";

const FAQ: [string, string][] = [
  ["Comment gagner des étoiles ?", "Termine une activité : tu gagnes 1 à 3 étoiles selon tes essais. Tu peux réessayer autant que tu veux, et une étoile bonus t'attend pour ta première activité de chaque jour."],
  ["Pourquoi un niveau est-il verrouillé ?", "Les niveaux se débloquent dans l'ordre : termine le niveau précédent pour ouvrir le suivant."],
  ["Comment changer de parcours (3–5 ou 5–10 ans) ?", "Dans Réglages ▸ Profil de l'enfant. Les activités s'adaptent, mais la progression, les étoiles et les badges sont conservés."],
  ["J'ai oublié mon mot de passe", "Sur l'écran de connexion, touche « Mot de passe oublié ? ». Il faut l'adresse e-mail du compte et le code de récupération donné à l'inscription."],
  ["J'ai perdu mon code de récupération", "Connecte-toi sur un appareil déjà connecté, puis Réglages ▸ Compte ▸ Nouveau code de récupération."],
  ["Quelles données NASJ garde-t-il ?", "Seulement un e-mail de parent, un prénom ou surnom pour l'enfant, sa tranche d'âge et sa progression. Aucune photo, aucun nom de famille, aucun suivi publicitaire. Le parent peut supprimer le compte et toutes les données dans Réglages."],
  ["Les mots sont-ils lus à voix haute ?", "Oui si ton appareil propose une voix : touche le haut-parleur dans une activité. Tu peux couper le son dans Réglages."],
];

export default function Help() {
  const { go } = useApp();
  return (
    <MainScreen onGo={go}>
      <div className="relative">
        <TopSky h={150} />
        <div className="relative z-10 px-5 pb-8 pt-4">
          <ScreenHeader title="Aide & FAQ" onBack={() => go("settings")} />
          <div className="mt-3 flex justify-center"><Mascot mood="curieux" className="w-24" /></div>
          <div className="mt-2 grid gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-card bg-white p-4 shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-black text-teal-dark">{q}<span aria-hidden className="text-xl text-teal transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm font-semibold leading-snug text-ink/85">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </MainScreen>
  );
}
