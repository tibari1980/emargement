"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { Plannings } from "@/features/planning/Plannings";

export default function TrainerPlanningPage() {
  return (
    <ProtectedPage
      title="Mon planning hebdomadaire"
      description="Consultez les créneaux de cours qui vous sont attribués chaque semaine."
      permission="planning.view"
    >
      {(profile) => <Plannings actor={profile} />}
    </ProtectedPage>
  );
}
