"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { AttendanceSheet } from "@/features/attendance/AttendanceSheet";

export default function EmargementPage() {
  return (
    <ProtectedPage
      title="Émargement"
      description="Choisissez la séance, puis indiquez pour chaque stagiaire : présent, absent ou en retard. Chaque choix est enregistré immédiatement."
      permission="attendance.record"
    >
      {(profile) => <AttendanceSheet profile={profile} />}
    </ProtectedPage>
  );
}
