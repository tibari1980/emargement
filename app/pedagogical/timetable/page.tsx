"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { TimetableManager } from "@/features/timetable/TimetableManager";

export default function TimetablePage() {
  return (
    <ProtectedPage
      title="Emplois du temps"
      description="Définissez et téléchargez au format PDF ou Excel les créneaux hebdomadaires récurrents de chaque formation (matière, formateur, horaire et salle)."
      permission="timetable.manage"
    >
      {(profile) => <TimetableManager actor={profile} />}
    </ProtectedPage>
  );
}
