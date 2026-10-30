"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { TraineeImporter } from "@/features/secretary/TraineeImporter";

export default function ImportPage() {
  return (
    <ProtectedPage
      title="Import de stagiaires"
      description="Inscrivez un groupe de stagiaires dans une formation à partir d'un fichier CSV ou Excel (.xlsx)."
      permission="trainees.import"
    >
      {(profile) => <TraineeImporter actor={profile} />}
    </ProtectedPage>
  );
}
