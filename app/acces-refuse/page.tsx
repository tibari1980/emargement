"use client";

import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AccessDeniedPage() {
  return (
    <>
      <PageHeader title="Accès non disponible" />
      <Alert tone="warning">
        Votre compte ne donne accès à aucun espace de l&apos;application d&apos;émargement. Si vous
        pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez le secrétariat du CFRP.
      </Alert>
    </>
  );
}
