"use client";

import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { useAuth } from "@/components/AuthProvider";
import { FirebaseNotConfigured } from "@/components/RoleGuard";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { isAppInitialised } from "@/lib/accounts";
import { getFirebaseAuth } from "@/lib/firebase";

function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "auth/network-request-failed":
      return "Connexion réseau impossible. Vérifiez votre accès à Internet.";
    case "auth/invalid-email":
      return "L'adresse email n'est pas valide.";
    default:
      return "Connexion impossible. Réessayez ou contactez un administrateur.";
  }
}

export default function LoginPage() {
  const { user, configured } = useAuth();
  const router = useRouter();
  const announce = useAnnounce();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!configured) return;
    isAppInitialised()
      .then((done) => setNeedsSetup(!done))
      .catch(() => {});
  }, [configured]);

  if (!configured) return <FirebaseNotConfigured />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      announce("Connexion réussie.");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Saisissez d'abord votre adresse email pour recevoir le lien de réinitialisation.");
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setInfo("Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé.");
      announce("Email de réinitialisation envoyé.");
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Connexion" description="Connectez-vous avec votre adresse email professionnelle." />
      {needsSetup && (
        <div className="mb-5">
          <Alert tone="info">
            Aucun administrateur n&apos;existe encore.{" "}
            <Link href="/installation" className={`font-semibold underline ${focusRing}`}>
              Installer l&apos;application
            </Link>
            .
          </Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border-2 border-gray-300 bg-white p-6" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        <TextField
          label="Adresse email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Connexion en cours…" : "Se connecter"}
        </Button>
        <Button variant="secondary" onClick={handleReset}>
          Mot de passe oublié
        </Button>
      </form>
    </div>
  );
}
