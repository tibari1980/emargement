"use client";

import type { Actor } from "@/lib/data/audit";
import { StaffPlanningSupervisor } from "./StaffPlanningSupervisor";
import { TrainerPlanningView } from "./TrainerPlanningView";

export { StaffPlanningSupervisor, TrainerPlanningView };

/**
 * Dispatcher par rôle pour les Plannings :
 * - Formateur (`trainer`) -> `TrainerPlanningView` (confidentialité stricte : uniquement son planning personnel ou celui d'une promotion).
 * - Secrétariat, Responsable pédagogique, Administrateur (`secretary`, `pedagogical_lead`, `admin`) -> `StaffPlanningSupervisor`
 *   (supervision transversale multi-promotions & multi-formateurs).
 */
export function Plannings({ actor }: { actor: Actor }) {
  if (actor.role === "trainer") {
    return <TrainerPlanningView actor={actor} />;
  }
  return <StaffPlanningSupervisor actor={actor} />;
}
