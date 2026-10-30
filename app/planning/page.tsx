"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { Plannings } from "@/features/planning/Plannings";

export default function PlanningPage() {
  return (
    <ProtectedPage
      title="Plannings"
      description="Consultez l'emploi du temps hebdomadaire par formation ou par formateur."
      permission="planning.view"
    >
      {(profile) => <Plannings actor={profile} />}
    </ProtectedPage>
  );
}
