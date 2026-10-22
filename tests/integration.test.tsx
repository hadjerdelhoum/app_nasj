// @vitest-environment jsdom
// Frontend <-> REAL backend (in-process Express + SQLite). No mocks: every click goes through the HTTP API.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../server/src/app";
import { loadConfig } from "../server/src/config";
import { migrate, openDb, type Db } from "../server/src/db";
import { seedReference } from "../server/src/seed";

let db: Db, server: Server, url: string;
beforeAll(async () => {
  db = openDb(":memory:"); migrate(db); seedReference(db);
  server = createApp(db, loadConfig({ RATE_LIMIT: "off" })).listen(0);
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
afterEach(() => { cleanup(); });

async function mountApp(apiUrl = url) {
  vi.stubEnv("VITE_API_URL", apiUrl);
  vi.resetModules();
  const [{ default: App }, { AppProvider }] = await Promise.all([import("../src/App"), import("../src/store")]);
  return render(<AppProvider><App /></AppProvider>);
}
const q1 = (sql: string, ...p: any[]) => db.prepare(sql).get(...p);
const startOn = (screen: string) => localStorage.setItem("nasj-demo-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("nasj-demo-v1") ?? "{}"), screen }));

/** Answers the quiz like a child would: the secret answers are read from the server DB (test-only) and clicked in the UI, then "Valider". */
async function playQuizUI(u: ReturnType<typeof userEvent.setup>, wrongFirst = false) {
  const att = await waitFor(() => { const a = q1("SELECT * FROM activity_attempts WHERE status='started' ORDER BY rowid DESC"); expect(a).toBeTruthy(); return a!; }, { timeout: 4000 });
  const state = JSON.parse(att.state);
  for (const [i, q] of state.questions.entries()) {
    const label = q.options.find((o: any) => o.id === q.answer).label;
    if (wrongFirst && i === 0) {
      const bad = q.options.find((o: any) => o.id !== q.answer).label;
      await u.click(await screen.findByRole("button", { name: bad }));
      await u.click(screen.getByRole("button", { name: "Valider" }));
      expect((await screen.findAllByText(/Essaie encore|Tu progresses|Presque/)).length).toBeGreaterThan(0);
    }
    await u.click(await screen.findByRole("button", { name: label }));
    await u.click(screen.getByRole("button", { name: "Valider" }));
    await u.click(await screen.findByRole("button", { name: /Suivant|Terminer/ }, { timeout: 4000 }));
  }
}
let recoveryCode = "";

describe("frontend + backend", () => {
  it("register → profile → path → parcours → quiz → server-side progress → reload → logout", async () => {
    localStorage.clear();
    const u = userEvent.setup();
    await mountApp();
    await u.click(await screen.findByRole("button", { name: /Commencer/ }));
    await u.click(await screen.findByRole("button", { name: "Passer" })); // onboarding can be skipped
    await u.click(await screen.findByRole("button", { name: "Créer un compte" }));
    // validation messages before anything is sent
    await u.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(await screen.findByText("Écris ton nom.")).toBeTruthy();
    expect(q1("SELECT COUNT(*) n FROM users")!.n).toBe(0);
    await u.type(screen.getByLabelText("Nom complet"), "Maman de Lina");
    await u.type(screen.getByLabelText("Adresse e-mail"), "famille@test.dev");
    await u.type(screen.getByLabelText("Mot de passe"), "mot de passe 123");
    await u.type(screen.getByLabelText("Confirmation du mot de passe"), "autre chose 456");
    await u.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(await screen.findByText(/pas identiques/)).toBeTruthy();
    await u.clear(screen.getByLabelText("Confirmation du mot de passe"));
    await u.type(screen.getByLabelText("Confirmation du mot de passe"), "mot de passe 123");
    await u.click(screen.getAllByRole("button", { name: "Montrer le mot de passe" })[0]); // show/hide toggle works
    expect(screen.getByLabelText("Mot de passe").getAttribute("type")).toBe("text");
    await u.click(screen.getByRole("button", { name: "S'inscrire" }));
    // the one-time recovery code must be acknowledged before continuing
    recoveryCode = (await screen.findByTestId("recovery-code", {}, { timeout: 4000 })).textContent!;
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(screen.getByRole("button", { name: "Continuer" }).hasAttribute("disabled")).toBe(true);
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Continuer" }));
    await screen.findByText("Ton profil", {}, { timeout: 4000 });
    expect(q1("SELECT display_name FROM users WHERE email = 'famille@test.dev'")!.display_name).toBe("Maman de Lina");
    expect(q1("SELECT COUNT(*) n FROM users WHERE email = 'famille@test.dev'")!.n).toBe(1);
    await u.type(screen.getByLabelText(/prénom/i), "Lina");
    await u.click(screen.getByRole("button", { name: /Continuer/ }));
    await screen.findByText("Choisis ton parcours !");
    await u.click(screen.getByRole("radio", { name: /5–10 ans/ }));
    await u.click(screen.getByRole("button", { name: /Voir mes 5 niveaux/ }));
    await screen.findByText("Mon parcours", {}, { timeout: 4000 });
    // the child exists in the database with the chosen age group
    const child = q1("SELECT * FROM children WHERE display_name = 'Lina'")!;
    expect(child.age_group).toBe("5-10");
    // levels come from the server: 1 current, 3 locked
    expect(screen.getByRole("button", { name: /Niveau 1.*en cours/ })).toBeTruthy();
    const lvl3 = screen.getByRole("button", { name: /Niveau 3.*Verrouillé/ });
    await u.click(lvl3);
    expect(await screen.findByText(/termine d'abord le niveau 2/i)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Fermer" }));
    // play level 1 (one wrong answer first -> 3 stars: 0-1 mistakes)
    await u.click(screen.getByRole("button", { name: /Niveau 1.*en cours/ }));
    await u.click(await screen.findByRole("button", { name: /^Commencer$/ }));
    await playQuizUI(u, true);
    await screen.findAllByText(/étoile/, {}, { timeout: 4000 });
    // everything was computed and stored by the server
    expect(q1("SELECT status, best_stars FROM child_level_progress WHERE child_id = ? AND level_id = 1", child.id)).toMatchObject({ status: "completed", best_stars: 3 });
    expect(q1("SELECT unlocked FROM child_level_progress WHERE child_id = ? AND level_id = 2", child.id)!.unlocked).toBe(1);
    expect(q1("SELECT COALESCE(SUM(amount),0) s FROM star_ledger WHERE child_id = ?", child.id)!.s).toBe(4);
    expect(q1("SELECT COUNT(*) n FROM rewards WHERE child_id = ?", child.id)!.n).toBeGreaterThanOrEqual(2);
    // the browser never held the answers
    expect(JSON.stringify(localStorage)).not.toMatch(/"answer"/);
    await u.click(screen.getByRole("button", { name: /Parcours/ }));
    expect(await screen.findByRole("button", { name: /Niveau 2.*en cours/ })).toBeTruthy();
    cleanup();

    // "new device"/refresh: remount -> progress is reloaded from the server
    localStorage.setItem("nasj-demo-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("nasj-demo-v1")!), screen: "map" }));
    await mountApp();
    expect(await screen.findByRole("button", { name: /Niveau 2.*en cours/ }, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Niveau 1.*Terminé/ })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
    // logout wipes the token
    await u.click(within(nav).getByRole("button", { name: "Accueil" }));
    await u.click(await screen.findByRole("button", { name: "Menu" }));
    await u.click(screen.getByRole("button", { name: /Se déconnecter/ }));
    await screen.findByText("Bienvenue sur NASJ !");
    expect(JSON.parse(localStorage.getItem("nasj-demo-v1")!).token).toBeNull();
    expect(q1("SELECT COUNT(*) n FROM sessions")!.n).toBe(0);
    cleanup();
  }, 60000);

  it("login works with the same account and restores the child's progress on a new device", async () => {
    localStorage.clear(); localStorage.setItem("nasj-onboarded", "1");
    const u = userEvent.setup();
    await mountApp();
    await u.click(await screen.findByRole("button", { name: /Commencer/ }));
    await u.type(screen.getByLabelText("Adresse e-mail"), "famille@test.dev");
    await u.type(screen.getByLabelText("Mot de passe"), "faux mot de passe");
    await u.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText(/incorrect/i)).toBeTruthy(); // server error shown to the user
    await u.clear(screen.getByLabelText("Mot de passe"));
    await u.type(screen.getByLabelText("Mot de passe"), "mot de passe 123");
    await u.click(screen.getByRole("button", { name: "Se connecter" }));
    await screen.findByText(/Lina/, {}, { timeout: 4000 });
    // dashboard shows REAL saved data
    expect(screen.getByText(/Reprendre mon parcours/)).toBeTruthy();
    expect(screen.getByText(/Dernière activité/)).toBeTruthy();
    await u.click(within(screen.getByRole("navigation", { name: "Navigation principale" })).getByRole("button", { name: "Parcours" }));
    expect(await screen.findByRole("button", { name: /Niveau 2.*en cours/ })).toBeTruthy();
    cleanup();
  }, 30000);

  it("profile, activities list, rewards, settings (explicit age-group change keeps progress) and help", async () => {
    const u = userEvent.setup();
    startOn("dashboard");
    await mountApp();
    await screen.findByText(/Lina/, {}, { timeout: 4000 });
    await u.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(await screen.findByText("Mon profil")).toBeTruthy();
    expect(screen.getByText(/5–10 ans/)).toBeTruthy();
    expect(within(screen.getByText("Étoiles").closest("div")!).getByText("4")).toBeTruthy(); // 3 stars + daily bonus, from the server
    await u.click(screen.getByRole("button", { name: /Mes badges/ }));
    expect(await screen.findByText("Premier fil")).toBeTruthy();
    expect(screen.getAllByText("Obtenu !").length).toBeGreaterThanOrEqual(2);
    await u.click(screen.getByRole("button", { name: "Accueil" }));
    await u.click(await screen.findByRole("button", { name: "Activités" }));
    expect(await screen.findByRole("heading", { name: "Activités" })).toBeTruthy();
    expect(await screen.findByText("Les mots en images")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /Calcule/ }).closest("button")!.previousElementSibling as HTMLElement); // level 1 (completed) opens, then go back
    await screen.findByText(/Je prépare ton activité|Question/, {}, { timeout: 4000 }).catch(() => null);
    cleanup();
    // settings
    startOn("dashboard");
    await mountApp();
    await screen.findByText(/Lina/, {}, { timeout: 4000 });
    await u.click(screen.getByRole("button", { name: "Menu" }));
    await u.click(screen.getByRole("button", { name: "Réglages" }));
    await screen.findByRole("heading", { name: "Réglages" });
    expect(screen.queryByRole("switch")).toBeNull(); // audio switch only when the device can speak (not jsdom)
    await u.click(screen.getByRole("radio", { name: /3–5 ans/ }));
    await u.click(await screen.findByRole("button", { name: "Changer" }));
    await waitFor(() => expect(q1("SELECT age_group FROM children WHERE display_name = 'Lina'")!.age_group).toBe("3-5"), { timeout: 4000 });
    expect(q1("SELECT status FROM child_level_progress WHERE level_id = 1 AND child_id = (SELECT id FROM children WHERE display_name = 'Lina')")!.status).toBe("completed"); // progress kept
    await u.click(screen.getByRole("button", { name: "Aide & FAQ" }));
    expect(await screen.findByText("Comment gagner des étoiles ?")).toBeTruthy();
    cleanup();
  }, 40000);

  it("password recovery with the recovery code, then login with the new password", async () => {
    localStorage.clear(); localStorage.setItem("nasj-onboarded", "1");
    const u = userEvent.setup();
    await mountApp();
    await u.click(await screen.findByRole("button", { name: /Commencer/ }));
    await u.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    await u.type(await screen.findByLabelText("Adresse e-mail"), "famille@test.dev");
    await u.click(screen.getByRole("button", { name: "Suivant" }));
    await u.type(await screen.findByLabelText("Code de récupération"), "AAAA-BBBB-CCCC-DDDD");
    await u.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau mdp 2026");
    await u.type(screen.getByLabelText("Confirmation"), "nouveau mdp 2026");
    await u.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(await screen.findByText(/code de récupération incorrect/i)).toBeTruthy(); // wrong code: generic server error
    await u.clear(screen.getByLabelText("Code de récupération"));
    await u.type(screen.getByLabelText("Code de récupération"), recoveryCode);
    await u.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
    expect(await screen.findByText("Mot de passe modifié !", {}, { timeout: 4000 })).toBeTruthy();
    const fresh = screen.getByTestId("recovery-code").textContent!;
    expect(fresh).not.toBe(recoveryCode); // a new code replaces the used one
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Se connecter" }));
    await u.type(await screen.findByLabelText("Adresse e-mail"), "famille@test.dev");
    await u.type(screen.getByLabelText("Mot de passe"), "nouveau mdp 2026");
    await u.click(screen.getByRole("button", { name: "Se connecter" }));
    await screen.findByText(/Lina/, {}, { timeout: 4000 });
    cleanup();
  }, 30000);

  it("deleting the account requires the password and erases the data", async () => {
    const u = userEvent.setup();
    startOn("dashboard");
    await mountApp();
    await screen.findByText(/Lina/, {}, { timeout: 4000 });
    await u.click(screen.getByRole("button", { name: "Menu" }));
    await u.click(screen.getByRole("button", { name: "Réglages" }));
    await u.click(await screen.findByRole("button", { name: /Supprimer mon compte/ }));
    await u.type(screen.getByLabelText("Mot de passe"), "mauvais mot de passe");
    await u.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText(/incorrect/i)).toBeTruthy();
    expect(q1("SELECT COUNT(*) n FROM users")!.n).toBe(1);
    await u.clear(screen.getByLabelText("Mot de passe"));
    await u.type(screen.getByLabelText("Mot de passe"), "nouveau mdp 2026");
    await u.click(screen.getByRole("button", { name: "Supprimer" }));
    await screen.findByText("Bienvenue sur NASJ !", {}, { timeout: 4000 });
    expect(q1("SELECT COUNT(*) n FROM users")!.n).toBe(0);
    expect(q1("SELECT COUNT(*) n FROM children")!.n).toBe(0);
    cleanup();
  }, 30000);

  it("returns to the login screen when the session expires", async () => {
    const r = await fetch(`${url}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "expire@test.dev", password: "mot de passe 123" }) });
    const { token } = await r.json();
    db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    localStorage.setItem("nasj-demo-v1", JSON.stringify({ screen: "dashboard", authed: true, token, childId: null, profile: null, levelId: 1, progress: {} }));
    await mountApp();
    expect(await screen.findByText(/session a expiré/i, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeTruthy(); // back on the login screen, not a blank page
    expect(JSON.parse(localStorage.getItem("nasj-demo-v1")!).token).toBeNull();
  });

  it("shows a friendly error (not a blank page) when the server is unreachable", async () => {
    localStorage.setItem("nasj-demo-v1", JSON.stringify({ screen: "dashboard", authed: true, token: "whatever", childId: "x", profile: null, levelId: 1, progress: {} }));
    await mountApp("http://127.0.0.1:1");
    expect(await screen.findByText(/Impossible de joindre le serveur/, {}, { timeout: 6000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    cleanup();
  }, 15000);
});
