import { useState } from "react";
import { ArrowRight, Lock, Mail, UserPlus } from "lucide-react";
import { ApiFailure } from "../api";
import { AuthShell } from "../components/AuthShell";
import { Button, Field, Notice, PasswordField } from "../components/ui";
import { useApp } from "../store";

export default function Auth() {
  const { go, login, remote, loginRemote, notice, clearNotice } = useApp();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [errs, setErrs] = useState<{ id?: string; pw?: string }>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    clearNotice(); setFormErr(null);
    const next: typeof errs = {};
    if (!id.trim()) next.id = remote ? "Écris ton adresse e-mail." : "Écris ton identifiant ou ton e-mail.";
    else if (remote && !/^\S+@\S+\.\S+$/.test(id.trim())) next.id = "Cette adresse e-mail ne semble pas valide.";
    if (!pw) next.pw = "Écris ton mot de passe.";
    else if (!remote && pw.length < 4) next.pw = "Au moins 4 caractères.";
    setErrs(next);
    if (Object.keys(next).length) return;
    if (!remote) return login();
    setBusy(true);
    try { await loginRemote(id.trim(), pw); }
    catch (err) { setFormErr(err instanceof ApiFailure ? err.message : "Une erreur est survenue."); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title="Se connecter" onBack={() => go("welcome")}>
      <form onSubmit={submit} noValidate>
        {(notice || formErr) && <div className="mb-3"><Notice kind="error">{formErr ?? notice}</Notice></div>}
        <Field label={remote ? "Adresse e-mail" : "Identifiant ou e-mail"} icon={Mail} value={id} onChange={(e) => setId(e.target.value)} placeholder={remote ? "parent@exemple.fr" : "Identifiant ou e-mail"} autoComplete="username" inputMode="email" error={errs.id} />
        <PasswordField label="Mot de passe" icon={Lock} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" error={errs.pw} />
        <div className="-mt-1 mb-4 text-right"><button type="button" onClick={() => go("recover")} className="text-sm font-extrabold text-teal-dark underline">Mot de passe oublié ?</button></div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{busy ? "Connexion…" : <>Se connecter <ArrowRight size={22} strokeWidth={3} /></>}</Button>
        <div className="my-3 flex items-center gap-3 text-sm font-bold text-mute"><span className="h-px flex-1 bg-teal/20" />ou<span className="h-px flex-1 bg-teal/20" /></div>
        <Button type="button" tone="white" size="lg" className="w-full" onClick={() => go("register")}><UserPlus size={20} /> Créer un compte</Button>
        {!remote && <p className="mt-3 text-center text-xs font-semibold text-mute">Mode démo : aucun compte réel n'est créé. Mets n'importe quel identifiant et 4 caractères.</p>}
      </form>
    </AuthShell>
  );
}
