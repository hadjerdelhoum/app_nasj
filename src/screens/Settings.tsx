import { useState } from "react";
import { KeyRound, Lock, LogOut, Trash2, Volume2 } from "lucide-react";
import { ApiFailure, api } from "../api";
import { canSpeak, speak } from "../audio";
import { RecoveryCodePanel } from "../components/AuthShell";
import { Button, ConfirmDialog, Field, MainScreen, Notice, PasswordField, ScreenHeader, TopSky } from "../components/ui";
import { GROUPS, groupOf } from "../data";
import { useApp } from "../store";
import type { AgeGroup } from "../types";

type Dialog = null | "group" | "password" | "code" | "delete" | "reset-demo";

export default function Settings() {
  const { state, go, remote, user, refreshUser, updatePrefs, updateChild, logout, reset } = useApp();
  const group = groupOf(state.profile);
  const [name, setName] = useState(state.profile?.name ?? "");
  const [parentName, setParentName] = useState(user?.displayName ?? "");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pendingGroup, setPendingGroup] = useState<AgeGroup | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [cur, setCur] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const audio = state.prefs?.audio !== false;

  const close = () => { setDialog(null); setPw(""); setPw2(""); setCur(""); setErr(null); setBusy(false); };
  const fail = (e: unknown) => setErr(e instanceof ApiFailure ? e.message : "Une erreur est survenue.");
  async function run(fn: () => Promise<void>, okText?: string) {
    setBusy(true); setErr(null);
    try { await fn(); if (okText) setMsg({ kind: "ok", text: okText }); return true; } catch (e) { fail(e); return false; } finally { setBusy(false); }
  }
  async function saveName() {
    if (!name.trim()) return setMsg({ kind: "error", text: "Le prénom ne peut pas être vide." });
    try { await updateChild({ displayName: name.trim() }); setMsg({ kind: "ok", text: "Prénom enregistré." }); } catch (e) { setMsg({ kind: "error", text: e instanceof Error ? e.message : "Erreur" }); }
  }
  async function toggleAudio() { try { await updatePrefs({ audio: !audio }); } catch (e) { setMsg({ kind: "error", text: e instanceof Error ? e.message : "Erreur" }); } }

  return (
    <MainScreen onGo={go} overlay={<>
      {dialog === "group" && pendingGroup && <ConfirmDialog title="Changer de parcours ?" text={`Passer au parcours ${GROUPS[pendingGroup].label} (${GROUPS[pendingGroup].title}). Les activités s'adapteront ; ta progression, tes étoiles et tes badges sont conservés.`} confirmLabel="Changer" busy={busy} onCancel={close} onConfirm={async () => { if (await run(() => updateChild({ ageGroup: pendingGroup }), "Parcours modifié.")) close(); }}>{err && <Notice kind="error">{err}</Notice>}</ConfirmDialog>}
      {dialog === "password" && <ConfirmDialog title="Changer le mot de passe" confirmLabel="Enregistrer" busy={busy} onCancel={close} onConfirm={async () => {
        if (pw.length < 8) return setErr("Au moins 8 caractères."); if (pw !== pw2) return setErr("Les deux mots de passe ne sont pas identiques.");
        if (await run(() => api("POST", "/auth/change-password", { currentPassword: cur, newPassword: pw }), "Mot de passe modifié. Les autres appareils ont été déconnectés.")) close();
      }}><PasswordField label="Mot de passe actuel" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /><PasswordField label="Nouveau mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><PasswordField label="Confirmation" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />{err && <Notice kind="error">{err}</Notice>}</ConfirmDialog>}
      {dialog === "code" && (newCode
        ? <div className="absolute inset-0 z-40 flex items-end bg-black/45 p-3 sm:items-center"><div className="rise mx-auto max-h-full w-full max-w-sm overflow-y-auto rounded-card bg-cream p-5"><RecoveryCodePanel code={newCode} doneLabel="Terminé" onDone={() => { setNewCode(null); close(); }} /></div></div>
        : <ConfirmDialog title="Nouveau code de récupération" text="Le précédent code ne fonctionnera plus. Confirme avec ton mot de passe." confirmLabel="Générer" busy={busy} onCancel={close} onConfirm={async () => { await run(async () => { const r = await api<{ recoveryCode: string }>("POST", "/auth/recovery-code", { password: pw }); setNewCode(r.recoveryCode); await refreshUser(); }); }}><PasswordField label="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />{err && <Notice kind="error">{err}</Notice>}</ConfirmDialog>)}
      {dialog === "delete" && <ConfirmDialog danger title="Supprimer mon compte ?" text="Le compte parent, les profils enfants, la progression, les étoiles et les badges seront supprimés définitivement." confirmLabel="Supprimer" busy={busy} onCancel={close} onConfirm={async () => { await run(async () => { await api("DELETE", "/auth/me", { password: pw }); await logout({ skipServer: true }); }); }}><PasswordField label="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />{err && <Notice kind="error">{err}</Notice>}</ConfirmDialog>}
      {dialog === "reset-demo" && <ConfirmDialog danger title="Effacer la démo ?" text="Toute la progression enregistrée sur cet appareil sera supprimée." confirmLabel="Effacer" onCancel={close} onConfirm={() => { reset(); close(); }} />}
    </>}>
      <div className="relative">
        <TopSky h={140} />
        <div className="relative z-10 px-5 pb-8 pt-4">
          <ScreenHeader title="Réglages" onBack={() => go("me")} />
          <div className="mt-6 grid gap-4">
            {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

            <section className="rounded-card bg-white p-4 shadow-soft" aria-label="Profil de l'enfant">
              <h2 className="mb-2 text-lg font-black text-teal-dark">Profil de l'enfant</h2>
              <Field label="Prénom (ou surnom)" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
              <Button tone="white" className="mb-4 w-full" onClick={saveName}>Enregistrer le prénom</Button>
              <p className="mb-2 text-sm font-extrabold text-ink">Parcours</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Parcours">
                {(["3-5", "5-10"] as AgeGroup[]).map((g) => (
                  <button key={g} role="radio" aria-checked={group === g} onClick={() => { if (g !== group) { setPendingGroup(g); setDialog("group"); } }} className={`rounded-2xl p-3 text-left transition ${group === g ? "bg-teal text-white shadow-pop" : "bg-teal-soft text-teal-dark"}`}>
                    <b className="block text-lg font-black">{GROUPS[g].label}</b><span className="text-xs font-bold">{GROUPS[g].title}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-mute">Le parcours ne change que si tu le demandes ici.</p>
            </section>

            {canSpeak && (
              <section className="rounded-card bg-white p-4 shadow-soft" aria-label="Son">
                <h2 className="mb-2 text-lg font-black text-teal-dark">Son</h2>
                <div className="flex items-center gap-3">
                  <Volume2 size={24} className="text-teal" />
                  <span className="flex-1 text-sm font-extrabold text-ink">Lire les mots à voix haute</span>
                  <button role="switch" aria-checked={audio} aria-label="Lire les mots à voix haute" onClick={toggleAudio} className={`relative h-8 w-14 rounded-full transition ${audio ? "bg-teal" : "bg-black/20"}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${audio ? "left-7" : "left-1"}`} /></button>
                </div>
                <Button tone="white" className="mt-3 w-full" onClick={() => speak([{ text: "Bonjour !", lang: "fr-FR" }])}>Tester la voix</Button>
              </section>
            )}

            {remote ? (
              <section className="rounded-card bg-white p-4 shadow-soft" aria-label="Compte">
                <h2 className="mb-1 text-lg font-black text-teal-dark">Compte parent</h2>
                <p className="mb-3 break-all text-sm font-bold text-mute">{user?.email}</p>
                <Field label="Nom" value={parentName} maxLength={40} onChange={(e) => setParentName(e.target.value)} />
                <Button tone="white" className="mb-3 w-full" onClick={async () => { if (parentName.trim()) { try { await api("PATCH", "/auth/me", { displayName: parentName.trim() }); await refreshUser(); setMsg({ kind: "ok", text: "Nom enregistré." }); } catch (e) { setMsg({ kind: "error", text: e instanceof Error ? e.message : "Erreur" }); } } }}>Enregistrer le nom</Button>
                <div className="grid gap-2">
                  <Button tone="white" onClick={() => setDialog("password")}><Lock size={18} /> Changer le mot de passe</Button>
                  <Button tone="white" onClick={() => setDialog("code")}><KeyRound size={18} /> {user?.hasRecoveryCode ? "Nouveau code de récupération" : "Créer mon code de récupération"}</Button>
                  <Button tone="coral" onClick={() => setDialog("delete")}><Trash2 size={18} /> Supprimer mon compte</Button>
                </div>
              </section>
            ) : (
              <section className="rounded-card bg-white p-4 shadow-soft" aria-label="Données de la démo">
                <h2 className="mb-2 text-lg font-black text-teal-dark">Données de la démo</h2>
                <p className="mb-3 text-sm font-semibold text-mute">En mode démo, la progression reste sur cet appareil.</p>
                <Button tone="coral" className="w-full" onClick={() => setDialog("reset-demo")}><Trash2 size={18} /> Effacer la démo</Button>
              </section>
            )}

            <Button tone="white" size="lg" onClick={() => go("help")}>Aide & FAQ</Button>
            <Button tone="coral" size="lg" onClick={() => void logout()}><LogOut size={20} /> Se déconnecter</Button>
          </div>
        </div>
      </div>
    </MainScreen>
  );
}
