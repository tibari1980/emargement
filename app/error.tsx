"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const announce = useAnnounce();

  useEffect(() => {
    console.error("Erreur de l'application:", error);
    announce("Une difficulté temporaire est survenue lors de l'affichage. Vos données sont bien conservées. Vous pouvez réessayer ou revenir à l'accueil.", "assertive");
  }, [error, announce]);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <PageHeader
        title="Nous rencontrons une difficulté d'affichage"
        description="Rassurez-vous, toutes vos données et vos émargements sont bien en sécurité."
      />
      <div className="mt-6 flex flex-col gap-6 rounded-2xl border-2 border-status-absent-border bg-surface-container-lowest p-4 sm:p-6 shadow-sm">
        <Alert tone="error">
          <p className="font-bold">Indication technique :</p>
          <p className="mt-1 font-mono text-sm break-words">{error.message || "Interruption passagère du service."}</p>
        </Alert>

        <p className="text-on-surface">
          Vos informations enregistrées ne sont nullement impactées. Vous pouvez relancer l&apos;affichage en cliquant sur « Réessayer » ou retourner tranquillement à l&apos;accueil.
        </p>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <Button onClick={() => reset()} className="w-full sm:w-auto">
            Réessayer
          </Button>
          <Link href="/" className="block sm:inline-flex">
            <Button variant="secondary" className="w-full sm:w-auto">Retourner à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
