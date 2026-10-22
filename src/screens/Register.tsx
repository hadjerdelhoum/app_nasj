import { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { ApiFailure } from "../api";
import { AuthShell, RecoveryCodePanel } from "../components/AuthShell";
import { Button, Field, Notice, PasswordField } from "../components/ui";
import { useApp } from "../store";

type Errs = Partial<Record<"name" | "email" | "pw" | "pw2", string>>;
export default function Register() {
  const { go, login, remote, register, continueAfterAuth } = useApp();
  const [f, setF] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [errs, setErrs] = useState<Errs>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const n: Errs = {};
    if (!f.name.trim()) n.name = "Écris ton nom.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) n.email = "Cette adresse e-mail ne semble pas valide.";
    if (f.pw.length < (remote ? 8 : 4)) n.pw = `Au moins ${remote ? 8 : 4} caractères.`;
    if (f.pw2 !== f.pw) n.pw2 = "Les deux mots de passe ne sont pas identiques.";
    setErrs(n);
    if (Object.keys(n).length) return;
    if (!remote) return login();
    setBusy(true);
    try { setCode(await register(f.email.trim(), f.pw, f.name.trim())); }
    catch (err) { setFormErr(err instanceof ApiFailure ? err.message : "Une erreur est survenue."); }
    finally { setBusy(false); }
  }

  if (code) return <AuthShell title="Compte créé !" subtitle="Dernière étape avant de commencer"><RecoveryCodePanel code={code} doneLabel="Continuer" onDone={() => void continueAfterAuth()} /></AuthShell>;
  return (
    <AuthShell title="Créer un compte" subtitle="Rejoins l'aventure NASJ !" onBack={() => go("auth")}>
      <form onSubmit={submit} noValidate>
        {formErr && <div className="mb-3"><Notice kind="error">{formErr}</Notice></div>}
        <Field label="Nom complet" icon={User} value={f.name} onChange={set("name")} placeholder="Ton nom" autoComplete="name" maxLength={40} error={errs.name} />
        <Field label="Adresse e-mail" icon={Mail} value={f.email} onChange={set("email")} placeholder="parent@exemple.fr" autoComplete="email" inputMode="email" error={errs.email} />
        <PasswordField label="Mot de passe" icon={Lock} value={f.pw} onChange={set("pw")} placeholder="Au moins 8 caractères" autoComplete="new-password" error={errs.pw} />
        <PasswordField label="Confirmation du mot de passe" icon={Lock} value={f.pw2} onChange={set("pw2")} placeholder="Répète le mot de passe" autoComplete="new-password" error={errs.pw2} />
        <p className="mb-3 text-xs font-semibold text-mute">Ce compte est celui d'un parent. Tu choisiras ensuite le prénom de l'enfant et son parcours (3–5 ou 5–10 ans).</p>
        <Button type="submit" size="lg" className="w-full" loading={busy}>S'inscrire</Button>
        <p className="mt-3 text-center text-sm font-bold text-ink">Déjà un compte ? <button type="button" onClick={() => go("auth")} className="font-extrabold text-teal-dark underline">Se connecter</button></p>
      </form>
    </AuthShell>
  );
}
