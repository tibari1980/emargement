"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { MonthlyReportView } from "@/features/reports/MonthlyReportView";

export default function ReportsPage() {
  return (
    <ProtectedPage
      title="Rapports mensuels"
      description="Heures théoriques, présence effective, absences et retards par stagiaire. Données sécurisées avec conformité RGAA AAA."
      permission="reports.view"
    >
      {(profile) => <MonthlyReportView actor={profile} />}
    </ProtectedPage>
  );
}
