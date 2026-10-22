import { useState } from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { ApiFailure, api } from "../api";
import { AuthShell, RecoveryCodePanel } from "../components/AuthShell";
import { Button, Field, Notice, PasswordField, StateCard } from "../components/ui";
import { useApp } from "../store";

/** Forgotten password in 3 steps: identify the account → recovery code + new password → confirmation. */
export default function Recover() {
  const { go, remote } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState("");

  if (!remote) return (
    <AuthShell title="Mot de passe oublié ?" onBack={() => go("auth")}>
      <StateCard kind="empty" title="Disponible avec un compte en ligne" text="En mode démo, il n'y a pas de compte à récupérer. Relance la démo ou connecte l'application au serveur NASJ." action={<Button onClick={() => go("auth")}>Retour</Button>} />
    </AuthShell>
  );

  function next1(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErrs({ email: "Cette adresse e-mail ne semble pas valide." });
    setErrs({}); setStep(2);
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const n: Record<string, string> = {};
    if (code.replace(/[^a-z0-9]/gi, "").length < 16) n.code = "Le code a 16 caractères (4 groupes de 4).";
    if (pw.length < 8) n.pw = "Au moins 8 caractères.";
    if (pw !== pw2) n.pw2 = "Les deux mots de passe ne sont pas identiques.";
    setErrs(n);
    if (Object.keys(n).length) return;
    setBusy(true);
    try { const r = await api<{ recoveryCode: string }>("POST", "/auth/recover/reset", { email: email.trim(), recoveryCode: code.trim(), newPassword: pw }); setNewCode(r.recoveryCode); setStep(3); }
    catch (err) { setFormErr(err instanceof ApiFailure ? err.message : "Une erreur est survenue."); }
    finally { setBusy(false); }
  }

  if (step === 3) return (
    <AuthShell title="Mot de passe modifié !" subtitle="Tu peux te reconnecter">
      <Notice kind="ok">Ton nouveau mot de passe est enregistré. Les anciens appareils ont été déconnectés.</Notice>
      <div className="mt-4"><RecoveryCodePanel code={newCode} doneLabel="Se connecter" onDone={() => go("auth")} /></div>
      <p className="mt-2 text-xs font-semibold text-mute">Ton ancien code ne fonctionne plus : voici le nouveau.</p>
    </AuthShell>
  );
  return (
    <AuthShell title="Mot de passe oublié ?" subtitle={step === 1 ? "Étape 1 sur 2 · Ton compte" : "Étape 2 sur 2 · Nouveau mot de passe"} onBack={() => (step === 1 ? go("auth") : setStep(1))}>
      {step === 1 ? (
        <form onSubmit={next1} noValidate>
          <p className="mb-3 text-sm font-semibold text-ink/80">Entre l'adresse e-mail du compte parent. Il te faudra ensuite le <b>code de récupération</b> reçu à l'inscription.</p>
          <Field label="Adresse e-mail" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@exemple.fr" autoComplete="email" inputMode="email" error={errs.email} />
          <Button type="submit" size="lg" className="w-full">Suivant</Button>
          <p className="mt-3 text-xs font-semibold text-mute">Tu n'as pas ton code ? Connecte-toi sur un appareil déjà connecté : Réglages ▸ Compte ▸ Nouveau code de récupération.</p>
        </form>
      ) : (
        <form onSubmit={reset} noValidate>
          {formErr && <div className="mb-3"><Notice kind="error">{formErr}</Notice></div>}
          <Field label="Code de récupération" icon={KeyRound} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} error={errs.code} />
          <PasswordField label="Nouveau mot de passe" icon={Lock} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Au moins 8 caractères" autoComplete="new-password" error={errs.pw} />
          <PasswordField label="Confirmation" icon={Lock} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Répète le mot de passe" autoComplete="new-password" error={errs.pw2} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Changer le mot de passe</Button>
        </form>
      )}
    </AuthShell>
  );
}
