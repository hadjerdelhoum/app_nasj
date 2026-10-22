// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { AppProvider } from "../src/store";
import { LEVELS, bandFor, groupFromAge, makeMath, makeVocab } from "../src/data";

const mount = () => render(<AppProvider><App /></AppProvider>);
const saved = () => JSON.parse(localStorage.getItem("nasj-demo-v1")!);

async function playQuiz(u: ReturnType<typeof userEvent.setup>) {
  for (let n = 0; n < 5; n++) {
    const opts = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed") && !b.hasAttribute("disabled"));
    for (let k = 0; k < 4; k++) {
      if (screen.queryByRole("button", { name: /Suivant|Terminer/ })) break;
      const o = opts()[k % Math.max(1, opts().length)];
      await u.click(o);
      await u.click(screen.getByRole("button", { name: "Valider" }));
    }
    await u.click(await screen.findByRole("button", { name: /Suivant|Terminer/ }));
  }
}

describe("NASJ demo", () => {
  it("full journey: welcome → auth → profile → path → parcours → quiz → rewards → back to welcome, progress kept", async () => {
    localStorage.clear();
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByRole("button", { name: /Commencer/ }));
    await screen.findByText("Apprendre en s'amusant !"); // first launch: onboarding
    await u.click(screen.getByRole("button", { name: "Suivant" })); await u.click(screen.getByRole("button", { name: "Suivant" }));
    await u.click(screen.getByRole("button", { name: "C'est parti !" }));
    await u.type(screen.getByPlaceholderText(/Identifiant/), "parent@test.fr");
    await u.type(screen.getByLabelText("Mot de passe"), "abcd");
    await u.click(screen.getAllByRole("button", { name: "Se connecter" }).at(-1)!);
    await waitFor(() => screen.getByText("Ton profil"), { timeout: 3000 });
    await u.type(screen.getByLabelText(/prénom/i), "Lina");
    await u.click(screen.getByRole("button", { name: /Continuer/ }));
    // path selection: exactly two cards
    await screen.findByText("Choisis ton parcours !");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("Petits explorateurs")).toBeTruthy();
    await u.click(screen.getByRole("radio", { name: /5–10 ans/ }));
    await u.click(screen.getByRole("button", { name: /Voir mes 5 niveaux/ }));
    // parcours: level 1 current, others locked
    await screen.findByText("Mon parcours");
    expect(saved().profile.group).toBe("5-10");
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav.closest("[data-scroll]")).toBeNull(); // nav is never inside the scroller
    expect(within(nav).getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Accueil", "Parcours", "Récompenses"]);
    const lvl3 = screen.getByRole("button", { name: /Niveau 3.*Verrouillé/ });
    expect(lvl3.getAttribute("aria-disabled")).toBe("true");
    await u.click(lvl3);
    expect(await screen.findByText(/termine d'abord le niveau 2/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Commencer$/ })).toBeNull();
    await u.click(screen.getByRole("button", { name: "Fermer" }));
    // open level 1 detail and play
    await u.click(screen.getByRole("button", { name: /Niveau 1.*en cours/ }));
    expect(await screen.findByText(/Difficulté/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /^Commencer$/ }));
    await playQuiz(u);
    await screen.findAllByText(/étoile/);
    expect(saved().progress.levelStars[1]).toBeGreaterThan(0);
    await u.click(screen.getByRole("button", { name: /Parcours/ }));
    await screen.findByText("Mon parcours");
    // level 2 now unlocked, level 3 still locked
    expect(screen.getByRole("button", { name: /Niveau 2.*en cours/ })).toBeTruthy();
    // tabs
    await u.click(screen.getByRole("button", { name: "Récompenses" }));
    await screen.findByRole("heading", { name: "Récompenses" });
    await u.click(screen.getByRole("button", { name: "Accueil" }));
    await screen.findByText(/Lina/);
    const stars = saved().progress.levelStars[1];
    // back to the initial welcome screen via the menu, progress preserved
    await u.click(screen.getByRole("button", { name: "Menu" }));
    await u.click(screen.getByRole("button", { name: /Retour à l'accueil initial/ }));
    await screen.findByText("Bienvenue sur NASJ !");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(saved().progress.levelStars[1]).toBe(stars);
    expect(saved().profile).toEqual({ name: "Lina", group: "5-10" });
    await u.click(screen.getByRole("button", { name: /Commencer/ }));
    await screen.findByText(/Lina/);
    // change path keeps progress
    await u.click(screen.getByRole("button", { name: "Menu" }));
    await u.click(screen.getByRole("button", { name: /Changer mon parcours/ }));
    await u.click(await screen.findByRole("radio", { name: /3–5 ans/ }));
    await u.click(screen.getByRole("button", { name: /Voir mes 5 niveaux/ }));
    await screen.findByText("Mon parcours");
    expect(saved().profile.group).toBe("3-5");
    expect(saved().progress.levelStars[1]).toBe(stars);
    cleanup();
  }, 60000);

  it("migrates a legacy profile (single age) to an age group", () => {
    localStorage.setItem("nasj-demo-v1", JSON.stringify({ screen: "dashboard", authed: true, profile: { name: "Old", age: 5 }, progress: { levelStars: { 1: 2 }, bonus: 0, badges: [], explored: [], dailyDate: null }, levelId: 1 }));
    mount();
    expect(groupFromAge(5)).toBe("3-5");
    expect(groupFromAge(6)).toBe("5-10");
    expect(screen.getByText(/Old/)).toBeTruthy();
    cleanup();
  });

  it("difficulty adapts to the age group and generates valid questions", () => {
    expect(bandFor("3-5", 5)).toBe("easy");
    expect(bandFor("5-10", 1)).toBe("medium");
    expect(bandFor("5-10", 4)).toBe("hard");
    for (const b of ["easy", "medium", "hard"] as const) for (const q of [...makeMath(b), ...makeVocab(b)]) {
      expect(q.options.some((o) => o.id === q.answer)).toBe(true);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
    expect(LEVELS.map((l) => l.sub)).toEqual(["Je découvre", "J'apprends", "Je relève des défis", "Je crée", "Je m'émerveille"]);
  });
});
