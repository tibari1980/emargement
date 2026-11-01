"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { AttendanceSheet } from "@/features/attendance/AttendanceSheet";

export default function EmargementPage() {
  return (
    <ProtectedPage
      title="Émargement & Suivi des Séances"
      description="Sélectionnez la filière et la date, consultez l'état d'émargement des promotions du jour, puis indiquez pour chaque stagiaire : présent, en retard ou absent."
      permission="attendance.record"
    >
      {(profile) => <AttendanceSheet profile={profile} />}
    </ProtectedPage>
  );
}
