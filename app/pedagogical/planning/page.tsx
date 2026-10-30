"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { Plannings } from "@/features/planning/Plannings";

export default function PedagogicalPlanningPage() {
  return (
    <ProtectedPage
      title="Plannings pédagogiques"
      description="Consultez les plannings hebdomadaires consolidés par formateur ou par promotion."
      permission="planning.view"
    >
      {(profile) => <Plannings actor={profile} />}
    </ProtectedPage>
  );
}
