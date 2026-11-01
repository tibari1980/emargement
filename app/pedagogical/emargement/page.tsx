"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { StaffAttendanceSupervisor } from "@/features/attendance/StaffAttendanceSupervisor";

export default function PedagogicalEmargementPage() {
  return (
    <ProtectedPage
      title="Supervision des Émargements & Régularisations"
      description="Supervision multi-filières des 15 promotions du centre, régularisation pédagogique et gestion des remplacements ou absences de formateurs."
      permission="attendance.recordAny"
    >
      {(profile) => <StaffAttendanceSupervisor profile={profile} />}
    </ProtectedPage>
  );
}
