"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2 } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { focusRing } from "@/components/ui/Button";

const TRAINER_MODULES = [
  {
    title: "Feuille d'émargement",
    description: "Saisie en direct de l'appel pour chaque cours : présences, retards horodatés et absences.",
    href: "/trainer/emargement",
    icon: CheckCircle2,
    badge: "Direct",
    color: "bg-status-present-bg text-status-present border-status-present-border/40",
  },
  {
    title: "Mon planning hebdomadaire",
    description: "Consultez vos horaires de cours, vos salles attribuées et les promotions de stagiaires.",
    href: "/planning",
    icon: CalendarDays,
    badge: "Emploi du temps",
    color: "bg-surface-container text-secondary border-border-subtle",
  },
  {
    title: "Guide d'utilisation Formateur",
    description: "Manuel étape par étape : règles temporelles d'émargement, raccourcis clavier NVDA/JAWS et astuces.",
    href: "/guide?role=trainer",
    icon: BookOpen,
    badge: "Assistance",
    color: "bg-secondary/15 text-secondary border-secondary/30",
  },
];

export default function TrainerHubPage() {
  return (
    <ProtectedPage
      title="Espace Formateur"
      description="Émargement en temps réel des cours et consultation de votre planning pédagogique."
      permission="attendance.record"
    >
      {() => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRAINER_MODULES.map((mod) => {
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
                    <span>Ouvrir</span>
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
