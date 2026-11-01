"use client";

import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { useAuth } from "@/components/AuthProvider";
import { FirebaseNotConfigured } from "@/components/ProtectedPage";
import { BrandLogoEye } from "@/components/BrandLogoEye";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { isAppInitialised } from "@/lib/data/accounts";
import { getFirebaseAuth } from "@/lib/core/firebase";

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

  // Anti-brute-force rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!configured) return;
    isAppInitialised()
      .then((done: boolean) => setNeedsSetup(!done))
      .catch(() => {});
  }, [configured]);

  if (!configured) return <FirebaseNotConfigured />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lockoutSeconds > 0) {
      announce(`Compte temporairement verrouillé pour des raisons de sécurité. Veuillez patienter ${lockoutSeconds} secondes.`);
      return;
    }

    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      setFailedAttempts(0);
      announce("Connexion réussie.");
    } catch (e) {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures >= 5) {
        const cooldown = 60;
        setLockoutSeconds(cooldown);
        setError(
          `Trop de tentatives de connexion infructueuses (5/5). Par mesure de sécurité et conformément aux exigences de protection contre le vol de données, l'accès est temporairement verrouillé pendant ${cooldown} secondes.`
        );
        announce("Trop d'échecs de connexion. Formulaire verrouillé pendant 60 secondes.");
      } else {
        setError(`${authErrorMessage(e)} (Tentative ${nextFailures}/5)`);
      }
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
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="mb-5 sm:mb-6 flex flex-col items-center text-center">
        <BrandLogoEye size="lg" className="mb-3 shadow-md" />
        <h1 className="text-xl sm:text-3xl font-bold text-primary tracking-tight">
          ESRP / CFRP Valentin Haüy
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
          Plateforme d&apos;Émargement &amp; Suivi Pédagogique
        </p>
      </div>

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

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-8 shadow-xs"
        noValidate
      >
        <div className="border-b border-border-subtle pb-3">
          <h2 className="text-lg sm:text-xl font-bold text-primary">Connexion à votre espace</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Identifiez-vous avec votre adresse email professionnelle.
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}

        <TextField
          label="Adresse email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nom.prenom@avh.asso.fr"
        />
        <PasswordField
          label="Mot de passe"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            disabled={busy || lockoutSeconds > 0}
            className="w-full min-h-12"
            aria-live="polite"
          >
            {lockoutSeconds > 0
              ? `Verrouillé (${lockoutSeconds}s)`
              : busy
                ? "Connexion en cours…"
                : "Se connecter"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="w-full min-h-11"
            disabled={busy || lockoutSeconds > 0}
          >
            Mot de passe oublié
          </Button>
        </div>

        <div className="mt-2 pt-3 border-t border-border-subtle text-center text-xs text-on-surface-variant">
          <Link
            href="/politique-confidentialite"
            className={`underline hover:text-primary ${focusRing}`}
          >
            Politique de Confidentialité &amp; Protection des Données (RGPD)
          </Link>
        </div>
      </form>
    </div>
  );
}
