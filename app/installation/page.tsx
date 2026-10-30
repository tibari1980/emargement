"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { useAuth } from "@/components/AuthProvider";
import { FirebaseNotConfigured } from "@/components/ProtectedPage";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { accountErrorMessage, createFirstAdmin, isAppInitialised } from "@/lib/data/accounts";

/** First-run setup: creates the first administrator account. */
export default function InstallationPage() {
  const { configured, refreshProfile } = useAuth();
  const router = useRouter();
  const announce = useAnnounce();
  const [initialised, setInitialised] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    isAppInitialised()
      .then(setInitialised)
      .catch((e) => setCheckError(accountErrorMessage(e)));
  }, [configured]);

  if (!configured) return <FirebaseNotConfigured />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) return setError("Le nom et l'email sont obligatoires.");
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirmation) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    try {
      await createFirstAdmin({ fullName: fullName.trim(), email: email.trim(), password });
      await refreshProfile();
      announce("Application initialisée. Vous êtes connecté en tant qu'administrateur.");
      router.replace("/admin/users");
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Installation"
        description="Première utilisation : créez le compte administrateur de l'application."
      />
      {checkError && <Alert tone="error">{checkError}</Alert>}
      {!checkError && initialised === null && <Loading label="Vérification de l'installation…" />}
      {initialised === true && (
        <Alert tone="info">
          L&apos;application est déjà installée.{" "}
          <Link href="/login" className={`font-semibold underline ${focusRing}`}>
            Aller à la page de connexion
          </Link>
          .
        </Alert>
      )}
      {initialised === false && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border-2 border-gray-300 bg-white p-6">
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          <TextField label="Adresse email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <PasswordField
            label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="8 caractères minimum."
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Confirmation du mot de passe"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Création du compte…" : "Créer le compte administrateur"}
          </Button>
        </form>
      )}
    </div>
  );
}
