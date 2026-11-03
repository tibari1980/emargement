"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  FileSpreadsheet,
  GraduationCap,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  Wrench,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { ApplicationGuide } from "@/components/ApplicationGuide";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Alert } from "@/components/ui/Alert";
import { focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { syncCatalogFormations } from "@/lib/data/formations";

const ADMIN_SECTIONS = [
  {
    roleTitle: "Administration & Sécurité",
    items: [
      {
        title: "Gestion des utilisateurs",
        description: "Comptes du personnel (formateurs, secrétariat, responsables, administrateurs) et habilitations.",
        href: "/admin/users",
        icon: Users,
        color: "bg-surface-container text-primary border-border-subtle",
      },
      {
        title: "Journal d'activité & Audit",
        description: "Traçabilité légale de chaque émargement, modification et création dans l'application.",
        href: "/admin/audit",
        icon: ShieldCheck,
        color: "bg-status-present-bg text-status-present border-status-present-border/40",
      },
      {
        title: "Guide Administrateur & Sécurité RGPD",
        description: "Manuel pas-à-pas de gestion des comptes, politique ANSSI des mots de passe et traçabilité.",
        href: "/guide?role=admin",
        icon: BookOpen,
        color: "bg-secondary/15 text-secondary border-secondary/30",
      },
    ],
  },
  {
    roleTitle: "Modules Pédagogiques",
    items: [
      {
        title: "Rapports mensuels certifiés",
        description: "Relevés d'assiduité ASP et exports PDF/Excel.",
        href: "/pedagogical/reports",
        icon: FileSpreadsheet,
        color: "bg-status-present-bg text-status-present border-status-present-border/40",
      },
      {
        title: "Gestion des formations",
        description: "Cursus professionnels certifiants, durées et inscriptions.",
        href: "/pedagogical/courses",
        icon: GraduationCap,
        color: "bg-surface-container text-primary border-border-subtle",
      },
      {
        title: "Matières & Emplois du temps",
        description: "Catalogue de modules et calendrier hebdomadaire récurrent.",
        href: "/pedagogical/timetable",
        icon: BookOpen,
        color: "bg-surface-container text-secondary border-border-subtle",
      },
    ],
  },
  {
    roleTitle: "Modules Secrétariat & Formateurs",
    items: [
      {
        title: "Supervision des Émargements",
        description: "Supervision multi-filières des 15 promotions, régularisation et gestion des absences formateurs.",
        href: "/pedagogical/emargement",
        icon: CheckCircle2,
        color: "bg-status-present-bg text-status-present border-status-present-border/40",
      },
      {
        title: "Justificatifs d'absences",
        description: "Saisie et annulation d'arrêts maladie et dispenses.",
        href: "/secretary/justifications",
        icon: FileCheck,
        color: "bg-status-late-bg text-status-late border-status-late-border/40",
      },
      {
        title: "Import de stagiaires",
        description: "Intégration en masse des promotions via CSV/Excel.",
        href: "/secretary/import",
        icon: UploadCloud,
        color: "bg-surface-container text-secondary border-border-subtle",
      },
      {
        title: "Calendrier de l'établissement",
        description: "Jours fériés et périodes d'ouverture/fermeture.",
        href: "/secretary/calendar",
        icon: CalendarCheck,
        color: "bg-surface-container text-primary border-border-subtle",
      },
    ],
  },
];

export default function AdminHubPage() {
  const announce = useAnnounce();
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <ProtectedPage
      title="Centre d'Administration Global"
      description="Supervision intégrale de l'application, gestion des comptes utilisateurs, sécurité et accès rapide à tous les modules métiers."
      permission="audit.read"
    >
      {(actor) => {
        const handleSync = async () => {
          setBusy(true);
          try {
            const res = await syncCatalogFormations(actor);
            const msg = `Catalogue CFRP synchronisé : ${res.created} promotions créées, ${res.updated} promotions mises à jour avec durées officielles.`;
            setMaintenanceMsg(msg);
            announce(msg);
          } catch {
            announce("Échec de la synchronisation du catalogue.", "assertive");
          } finally {
            setBusy(false);
          }
        };

        return (
          <div className="flex flex-col gap-8">
            {/* Guide officiel interactif en 8 étapes */}
            <ApplicationGuide defaultOpen={false} />

            {maintenanceMsg && (
              <Alert tone="info">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{maintenanceMsg}</span>
                </div>
              </Alert>
            )}

            {/* Outils de mise en production et de maintenance pour l'administrateur */}
            <section
              aria-labelledby="prod-heading"
              className="p-5 sm:p-6 rounded-2xl border-2 border-secondary/40 bg-surface-container-lowest shadow-xs flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2.5">
                  <Wrench className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
                  <div>
                    <h2 id="prod-heading" className="text-lg font-bold text-primary">
                      Mise en service &amp; Maintenance de production
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Préparez une base de données 100 % vierge et conforme pour le centre CFRP Valentin Haüy.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ConfirmDialog
                    triggerLabel={busy ? "Synchronisation…" : "Synchroniser les promotions officielles CFRP"}
                    triggerAccessibleLabel="Synchroniser les promotions officielles du catalogue CFRP Valentin Haüy"
                    title="Synchroniser le catalogue officiel du CFRP ?"
                    description="Cette opération vérifie et active toutes les promotions officielles par année (TIP 1, TIP 2, Kiné K1-K4, CAGA 1-2, Prépa Info...) et enregistre leurs durées réglementaires."
                    confirmLabel="Synchroniser le catalogue"
                    onConfirm={handleSync}
                  />
                </div>
              </div>
            </section>

            {/* Modules du centre organisés par secteur */}
            {ADMIN_SECTIONS.map((sec) => (
              <section key={sec.roleTitle} className="flex flex-col gap-3">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true"></span>
                  <span>{sec.roleTitle}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sec.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`flex flex-col justify-between p-5 rounded-2xl border bg-surface-container-lowest shadow-xs hover:border-secondary transition-all hover:shadow-md ${focusRing}`}
                      >
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <div className={`p-2.5 rounded-xl border ${it.color}`}>
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-primary">{it.title}</h3>
                            <p className="mt-1 text-xs text-on-surface-variant">{it.description}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-secondary">
                          <span>Accéder</span>
                          <span aria-hidden="true">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        );
      }}
    </ProtectedPage>
  );
}
