"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { JustificationManager } from "@/features/secretary/JustificationManager";

export default function JustificationsPage() {
  return (
    <ProtectedPage
      title="Justificatifs d'absence"
      description="Enregistrez les justificatifs médicaux ou administratifs. Les séances concernées passent en « absence justifiée » dans les rapports."
      permission="absences.justify"
    >
      {(profile) => <JustificationManager actor={profile} />}
    </ProtectedPage>
  );
}
