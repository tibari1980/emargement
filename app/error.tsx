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
    announce("Une erreur inattendue est survenue. Vous pouvez réinitialiser l'affichage ou revenir à l'accueil.", "assertive");
  }, [error, announce]);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <PageHeader
        title="Une erreur inattendue est survenue"
        description="L'application a rencontré une anomalie lors du chargement de cette page."
      />
      <div className="mt-6 flex flex-col gap-6 rounded-lg border-2 border-red-300 bg-white p-6 shadow-sm">
        <Alert tone="error">
          <p className="font-bold">Détail du message :</p>
          <p className="mt-1 font-mono text-sm">{error.message || "Erreur interne non spécifiée."}</p>
        </Alert>

        <p className="text-gray-800">
          Vos données déjà enregistrées ne sont pas perdues. Vous pouvez tenter de recharger cette vue ou revenir à la page d&apos;accueil.
        </p>

        <div className="flex flex-wrap gap-4">
          <Button onClick={() => reset()}>
            Réessayer
          </Button>
          <Link href="/">
            <Button variant="secondary">Retourner à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
