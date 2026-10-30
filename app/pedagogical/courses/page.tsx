"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { FormationManager } from "@/features/formations/FormationManager";

export default function CoursesPage() {
  return (
    <ProtectedPage
      title="Formations"
      description="Définissez les formations de l'établissement, leur responsable pédagogique et leurs stagiaires inscrits."
      permission="formations.manage"
    >
      {(profile) => <FormationManager actor={profile} />}
    </ProtectedPage>
  );
}
