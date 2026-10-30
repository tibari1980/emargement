"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "./ui/Button";

interface GuideStep {
  number: number;
  title: string;
  badge: string;
  role: string;
  href?: string;
  description: string;
  checklist: string[];
}

const STEPS: GuideStep[] = [
  {
    number: 1,
    title: "Comptes du personnel & Rôles",
    badge: "Indispensable",
    role: "Administrateur",
    href: "/admin/users",
    description:
      "Créez les comptes individuels pour chaque membre de l'équipe du centre. Chaque rôle dispose d'un espace dédié et sécurisé.",
    checklist: [
      "Secrétariat : imports de fichiers, justificatifs médicaux, calendrier des fermetures.",
      "Responsables pédagogiques : plannings, durées des formations, homologation des rapports.",
      "Formateurs : émargement des cours en temps réel, feuilles d'émargement quotidiennes.",
      "Administrateur : gestion des utilisateurs, audit de sécurité et maintenance.",
    ],
  },
  {
    number: 2,
    title: "Formations & Promotions par année",
    badge: "Catalogue officiel",
    role: "Pédagogie / Admin",
    href: "/pedagogical/courses",
    description:
      "Activez l'offre de formation réelle du CFRP Valentin Haüy. Les cursus pluriannuels séparent distinctement la 1ère et la 2ème année (mêmes formateurs, promotions distinctes).",
    checklist: [
      "Filière Informatique : TIP 1 (1ère année), TIP 2 (2ème année), Préparatoire informatique (1 an).",
      "Filière Masso-Kinésithérapie : Prépa kiné (1 an) + IFMK K1, K2, K3, K4 (sur 4 ans).",
      "Filière Tertiaire : CAGA 1ère année et CAGA 2ème année (sur 2 ans).",
      "Autonomie & Métiers : Cycles (1 an), Massages bien-être (1 an), Adaptation (1 an), Tremplin-DV.",
    ],
  },
  {
    number: 3,
    title: "Matières adaptées du centre",
    badge: "Pédagogie",
    role: "Pédagogie",
    href: "/pedagogical/subjects",
    description:
      "Configurez les matières enseignées adaptées à la déficience visuelle. Les 13 matières officielles du centre peuvent être initialisées en 1 clic.",
    checklist: [
      "Outils adaptés & Accessibilité (lecteurs d'écran NVDA/JAWS, plages braille, téléagrandisseurs).",
      "Braille intégral et abrégé, Locomotion & Déplacements urbains autonomes.",
      "Systèmes d'exploitation & Réseaux, Support matériel & Téléassistance, Algorithmique.",
      "Bureautique adaptée, Communication professionnelle, Anatomie & Physiologie.",
    ],
  },
  {
    number: 4,
    title: "Emplois du temps hebdomadaires",
    badge: "Planification",
    role: "Pédagogie",
    href: "/pedagogical/timetable",
    description:
      "Définissez les créneaux réguliers pour chaque promotion. Chaque créneau associe une formation, un formateur habilité, un horaire et une salle adaptée.",
    checklist: [
      "Contrôle automatique anti-chevauchement (un formateur ne peut pas enseigner à deux endroits à la fois).",
      "Prise en compte des volumes horaires réglementaires pour les financeurs.",
      "Consultation instantanée dans l'onglet « Plannings » par formation ou par formateur.",
    ],
  },
  {
    number: 5,
    title: "Importation des vrais stagiaires",
    badge: "Données réelles",
    role: "Secrétariat / Admin",
    href: "/secretary/import",
    description:
      "Inscrivez les vrais stagiaires du centre par lot de fichier sans saisie manuelle fastidieuse.",
    checklist: [
      "Téléchargez le modèle vierge officiel au format Excel (.xlsx) ou CSV.",
      "Renseignez les colonnes : Nom, Prénom, Email, Téléphone (les dates et tiers-temps sont facultatifs).",
      "Choisissez la promotion de destination (ex. TIP 1ère année) et validez l'import.",
      "Zéro doublon : l'application réutilise automatiquement les fiches existantes si déjà présentes.",
    ],
  },
  {
    number: 6,
    title: "Émargement numérique quotidien",
    badge: "Chaque séance",
    role: "Formateurs / Pédagogie",
    href: "/trainer/attendance",
    description:
      "Les formateurs pointent en direct les présences, absences et retards lors de chaque séance de cours.",
    checklist: [
      "Bouton « Marquer tous présents » pour émarger en un clic l'ensemble du groupe.",
      "Pointage individuel avec horodatage électronique certifié à la minute près.",
      "Raccourcis clavier accessibles (P = Présent, R = Retard, A = Absent) et synthèse vocale ARIA.",
      "Navigation au clavier conforme RGAA 4.1 AAA avec contraste jaune/noir renforcé.",
    ],
  },
  {
    number: 7,
    title: "Justificatifs d'absence & Fermetures",
    badge: "Secrétariat",
    role: "Secrétariat",
    href: "/secretary/justifications",
    description:
      "Le secrétariat enregistre les arrêts maladie, convocations ou justificatifs médicaux pour neutraliser les absences.",
    checklist: [
      "Saisie d'un justificatif pour un stagiaire sur une période donnée.",
      "Les séances d'absence passent automatiquement en « Absence justifiée ».",
      "Calendrier de l'établissement : injection des 11 jours fériés nationaux en 1 clic.",
    ],
  },
  {
    number: 8,
    title: "Rapports mensuels & Homologation financeurs",
    badge: "Certification",
    role: "Pédagogie / Secrétariat",
    href: "/pedagogical/reports",
    description:
      "Générez les relevés mensuels officiels d'assiduité conformes aux exigences DGEFP, France Travail, AGEFIPH et Région Île-de-France.",
    checklist: [
      "Calcul certifié : Heures théoriques - Absences injustifiées = Heures réalisées finançables.",
      "Export PDF certifié pour transmission aux organismes tiers payeurs.",
      "Export Excel (.xlsx) pour traitement administratif et comptabilité.",
    ],
  },
];

export function ApplicationGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      aria-labelledby="guide-heading"
      className="rounded-2xl border-2 border-secondary/40 bg-surface-container-lowest p-5 sm:p-6 shadow-sm flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-white shadow-xs">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 id="guide-heading" className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
              <span>Guide officiel d&apos;utilisation &amp; Déploiement</span>
              <span className="inline-flex rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-bold text-on-primary">
                8 étapes
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Méthodologie pas-à-pas pour tester et mettre en service l&apos;application au sein de l&apos;ESRP / CFRP Valentin Haüy.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={() => setIsOpen((prev) => !prev)}
          className="!min-h-10 !px-3.5 text-xs sm:text-sm inline-flex items-center gap-2 rounded-xl"
          aria-expanded={isOpen}
          aria-controls="guide-content"
        >
          {isOpen ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
              <span>Masquer le guide</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              <span>Afficher le guide pas-à-pas</span>
            </>
          )}
        </Button>
      </div>

      {isOpen && (
        <div id="guide-content" className="flex flex-col gap-5 pt-2 animate-in fade-in duration-200">
          <div className="rounded-xl border border-secondary/20 bg-surface-container-low p-4 flex items-start gap-3 text-xs sm:text-sm text-on-surface">
            <ShieldCheck className="h-5 w-5 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong>Mode Production &amp; Déploiement Réel :</strong> Suivez les étapes ci-dessous dans l&apos;ordre pour configurer un environnement 100 % opérationnel avec de vraies données. Chaque module a été validé selon les critères d&apos;accessibilité <strong>RGAA 4.1 AAA</strong> pour les personnes déficientes visuelles.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {STEPS.map((s) => (
              <div
                key={s.number}
                className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-container-low p-4 sm:p-5 shadow-xs hover:border-secondary/50 transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary font-bold text-xs">
                      {s.number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                        {s.role}
                      </span>
                      <span className="text-[11px] font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded-md">
                        {s.badge}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-primary">
                    {s.title}
                  </h3>

                  <p className="text-xs text-on-surface-variant">
                    {s.description}
                  </p>

                  <ul className="mt-2 space-y-1.5 text-xs text-on-surface border-t border-border-subtle pt-2.5">
                    {s.checklist.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {s.href && (
                  <div className="mt-4 pt-3 border-t border-border-subtle">
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline cursor-pointer"
                    >
                      <span>Accéder au module</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
