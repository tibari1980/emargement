"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { CalendarManager } from "@/features/secretary/CalendarManager";

export default function SecretaryCalendarPage() {
  return (
    <ProtectedPage
      title="Calendrier de l'établissement"
      description="Jours fériés et périodes de fermeture : ces jours sont exclus des heures théoriques de toutes les formations."
      permission="calendar.manage"
    >
      {(profile) => <CalendarManager actor={profile} />}
    </ProtectedPage>
  );
}
