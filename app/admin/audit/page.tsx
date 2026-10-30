"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { AuditJournal } from "@/features/audit/AuditJournal";

export default function AuditPage() {
  return (
    <ProtectedPage
      title="Journal d'activité"
      description="Traçabilité complète des actions : créations, modifications, suppressions et émargements avec auteur et horodatage."
      permission="audit.read"
    >
      {() => <AuditJournal />}
    </ProtectedPage>
  );
}
