import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiFailure, REMOTE, api, setToken, setUnauthorizedHandler, toProgress, type ProgressDto } from "./api";
import { LEVELS, earnedBadges, groupFromAge, todayKey, totalStars } from "./data";
import type { AgeGroup, CategoryId, ChildDto, Persisted, Prefs, Progress, Screen, UserDto } from "./types";

const KEY = "nasj-demo-v1";
const EMPTY: Progress = { levelStars: {}, bonus: 0, badges: [], explored: [], dailyDate: null, started: [] };
const DEFAULT: Persisted = { screen: "welcome", authed: false, profile: null, progress: EMPTY, levelId: 1, token: null, childId: null, prefs: { audio: true } };
const ONBOARD_KEY = "nasj-onboarded";
const wasOnboarded = () => { try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return false; } };

/** Reads saved data and migrates older versions (single age -> age group, missing progress fields). */
function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const s: Persisted = { ...DEFAULT, ...saved, progress: { ...EMPTY, ...(saved.progress ?? {}) } };
      if (s.profile) {
        const legacy = s.profile as { name: string; group?: AgeGroup | null; age?: number };
        s.profile = { name: legacy.name, group: legacy.group ?? (legacy.age ? groupFromAge(legacy.age) : null) };
      }
      if (s.screen === "activity") s.screen = "map";
      if (REMOTE && !s.token) return { ...DEFAULT };
      return s;
    }
  } catch { /* storage unavailable: start fresh */ }
  return DEFAULT;
}

export interface CompletionResult { delta: number; bonus: boolean; newBadges: string[]; total: number }
export type Status = "loading" | "ready" | "error";
interface Ctx {
  state: Persisted;
  remote: boolean;
  status: Status;
  children: ChildDto[];
  user: UserDto | null;
  onboarded: boolean;
  finishOnboarding: () => void;
  notice: string | null;
  clearNotice: () => void;
  go: (s: Screen) => void;
  login: () => void;
  /** Creates the account. Returns the one-time recovery code; call continueAfterAuth() once the parent has noted it. */
  register: (email: string, password: string, displayName?: string) => Promise<string>;
  continueAfterAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updatePrefs: (p: Prefs) => Promise<void>;
  updateChild: (p: { displayName?: string; ageGroup?: AgeGroup }) => Promise<void>;
  loginRemote: (email: string, password: string) => Promise<void>;
  logout: (opts?: { skipServer?: boolean }) => Promise<void>;
  saveName: (name: string) => void;
  savePath: (g: AgeGroup) => Promise<void>;
  selectChild: (id: string) => Promise<void>;
  newProfile: () => void;
  openLevel: (id: number) => void;
  explore: (id: CategoryId) => void;
  complete: (levelId: number, stars: number) => CompletionResult;
  refresh: () => Promise<void>;
  retry: () => void;
  reset: () => void;
}
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children: kids }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const [children, setChildren] = useState<ChildDto[]>([]);
  const [status, setStatus] = useState<Status>(REMOTE && state.token ? "loading" : "ready");
  const [notice, setNotice] = useState<string | null>(null);
  const [user, setUser] = useState<UserDto | null>(null);
  const [onboarded, setOnboarded] = useState(wasOnboarded);
  const ref = useRef(state);
  ref.current = state;
  if (REMOTE) setToken(state.token ?? null); // keep the API client in sync (idempotent)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);

  const forceLogout = useCallback((msg: string) => {
    setToken(null);
    setChildren([]);
    setState((s) => ({ ...s, token: null, authed: false, childId: null, progress: EMPTY, screen: "auth" }));
    setStatus("ready");
    setNotice(msg);
  }, []);

  /** Loads one child's profile + progress from the server (the only source of truth in remote mode). */
  const loadChild = useCallback(async (id: string) => {
    const [c, p] = await Promise.all([api<{ child: ChildDto }>("GET", `/children/${id}`), api<ProgressDto>("GET", `/children/${id}/progress`)]);
    setState((s) => ({ ...s, childId: id, profile: { name: c.child.displayName, group: c.child.ageGroup }, progress: toProgress(p), prefs: { audio: true, ...(c.child.preferences ?? {}) } }));
  }, []);
  const refreshUser = useCallback(async () => { if (!REMOTE) return; const r = await api<{ user: UserDto }>("GET", "/auth/me"); setUser(r.user); }, []);
  const loadChildren = useCallback(async () => { const r = await api<{ children: ChildDto[] }>("GET", "/children"); setChildren(r.children); return r.children; }, []);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      await refreshUser();
      const list = await loadChildren();
      const id = list.find((c) => c.id === ref.current.childId)?.id ?? list[0]?.id ?? null;
      if (id) await loadChild(id); else setState((s) => ({ ...s, childId: null, profile: null, progress: EMPTY }));
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) forceLogout("Ta session a expiré, reconnecte-toi.");
      else setStatus("error");
    }
  }, [forceLogout, loadChild, loadChildren, refreshUser]);

  useEffect(() => {
    if (!REMOTE) return;
    setUnauthorizedHandler(() => forceLogout("Ta session a expiré, reconnecte-toi."));
    if (ref.current.token) void bootstrap();
    return () => setUnauthorizedHandler(null);
  }, [bootstrap, forceLogout]);

  /** Signs in or creates the account; navigation happens in finishAuth() so the sign-up screen can show the recovery code first. */
  async function authRemote(path: "/auth/login" | "/auth/register", body: Record<string, string>) {
    const r = await api<{ token: string; user: UserDto; recoveryCode?: string }>("POST", path, body);
    setToken(r.token);
    setUser(r.user);
    setState((s) => ({ ...s, token: r.token, authed: true }));
    setNotice(null);
    return r.recoveryCode ?? "";
  }
  async function finishAuth() {
    const list = await loadChildren();
    if (list.length) { await loadChild(list[0].id); setState((s) => ({ ...s, screen: "dashboard" })); }
    else setState((s) => ({ ...s, childId: null, profile: null, progress: EMPTY, screen: "profile" }));
    setStatus("ready");
  }

  const value: Ctx = {
    state, remote: REMOTE, status, children, user, onboarded, notice,
    finishOnboarding: () => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* ignore */ } setOnboarded(true); },
    clearNotice: () => setNotice(null),
    go: (screen) => setState((s) => ({ ...s, screen })),
    login: () => setState((s) => ({ ...s, authed: true, screen: s.profile?.group ? "dashboard" : s.profile ? "path" : "profile" })),
    register: (email, password, displayName) => authRemote("/auth/register", { email, password, ...(displayName ? { displayName } : {}) }),
    loginRemote: async (email, password) => { await authRemote("/auth/login", { email, password }); await finishAuth(); },
    continueAfterAuth: () => finishAuth(),
    refreshUser,
    updatePrefs: async (p) => {
      const next = { ...(ref.current.prefs ?? {}), ...p };
      setState((s) => ({ ...s, prefs: next }));
      if (REMOTE && ref.current.childId) await api("PATCH", `/children/${ref.current.childId}`, { preferences: p });
    },
    updateChild: async (p) => {
      if (!REMOTE || !ref.current.childId) { setState((s) => ({ ...s, profile: { name: p.displayName ?? s.profile?.name ?? "", group: p.ageGroup ?? s.profile?.group ?? null } })); return; }
      await api("PATCH", `/children/${ref.current.childId}`, p);
      await loadChildren();
      await loadChild(ref.current.childId);
    },
    logout: async (opts) => {
      if (REMOTE) { if (!opts?.skipServer) try { await api("POST", "/auth/logout"); } catch { /* token may already be invalid */ } setToken(null); setChildren([]); setUser(null); setState({ ...DEFAULT }); }
      else setState((s) => ({ ...s, authed: false, screen: "welcome" }));
    },
    saveName: (name) => setState((s) => ({ ...s, profile: { name, group: s.profile?.group ?? null }, screen: "path" })),
    savePath: async (group) => {
      if (!REMOTE) { setState((s) => ({ ...s, profile: { name: s.profile?.name ?? "", group }, screen: "map" })); return; }
      const { childId, profile } = ref.current;
      let id = childId;
      if (id) await api("PATCH", `/children/${id}`, { ...(profile?.name ? { displayName: profile.name } : {}), ageGroup: group });
      else id = (await api<{ child: ChildDto }>("POST", "/children", { displayName: profile?.name ?? "", ageGroup: group })).child.id;
      await loadChildren();
      await loadChild(id);
      setState((s) => ({ ...s, screen: "map" }));
    },
    selectChild: async (id) => { await loadChild(id); setState((s) => ({ ...s, screen: "dashboard" })); },
    newProfile: () => setState((s) => ({ ...s, childId: null, profile: { name: "", group: null }, progress: EMPTY })),
    openLevel: (levelId) => setState((s) => ({ ...s, levelId, screen: "activity", progress: REMOTE || s.progress.started.includes(levelId) ? s.progress : { ...s.progress, started: [...s.progress.started, levelId] } })),
    explore: (id) => {
      const cur = ref.current.progress.explored;
      if (cur.includes(id)) return;
      const next = [...cur, id];
      setState((s) => ({ ...s, progress: { ...s.progress, explored: next } }));
      if (REMOTE && ref.current.childId) void api("PATCH", `/children/${ref.current.childId}`, { preferences: { explored: next } }).then(value.refresh).catch(() => {});
    },
    complete: (levelId, stars) => {
      const p = state.progress, t = todayKey(), bonus = p.dailyDate !== t;
      const cat = LEVELS.find((l) => l.id === levelId)!.category;
      const next: Progress = {
        levelStars: { ...p.levelStars, [levelId]: Math.max(p.levelStars[levelId] ?? 0, stars) },
        bonus: p.bonus + (bonus ? 1 : 0), dailyDate: t, badges: p.badges, started: p.started,
        explored: p.explored.includes(cat) ? p.explored : [...p.explored, cat],
      };
      next.badges = earnedBadges(next);
      setState((s) => ({ ...s, progress: next }));
      return { delta: totalStars(next) - totalStars(p), bonus, newBadges: next.badges.filter((b) => !p.badges.includes(b)), total: totalStars(next) };
    },
    refresh: async () => {
      const id = ref.current.childId;
      if (!REMOTE || !id) return;
      const p = await api<ProgressDto>("GET", `/children/${id}/progress`);
      setState((s) => ({ ...s, progress: toProgress(p) }));
    },
    retry: () => void bootstrap(),
    reset: () => setState({ ...DEFAULT, screen: "welcome" }),
  };
  return <AppCtx.Provider value={value}>{kids}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
