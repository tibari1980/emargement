"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, CalendarDays, FileCheck, UploadCloud } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { focusRing } from "@/components/ui/Button";

const SECRETARY_MODULES = [
  {
    title: "Justificatifs d'absence",
    description: "Saisie des arrêts maladie, convocations administratives et validation des motifs d'absence.",
    href: "/secretary/justifications",
    icon: FileCheck,
    badge: "Prioritaire",
    color: "bg-status-late-bg text-status-late border-status-late-border/40",
  },
  {
    title: "Import de stagiaires",
    description: "Inscrire des promotions complètes de stagiaires à partir de fichiers CSV ou Excel (.xlsx).",
    href: "/secretary/import",
    icon: UploadCloud,
    badge: "Gestion des groupes",
    color: "bg-surface-container text-secondary border-border-subtle",
  },
  {
    title: "Calendrier de l'établissement",
    description: "Configuration des jours fériés nationaux et des périodes de congés/fermetures de l'établissement.",
    href: "/secretary/calendar",
    icon: CalendarCheck,
    badge: "Référentiel",
    color: "bg-surface-container text-primary border-border-subtle",
  },
  {
    title: "Consultation des plannings",
    description: "Visualiser les emplois du temps hebdomadaires par formateur ou par filière de formation.",
    href: "/planning",
    icon: CalendarDays,
    badge: "Consultation",
    color: "bg-surface-container text-primary border-border-subtle",
  },
  {
    title: "Guide Secrétariat & Déclaration ASP",
    description: "Manuel pas-à-pas pour les imports, la gestion des arrêts maladie et la préparation de la paie ASP.",
    href: "/guide?role=secretary",
    icon: BookOpen,
    badge: "Assistance",
    color: "bg-secondary/15 text-secondary border-secondary/30",
  },
];

export default function SecretaryHubPage() {
  return (
    <ProtectedPage
      title="Espace Secrétariat"
      description="Gestion administrative des dossiers stagiaires, conformité des absences et calendrier de l'établissement."
      permission="absences.justify"
    >
      {() => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECRETARY_MODULES.map((mod) => {
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
                    <span>Accéder au module</span>
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
