"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { AttendanceSheet } from "@/features/attendance/AttendanceSheet";

export default function SecretaryEmargementPage() {
  return (
    <ProtectedPage
      title="Émargement & Régularisations"
      description="Supervision des séances, régularisation administrative et gestion des absences formateurs."
      permission="attendance.record"
    >
      {(profile) => <AttendanceSheet profile={profile} />}
    </ProtectedPage>
  );
}
