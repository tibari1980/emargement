"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, Clock, FileSpreadsheet, GraduationCap } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { focusRing } from "@/components/ui/Button";

const PEDAGOGICAL_MODULES = [
  {
    title: "Formations certifiantes",
    description: "Cursus professionnels, niveaux RNCP, descriptions et gestion des apprenants inscrits.",
    href: "/pedagogical/courses",
    icon: GraduationCap,
    badge: "Référentiel",
    color: "bg-surface-container text-primary border-border-subtle",
  },
  {
    title: "Matières & Modules",
    description: "Catalogue des modules d'enseignement et attribution des formateurs référents.",
    href: "/pedagogical/subjects",
    icon: BookOpen,
    badge: "Pédagogie",
    color: "bg-surface-container text-secondary border-border-subtle",
  },
  {
    title: "Emplois du temps hebdomadaires",
    description: "Définition des créneaux récurrents de cours par matière, créneau horaire, formateur et salle.",
    href: "/pedagogical/timetable",
    icon: Clock,
    badge: "Organisation",
    color: "bg-surface-container text-primary border-border-subtle",
  },
  {
    title: "Rapports mensuels & Assiduité",
    description: "Calcul automatisé des heures certifiées d'assiduité et exports PDF / Excel pour les financeurs (DGEFP).",
    href: "/pedagogical/reports",
    icon: FileSpreadsheet,
    badge: "Certifié DGEFP",
    color: "bg-status-present-bg text-status-present border-status-present-border/40",
  },
  {
    title: "Plannings consolidés",
    description: "Visualisation synthétique des plannings de tous les formateurs et de toutes les promotions.",
    href: "/pedagogical/planning",
    icon: CalendarDays,
    badge: "Vue globale",
    color: "bg-surface-container text-primary border-border-subtle",
  },
];

export default function PedagogicalHubPage() {
  return (
    <ProtectedPage
      title="Espace Responsable Pédagogique"
      description="Pilotage des formations certifiantes, des matières, des créneaux hebdomadaires et des relevés d'assiduité."
      permission="formations.manage"
    >
      {() => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PEDAGOGICAL_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className={`flex flex-col justify-between p-6 rounded-2xl border bg-surface-container-lowest shadow-xs hover:border-secondary transition-all hover:shadow-md ${focusRing}`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl border ${mod.color}`}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                        {mod.badge}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-primary tracking-tight">{mod.title}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">{mod.description}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-1.5 text-sm font-bold text-secondary">
                    <span>Accéder</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}
