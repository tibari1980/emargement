"use client";

import type { Actor } from "@/lib/data/audit";
import { StaffAttendanceSupervisor } from "./StaffAttendanceSupervisor";
import { TrainerAttendanceSheet } from "./TrainerAttendanceSheet";

export { StaffAttendanceSupervisor, TrainerAttendanceSheet };

/**
 * Dispatcher par rôle pour l'Émargement :
 * - Formateur (`trainer`) -> `TrainerAttendanceSheet` (verrouillage temporel strict avant/après séance, zéro régularisation administrative).
 * - Secrétariat, Responsable pédagogique, Administrateur (`secretary`, `pedagogical_lead`, `admin`) -> `StaffAttendanceSupervisor`
 *   (supervision multi-filières, filtre des promotions à émarger, régularisation administrative et gestion d'absence formateur).
 */
export function AttendanceSheet({ profile }: { profile: Actor }) {
  if (profile.role === "trainer") {
    return <TrainerAttendanceSheet profile={profile} />;
  }
  return <StaffAttendanceSupervisor profile={profile} />;
}
