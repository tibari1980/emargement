"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { StaffAttendanceSupervisor } from "@/features/attendance/StaffAttendanceSupervisor";

export default function SecretaryEmargementPage() {
  return (
    <ProtectedPage
      title="Émargement Multi-Filières & Régularisations"
      description="Supervision des émargements des 15 promotions du centre, régularisation administrative et gestion des absences formateurs."
      permission="attendance.recordAny"
    >
      {(profile) => <StaffAttendanceSupervisor profile={profile} />}
    </ProtectedPage>
  );
}
