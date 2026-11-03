"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Accessibility,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Keyboard,
  Landmark,
  Layers,
  Printer,
  Receipt,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button, focusRing } from "@/components/ui/Button";
import type { Role } from "@/lib/domain/types";

type GuideRole = "trainer" | "secretary" | "pedagogical_lead" | "admin" | "accessibility";

interface RoleTab {
  id: GuideRole;
  label: string;
  badge: string;
  icon: typeof GraduationCap;
  description: string;
}

const ROLE_TABS: RoleTab[] = [
  {
    id: "trainer",
    label: "Formateur",
    badge: "Émargement direct",
    icon: GraduationCap,
    description: "Guide étape par étape pour faire l'émargement de vos cours, gérer les retards et utiliser les raccourcis clavier.",
  },
  {
    id: "secretary",
    label: "Secrétariat",
    badge: "Administration & ASP",
    icon: Receipt,
    description: "Guide complet pour importer les stagiaires, enregistrer les justificatifs médicaux et préparer la déclaration ASP.",
  },
  {
    id: "pedagogical_lead",
    label: "Responsable Pédagogique",
    badge: "Formations & Plannings",
    icon: Compass,
    description: "Guide pour gérer l'offre de formation, concevoir les emplois du temps et homologuer les bilans d'assiduité.",
  },
  {
    id: "admin",
    label: "Administrateur",
    badge: "Sécurité & Comptes",
    icon: ShieldCheck,
    description: "Guide pour créer les comptes du personnel, surveiller le journal de sécurité et assurer la conformité RGPD.",
  },
  {
    id: "accessibility",
    label: "Accessibilité & Lecteurs d'écran",
    badge: "Tous profils",
    icon: Accessibility,
    description: "Guide technique d'accessibilité universelle (NVDA, JAWS, VoiceOver, Orca, contrastes et navigation clavier).",
  },
];

function GuidePageContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") as GuideRole | null;

  // Initial tab based on URL param or current user's role
  const [activeTab, setActiveTab] = useState<GuideRole>("trainer");
  const [expandedFaq, setExpandedFaq] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (roleParam && ROLE_TABS.some((t) => t.id === roleParam)) {
      setActiveTab(roleParam);
    } else if (profile?.role) {
      if (profile.role === "trainer") setActiveTab("trainer");
      else if (profile.role === "secretary") setActiveTab("secretary");
      else if (profile.role === "pedagogical_lead") setActiveTab("pedagogical_lead");
      else if (profile.role === "admin") setActiveTab("admin");
    }
  }, [roleParam, profile]);

  const toggleFaq = (key: string) => {
    setExpandedFaq((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* 1. EN-TÊTE CHALEUREUX & INSTITUTIONNEL */}
      <header className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1 font-bold text-xs uppercase tracking-wide text-on-primary">
                <BookOpen className="h-4 w-4 text-focus-outer shrink-0" aria-hidden="true" />
                Manuel Utilisateur Officiel
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <ShieldCheck className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                Conforme RGAA 4.1 AAA &amp; Qualiopi
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-surface-container px-2.5 py-1 rounded-lg">
                ESRP / CFRP Valentin Haüy
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Guide d&apos;Utilisation Pas-à-Pas &amp; Manuel d&apos;Assistance
            </h1>
            <p className="text-base text-on-surface-variant leading-relaxed">
              Bienvenue dans votre guide d&apos;utilisation accessible. Ce manuel a été rédigé avec bienveillance dans un langage simple,
              humain et précis pour vous accompagner étape par étape, quel que soit votre rôle et que vous utilisiez un lecteur d&apos;écran
              (NVDA, JAWS, VoiceOver, Orca), une plage braille ou la navigation au clavier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center shrink-0">
            <Button
              variant="secondary"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 !px-4 !py-2.5 text-sm"
              aria-label="Imprimer le guide d'utilisation de l'espace sélectionné"
            >
              <Printer className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span>Imprimer cette fiche</span>
            </Button>
            <Link
              href="/"
              className={`inline-flex min-h-10 items-center justify-center rounded-xl bg-surface-container px-4 py-2 text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>

        {/* 2. SÉLECTEUR DE RÔLE ACCESSIBLE (Radix / ARIA tablist) */}
        <div className="mt-2 pt-4 border-t border-border-subtle">
          <p className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">
            Choisissez votre profil pour consulter le guide qui vous correspond :
          </p>
          <div
            role="tablist"
            aria-label="Choisir le guide d'utilisation selon votre profil"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5"
          >
            {ROLE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary-container text-on-primary shadow-md ring-2 ring-primary ring-offset-2"
                      : "border-border-subtle bg-surface-container-low text-on-surface hover:bg-surface-container"
                  } ${focusRing}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-focus-outer" : "text-secondary"}`} aria-hidden="true" />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isSelected ? "bg-white/20 text-white" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <span className="text-sm font-bold mt-1 leading-snug">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 3. CONTENU DÉTAILLÉ SELON LE RÔLE */}

      {/* =========================================================================
       * GUIDE FORMATEUR
       * ========================================================================= */}
      {activeTab === "trainer" && (
        <section
          id="panel-trainer"
          role="tabpanel"
          aria-labelledby="tab-trainer"
          tabIndex={0}
          className="flex flex-col gap-6 outline-none"
        >
          {/* Bandeau d'accueil Formateur */}
          <div className="rounded-2xl border-l-4 border-l-status-present border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-present-bg text-status-present">
                <GraduationCap className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary">
                  Espace Formateur — Le Guide de l&apos;Émargement Quotidien
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Votre mission principale : certifier la présence de vos stagiaires à chaque séance de cours.
                </p>
              </div>
            </div>
          </div>

          {/* Étape 1 : Connexion */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                1
              </span>
              <h3 className="text-lg font-bold text-primary">
                Connexion à votre espace personnel
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Rendez-vous sur la page de connexion avec votre identifiant (votre adresse email professionnelle) et votre mot de passe temporaire transmis par l&apos;administration.
              </p>
              <div className="rounded-xl bg-surface-container-low p-3.5 border border-border-subtle flex items-start gap-2.5">
                <Sparkles className="h-5 w-5 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-on-surface font-medium">
                  <strong>Conseil de première connexion :</strong> Cliquez sur votre nom tout en haut à droite (« Mon profil ») pour définir votre mot de passe personnel sécurisé (au moins 12 caractères).
                </p>
              </div>
            </div>
          </article>

          {/* Étape 2 : Vos cours du jour & Sélection de la filière */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                2
              </span>
              <h3 className="text-lg font-bold text-primary">
                Choisir la filière à émarger et visualiser l&apos;état du jour
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Dès votre connexion, vous arrivez sur votre page <strong>« Émargement &amp; Suivi des Séances »</strong> (<Link href="/trainer/emargement" className="text-secondary font-bold underline">accéder</Link>). Vous y disposez de :
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-on-surface">
                <li><strong>Sélecteur de Filière / Promotion :</strong> choisissez directement la promotion (ex. <em>[ADAPT] Adaptation aux outils et à l&apos;autonomie (8 stagiaires)</em>, <em>TIP 1ère année</em>, <em>TIP 2ème année</em>, <em>IFMK Kiné K1–K4</em>).</li>
                <li><strong>Tableau de bord « État des émargements du jour par filière » :</strong> chaque séance affiche en temps réel un badge <strong>🔴 À émarger (0/8)</strong>, <strong>🟠 En cours (x/8)</strong> ou <strong>🟢 Complet (8/8)</strong>. Cliquez sur une carte pour ouvrir instantanément sa feuille d&apos;émargement.</li>
                <li><strong>Navigation rapide Week-end &amp; Jours fériés :</strong> si vous ouvrez l&apos;application un samedi, un dimanche ou un jour férié, deux boutons vous permettent d&apos;ouvrir en 1 clic le <strong>Dernier jour ouvré</strong> ou le <strong>Prochain jour ouvré</strong>.</li>
              </ul>
              <p className="mt-1">
                Vous pouvez également cliquer sur l&apos;onglet <strong>« Plannings »</strong> pour afficher la vue semaine complète de vos interventions, et sur l&apos;icône <strong>Cloche (<kbd className="px-1.5 py-0.5 rounded bg-surface-container border text-xs font-mono">Alt + N</kbd>)</strong> pour consulter vos notifications.
              </p>
            </div>
          </article>

          {/* Étape 3 : La règle d'or temporelle */}
          <article className="rounded-2xl border border-secondary/40 bg-surface-container-low p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-white font-bold text-sm">
                3
              </span>
              <h3 className="text-lg font-bold text-primary">
                La règle d&apos;or temporelle (Synchronisée sur l&apos;Heure de Paris) : quand pouvez-vous émarger ?
              </h3>
            </div>
            <div className="text-sm text-on-surface flex flex-col gap-3 pl-11">
              <p>
                Pour garantir la sincérité juridique des émargements demandée pour l&apos;ASP, l&apos;horloge de l&apos;application est synchronisée avec le serveur officiel (fuseau <code>Europe/Paris</code>) :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-surface-container-lowest p-3 border border-border-subtle">
                  <span className="font-bold text-outline block mb-1">⏳ Avant la séance (ou date future)</span>
                  <p className="text-on-surface-variant">
                    <strong>Anticipation strictement interdite :</strong> la feuille est verrouillée. Vous voyez la liste des stagiaires, mais tous les boutons (Présent, Retard, Absent, Marquer tous présents) sont désactivés jusqu&apos;à l&apos;heure exacte de début du cours.
                  </p>
                </div>
                <div className="rounded-xl bg-status-present-bg p-3 border border-status-present-border/40">
                  <span className="font-bold text-status-present block mb-1">🟢 Pendant la séance (+15 min)</span>
                  <p className="text-on-surface">
                    <strong>Émargement ouvert :</strong> la feuille se déverrouille automatiquement de l&apos;heure de début jusqu&apos;à 15 minutes après la fin du créneau pour le formateur titulaire (ou son remplaçant désigné).
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-lowest p-3 border border-border-subtle">
                  <span className="font-bold text-primary block mb-1">🔒 Après la séance (ou date passée)</span>
                  <p className="text-on-surface-variant">
                    <strong>Séance clôturée (Lecture seule) :</strong> au-delà des 15 minutes de tolérance, l&apos;émargement est verrouillé pour le formateur (y compris si l&apos;onglet était resté ouvert). Toute régularisation relève du Secrétariat ou du Responsable Pédagogique.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 4 : Comment pointer */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                4
              </span>
              <h3 className="text-lg font-bold text-primary">
                Comment pointer facilement vos stagiaires
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <div className="rounded-xl border border-status-present-border/40 bg-status-present-bg/40 p-3.5 flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-status-present shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="text-status-present block">Le bouton magique « Marquer tous présents »</strong>
                  <p className="text-xs text-on-surface mt-0.5">
                    Si l&apos;ensemble du groupe est à l&apos;heure, cliquez simplement sur le bouton jaune en haut à droite. En 1 seconde, tous les stagiaires passent en « Présent » avec signature électronique.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary text-sm flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-status-late" aria-hidden="true" />
                    Un stagiaire arrive en retard ?
                  </strong>
                  <p className="text-on-surface-variant">
                    Cliquez sur <strong>« Retard »</strong> sur sa ligne. Saisissez son heure réelle d&apos;arrivée (ex. <em>09:20</em>). Le système calcule immédiatement les minutes de retard sans aucune erreur.
                  </p>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary text-sm flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-status-absent" aria-hidden="true" />
                    Un stagiaire est absent ?
                  </strong>
                  <p className="text-on-surface-variant">
                    Cliquez sur <strong>« Absent »</strong>. Si le stagiaire avait un arrêt maladie déjà enregistré par le secrétariat, son statut passe automatiquement en <em>Absence justifiée</em> sans pénalité pour lui.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 5 : Raccourcis clavier accessibles pour formateurs non-voyants */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                5
              </span>
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-secondary" aria-hidden="true" />
                <span>Raccourcis clavier accessibles (NVDA, JAWS, VoiceOver)</span>
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                Si vous êtes non-voyant ou malvoyant, vous pouvez effectuer l&apos;intégralité de l&apos;émargement sans jamais toucher à la souris :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container p-2.5 text-center">
                  <kbd className="px-2 py-1 rounded-md bg-surface-container-lowest font-mono font-bold text-primary shadow-xs border">P</kbd>
                  <span className="block mt-1.5 font-bold text-status-present">Présent</span>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container p-2.5 text-center">
                  <kbd className="px-2 py-1 rounded-md bg-surface-container-lowest font-mono font-bold text-primary shadow-xs border">R</kbd>
                  <span className="block mt-1.5 font-bold text-status-late">En retard</span>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container p-2.5 text-center">
                  <kbd className="px-2 py-1 rounded-md bg-surface-container-lowest font-mono font-bold text-primary shadow-xs border">A</kbd>
                  <span className="block mt-1.5 font-bold text-status-absent">Absent</span>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container p-2.5 text-center">
                  <kbd className="px-2 py-1 rounded-md bg-surface-container-lowest font-mono font-bold text-primary shadow-xs border">J</kbd>
                  <span className="block mt-1.5 font-bold text-status-excused">Justifié</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant">
                Utilisez la touche <kbd className="px-1.5 py-0.5 rounded bg-surface-container border text-[11px] font-mono">Tab</kbd> pour vous déplacer de stagiaire en stagiaire. Chaque statut validé est immédiatement vocalisé par votre lecteur d&apos;écran via l&apos;annuaire ARIA.
              </p>
            </div>
          </article>

          {/* Étape 5 bis : Protection des justificatifs d'absence */}
          <article className="rounded-2xl border-2 border-status-excused/40 bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-excused text-white font-bold text-sm">
                🛡️
              </span>
              <h3 className="text-lg font-bold text-primary">
                Protection des absences justifiées : que faire si un stagiaire excusé arrive en cours ?
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                L&apos;application protège automatiquement les démarches médicales et administratives des stagiaires :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary font-bold">1. Verrouillage préventif anti-écrasement</strong>
                  <p className="text-on-surface-variant">
                    Lorsqu&apos;une absence a été justifiée par le secrétariat, les boutons <strong>Retard</strong> et <strong>Absent</strong> ainsi que les raccourcis <kbd className="px-1 rounded bg-surface-container">R</kbd> et <kbd className="px-1 rounded bg-surface-container">A</kbd> sont verrouillés pour empêcher toute perte accidentelle du justificatif.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary font-bold">2. Confirmation pour présence physique</strong>
                  <p className="text-on-surface-variant">
                    Si le stagiaire vient finalement assister au cours, cliquez sur <strong>Présent</strong> (ou touche <kbd className="px-1 rounded bg-surface-container">P</kbd>). Une boîte de dialogue modale s&apos;ouvre pour vous demander confirmation avant d&apos;annuler le justificatif au profit de sa présence physique effective.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 6 : Que faire en cas d'absence du formateur */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                6
              </span>
              <h3 className="text-lg font-bold text-primary">
                Que faire si vous êtes malade ou indisponible ?
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Prévenez simplement le secrétariat ou votre responsable pédagogique le plus tôt possible. L&apos;application gère automatiquement 3 solutions professionnelles :
              </p>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-on-surface text-xs">
                <li><strong>Affectation d&apos;un formateur remplaçant :</strong> qui a immédiatement accès à votre feuille de cours pour émarger à votre place.</li>
                <li><strong>Travaux Pratiques / Travail libre encadré en autonomie :</strong> le secrétariat supervise les stagiaires en salle et valide leur présence à 100%.</li>
                <li><strong>Annulation administrative :</strong> la séance est dispensée par le centre ; <em>le stagiaire n&apos;est jamais pénalisé</em> et aucune retenue n&apos;est appliquée sur son allocation ASP.</li>
              </ol>
            </div>
          </article>
        </section>
      )}

      {/* =========================================================================
       * GUIDE SECRÉTARIAT
       * ========================================================================= */}
      {activeTab === "secretary" && (
        <section
          id="panel-secretary"
          role="tabpanel"
          aria-labelledby="tab-secretary"
          tabIndex={0}
          className="flex flex-col gap-6 outline-none"
        >
          {/* Bandeau d'accueil Secrétariat */}
          <div className="rounded-2xl border-l-4 border-l-secondary border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-secondary">
                <Receipt className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary">
                  Espace Secrétariat — Manuel Administratif &amp; Déclaration ASP
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Imports de stagiaires, enregistrement des arrêts maladie, calendrier des fermetures et télétransmission mensuelle de la rémunération ASP.
                </p>
              </div>
            </div>
          </div>

          {/* Étape 0 : Supervision Multi-Filières de l'Émargement & Absences Formateurs */}
          <article className="rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-sm">
                ★
              </span>
              <h3 className="text-lg font-bold text-primary">
                Comment savoir quelle filière émarger et superviser toutes les promotions ?
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Émargement »</strong> (<Link href="/trainer/emargement" className="text-secondary font-bold underline">accéder</Link>), le Secrétariat dispose d&apos;une vue transversale sur toutes les filières du centre :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">1. Tableau de bord multi-filières</span>
                  <p className="text-on-surface-variant">
                    Visualisez d&apos;un coup d&apos;œil toutes les promotions ayant cours ce jour avec leur badge : <strong>🔴 À émarger (0/8)</strong>, <strong>🟠 En cours</strong> ou <strong>🟢 Complet (8/8)</strong>.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">2. Sélecteur de Filière &amp; Régularisation</span>
                  <p className="text-on-surface-variant">
                    Choisissez n&apos;importe quelle filière (<em>Adaptation</em>, <em>TIP 1</em>, <em>TIP 2</em>, <em>Kiné</em>...) pour saisir ou régulariser les présences à tout moment.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">3. Absence d&apos;un formateur</span>
                  <p className="text-on-surface-variant">
                    Cliquez sur <strong>« Gérer l&apos;absence du formateur »</strong> pour affecter un remplaçant, passer la classe en <em>TP supervisé</em> ou annuler la séance sans pénaliser les stagiaires.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 1 : Importation massive de stagiaires */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                1
              </span>
              <h3 className="text-lg font-bold text-primary">
                Inscrire les stagiaires en masse par fichier Excel ou CSV
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                Rendez-vous sur l&apos;onglet <strong>« Import de stagiaires »</strong> (<Link href="/secretary/import" className="text-secondary font-bold underline">accéder à la page</Link>).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">A. Télécharger le modèle</span>
                  <p className="text-on-surface-variant">
                    Cliquez sur <em>Télécharger le modèle Excel (.xlsx)</em>. Il contient les colonnes officielles pré-formatées : Nom, Prénom, Email, Téléphone.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">B. Choisir la promotion</span>
                  <p className="text-on-surface-variant">
                    Sélectionnez la promotion de rattachement (ex: <em>TIP 1ère année</em>). Les stagiaires y seront directement inscrits.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <span className="font-bold text-primary">C. Importer en un clic</span>
                  <p className="text-on-surface-variant">
                    Glissez votre fichier. L&apos;application supprime les doublons éventuels et crée toutes les fiches en quelques secondes.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 2 : Justificatifs d'absence */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                2
              </span>
              <h3 className="text-lg font-bold text-primary">
                Enregistrer un justificatif d&apos;absence (Arrêt maladie, convocation...)
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                Lorsqu&apos;un stagiaire vous transmet un arrêt de travail, un certificat médical ou une convocation administrative :
              </p>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-on-surface text-xs">
                <li>Allez sur l&apos;onglet <strong>« Justificatifs »</strong> (<Link href="/secretary/justifications" className="text-secondary font-bold underline">accéder</Link>).</li>
                <li>Sélectionnez la formation, puis le stagiaire dans la liste déroulante.</li>
                <li>Indiquez la <strong>Date de début</strong> et la <strong>Date de fin</strong> mentionnées sur le document.</li>
                <li>Choisissez le motif officiel (<em>Arrêt maladie</em>, <em>Rendez-vous médical</em>, <em>Convocation administrative</em>, <em>Hospitalisation</em>, <em>Événement familial</em>).</li>
                <li>Cliquez sur <strong>« Justifier les séances »</strong>.</li>
              </ol>
              <div className="rounded-xl bg-status-present-bg/30 p-3 border border-status-present-border/40 text-xs">
                <strong className="text-status-present block">Résultat instantané :</strong>
                Toutes les séances de cours tombant dans cette période passent automatiquement en <em>« Absence justifiée »</em>. Elles ne feront l&apos;objet d&apos;aucune retenue indue sur l&apos;allocation ASP !
              </div>
            </div>
          </article>

          {/* Étape 3 : Déclaration ASP Mensuelle */}
          <article className="rounded-2xl border-2 border-secondary bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-white font-bold text-sm">
                3
              </span>
              <h3 className="text-lg font-bold text-primary">
                Préparer et télétransmettre l&apos;état mensuel à l&apos;ASP (Rémunération RSFP)
              </h3>
            </div>
            <div className="text-sm text-on-surface flex flex-col gap-3 pl-11">
              <p>
                À la fin du mois, rendez-vous sur <strong>« Rapports mensuels »</strong> (<Link href="/pedagogical/reports" className="text-secondary font-bold underline">accéder</Link>) :
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="rounded-xl bg-surface-container-low p-3 border border-border-subtle">
                  <strong className="text-primary block text-sm">1. Basculer sur le « Bordereau Déclaration ASP »</strong>
                  <p className="text-on-surface-variant mt-0.5">
                    Cliquez sur le bouton d&apos;onglet en haut du rapport. Le tableau s&apos;adapte immédiatement aux colonnes de l&apos;ASP avec la colonne <strong>« Déduction ASP »</strong> en évidence.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3 border border-border-subtle">
                  <strong className="text-primary block text-sm">2. Vérifier les exclusions automatiques</strong>
                  <p className="text-on-surface-variant mt-0.5">
                    Le système garantit que <strong>les week-ends (samedi et dimanche)</strong> ainsi que <strong>les 11 jours fériés légaux français</strong> sont strictement exclus. Aucune heure d&apos;absence ne peut être comptée sur ces jours.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3 border border-border-subtle">
                  <strong className="text-primary block text-sm">3. Contrôler le détail d&apos;un stagiaire avant envoi</strong>
                  <p className="text-on-surface-variant mt-0.5">
                    Cliquez sur le bouton <strong>« Fiche ASP »</strong> sur la ligne du stagiaire. Vous accédez au <em>Journal chronologique séance par séance</em> pour vérifier chaque date, chaque heure de retard et chaque motif de justificatif.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3 border border-border-subtle">
                  <strong className="text-primary block text-sm">4. Exporter les bordereaux officiels</strong>
                  <p className="text-on-surface-variant mt-0.5">
                    Téléchargez l&apos;<strong>Export XLSX</strong> (qui comprend l&apos;onglet spécialisé <em>Bordereau_ASP_Rémunération</em>) ou générez le <strong>Relevé PDF officiel</strong> signé électroniquement.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Étape 4 : Calendrier des fermetures & Import en lot */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                4
              </span>
              <h3 className="text-lg font-bold text-primary">
                Gérer le calendrier de fermeture et importer en lot (Excel / CSV)
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Calendrier »</strong> (<Link href="/secretary/calendar" className="text-secondary font-bold underline">accéder</Link>), vous définissez les jours fériés, ponts et congés pédagogiques :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary font-bold">1. Les 11 jours fériés nationaux</strong>
                  <p className="text-on-surface-variant">
                    Un bouton permet d&apos;ajouter en 1 clic tous les jours fériés de l&apos;année (Pâques, Ascension, 14 Juillet, 11 Novembre, Noël...).
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary font-bold">2. Saisie manuelle rapide</strong>
                  <p className="text-on-surface-variant">
                    Formulaire simple pour saisir un pont ou une journée pédagogique avec intitulé, type et dates.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 flex flex-col gap-1">
                  <strong className="text-primary font-bold">3. Import en lot (Excel / CSV)</strong>
                  <p className="text-on-surface-variant">
                    Téléchargez le modèle Excel officiel avec liste de choix sur le type. Glissez le fichier pour prévisualiser les dates et valider l&apos;import de toute l&apos;année scolaire en 2 secondes.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* =========================================================================
       * GUIDE RESPONSABLE PÉDAGOGIQUE
       * ========================================================================= */}
      {activeTab === "pedagogical_lead" && (
        <section
          id="panel-pedagogical"
          role="tabpanel"
          aria-labelledby="tab-pedagogical_lead"
          tabIndex={0}
          className="flex flex-col gap-6 outline-none"
        >
          {/* Bandeau d'accueil Pédagogie */}
          <div className="rounded-2xl border-l-4 border-l-primary border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                <Compass className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary">
                  Espace Responsable Pédagogique — Pilotage de l&apos;Offre &amp; Plannings
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Configuration des filières de formation, structuration des emplois du temps et homologation certifiée Qualiopi / DGEFP.
                </p>
              </div>
            </div>
          </div>

          {/* Étape 1 : Formations */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                1
              </span>
              <h3 className="text-lg font-bold text-primary">
                Gérer l&apos;offre de formation officielle du CFRP
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Formations »</strong> (<Link href="/pedagogical/courses" className="text-secondary font-bold underline">accéder</Link>), vous configurez les promotions :
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-on-surface text-xs">
                <li><strong>Filière Informatique :</strong> TIP 1 (1ère année), TIP 2 (2ème année), Préparatoire informatique.</li>
                <li><strong>Filière Masso-Kinésithérapie :</strong> Prépa kiné + IFMK K1, K2, K3, K4 sur 4 ans.</li>
                <li><strong>Filière Tertiaire :</strong> CAGA 1ère et 2ème année.</li>
                <li><strong>Autonomie :</strong> Cycles, Massages bien-être, Adaptation et Tremplin.</li>
              </ul>
              <p className="text-xs text-on-surface-variant mt-1">
                Chaque formation possède son volume horaire réglementaire, ses dates de session et son rattachement certificateur (Qualiopi).
              </p>
            </div>
          </article>

          {/* Étape 2 : Matières adaptées */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                2
              </span>
              <h3 className="text-lg font-bold text-primary">
                Définir les matières adaptées à la déficience visuelle
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Matières »</strong> (<Link href="/pedagogical/subjects" className="text-secondary font-bold underline">accéder</Link>), vous paramétrez les modules spécifiques au centre :
                <em> Braille</em>, <em>Locomotion &amp; Déplacements</em>, <em>Outils adaptés (NVDA, JAWS)</em>, <em>Bureautique adaptée</em>, etc.
              </p>
            </div>
          </article>

          {/* Étape 3 : Emplois du temps hebdomadaires */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                3
              </span>
              <h3 className="text-lg font-bold text-primary">
                Construire les emplois du temps avec contrôle anti-chevauchement
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Emplois du temps »</strong> (<Link href="/pedagogical/timetable" className="text-secondary font-bold underline">accéder</Link>), ajoutez les créneaux récurrents de la semaine :
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-on-surface text-xs">
                <li>Sélectionnez le jour (Lundi au Vendredi), l&apos;heure de début et de fin.</li>
                <li>Attribuez la matière et le formateur titulaire.</li>
                <li><strong>Sécurité intégrée :</strong> Le système vous alerte automatiquement si un formateur est déjà programmé sur un autre cours à la même heure.</li>
              </ul>
            </div>
          </article>
        </section>
      )}

      {/* =========================================================================
       * GUIDE ADMINISTRATEUR
       * ========================================================================= */}
      {activeTab === "admin" && (
        <section
          id="panel-admin"
          role="tabpanel"
          aria-labelledby="tab-admin"
          tabIndex={0}
          className="flex flex-col gap-6 outline-none"
        >
          {/* Bandeau d'accueil Admin */}
          <div className="rounded-2xl border-l-4 border-l-primary-container border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary">
                  Cockpit Administrateur — Sécurité, Comptes &amp; Audit RGPD
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Supervision globale, gestion des habilitations professionnelles, traçabilité inaltérable et intégrité de la plateforme.
                </p>
              </div>
            </div>
          </div>

          {/* Étape 1 : Gestion des utilisateurs */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                1
              </span>
              <h3 className="text-lg font-bold text-primary">
                Créer et gérer les comptes du personnel
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Rendez-vous sur l&apos;onglet <strong>« Utilisateurs »</strong> (<Link href="/admin/users" className="text-secondary font-bold underline">accéder</Link>) :
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-on-surface text-xs">
                <li>Créez les comptes individuels : Nom, Prénom, Email et Rôle (Formateur, Secrétariat, Responsable pédagogique, Administrateur).</li>
                <li><strong>Exigences de sécurité ANSSI :</strong> Les mots de passe doivent comporter au moins 12 caractères avec majuscule, minuscule, chiffre et symbole.</li>
                <li><strong>Désactivation sans perte :</strong> Si un collaborateur quitte l&apos;établissement, vous pouvez désactiver son compte en 1 clic : ses accès sont immédiatement révoqués mais tout son historique d&apos;émargement est scrupuleusement conservé pour les audits.</li>
              </ul>
            </div>
          </article>

          {/* Étape 2 : Journal d'Audit */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-sm">
                2
              </span>
              <h3 className="text-lg font-bold text-primary">
                Surveiller le Journal d&apos;Activité &amp; la Traçabilité légale
              </h3>
            </div>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2 pl-11">
              <p>
                Sur l&apos;onglet <strong>« Journal d&apos;activité »</strong> (<Link href="/admin/audit" className="text-secondary font-bold underline">accéder</Link>), chaque action réalisée sur l&apos;application est tracée de manière inaltérable :
                <em> Qui a émargé ? À quelle seconde ? Quelle adresse IP ? Quelle modification sur un justificatif ?</em>
                Ce journal certifié constitue la preuve formelle lors des audits (Qualiopi, ASP).
              </p>
            </div>
          </article>
        </section>
      )}

      {/* =========================================================================
       * GUIDE ACCESSIBILITÉ UNIVERSELLE & LECTEURS D'ÉCRAN
       * ========================================================================= */}
      {activeTab === "accessibility" && (
        <section
          id="panel-accessibility"
          role="tabpanel"
          aria-labelledby="tab-accessibility"
          tabIndex={0}
          className="flex flex-col gap-6 outline-none"
        >
          {/* Bandeau d'accueil Accessibilité */}
          <div className="rounded-2xl border-l-4 border-l-primary border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                <Accessibility className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary">
                  Accessibilité Universelle — Recommandations RGAA 4.1 AAA &amp; Outils d&apos;Assistance
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Guide complet pour les personnes aveugles, malvoyantes, sourdes, malentendantes ou avec handicap moteur.
                </p>
              </div>
            </div>
          </div>

          {/* Outils d'assistance visuelle */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-secondary" aria-hidden="true" />
              <span>Personnaliser l&apos;affichage (Contraste renforcé &amp; Taille de texte)</span>
            </h3>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3">
              <p>
                Cliquez sur le bouton <strong>« A± Accessibilité »</strong> présent en permanence dans la barre du haut (ou appuyez sur la touche <kbd className="px-1.5 py-0.5 rounded bg-surface-container border text-xs font-mono">Alt + A</kbd>) :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3">
                  <strong className="text-primary block mb-1">Contraste renforcé</strong>
                  <p className="text-on-surface-variant">
                    Bascule en mode jaune sur fond noir absolu, offrant un contraste supérieur à 14:1 pour les personnes malvoyantes.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3">
                  <strong className="text-primary block mb-1">Agrandissement du texte</strong>
                  <p className="text-on-surface-variant">
                    Passez à 125% ou 140% sans déformer les tableaux ni créer de défilement horizontal parasite.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3">
                  <strong className="text-primary block mb-1">Police Atkinson Hyperlegible</strong>
                  <p className="text-on-surface-variant">
                    Typographie spécialement développée par le Braille Institute pour éliminer toute ambiguïté visuelle entre les lettres et chiffres (ex: 0 et O, 1 et l).
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Référentiel complet des raccourcis clavier */}
          <article className="rounded-2xl border border-secondary/30 bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <h3 className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-secondary" aria-hidden="true" />
                <span>Référentiel complet des raccourcis clavier de l&apos;application</span>
              </h3>
              <span className="text-xs font-bold text-secondary bg-surface-container px-2.5 py-1 rounded-full shrink-0">
                Navigation 100% sans souris
              </span>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              Pour garantir une efficacité maximale aux personnes aveugles, malvoyantes ou naviguant exclusivement au clavier,
              l&apos;application dispose de raccourcis universels et métier directement actifs :
            </p>

            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[620px]">
                <thead>
                  <tr className="bg-surface-container border-b border-border-subtle font-bold text-primary">
                    <th scope="col" className="p-3">Raccourci clavier</th>
                    <th scope="col" className="p-3">Contexte</th>
                    <th scope="col" className="p-3">Action exécutée</th>
                    <th scope="col" className="p-3">Retour vocal (Lecteur d&apos;écran)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-surface-container-lowest">
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-primary">
                      <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Alt + M</kbd>
                    </td>
                    <td className="p-3 font-semibold text-secondary">Global (Toutes pages)</td>
                    <td className="p-3 text-on-surface">Bascule instantanément entre le <strong>Mode Standard</strong> et le <strong>Mode Sombre</strong>.</td>
                    <td className="p-3 text-on-surface-variant italic">« Thème sombre à fort contraste activé » / « Contraste standard activé »</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-primary">
                      <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Alt + A</kbd>
                    </td>
                    <td className="p-3 font-semibold text-secondary">Global (Toutes pages)</td>
                    <td className="p-3 text-on-surface">Ouvre la boîte de dialogue des <strong>Options d&apos;accessibilité</strong> (taille 100%, 125%, 140%, contrastes, espacements).</td>
                    <td className="p-3 text-on-surface-variant italic">Ouvre le dialogue avec focus automatique sur la fermeture.</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-primary">
                      <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Alt + N</kbd>
                    </td>
                    <td className="p-3 font-semibold text-secondary">Global (Toutes pages)</td>
                    <td className="p-3 text-on-surface">Ouvre ou referme le <strong>Centre de notifications</strong> (alertes d&apos;émargement, justificatifs en attente).</td>
                    <td className="p-3 text-on-surface-variant italic">Vocalise le nombre d&apos;alertes non lues.</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-primary">
                      <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Échap (Escape)</kbd>
                    </td>
                    <td className="p-3 font-semibold text-secondary">Modales &amp; Menus</td>
                    <td className="p-3 text-on-surface">Ferme immédiatement la fenêtre modale, le tiroir mobile ou le menu ouvert et replace le focus sur le déclencheur.</td>
                    <td className="p-3 text-on-surface-variant italic">Fermeture propre avec repositionnement du focus.</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-status-present">
                      <kbd className="px-2 py-1 rounded bg-status-present-bg text-status-present border border-status-present-border text-xs">P</kbd>
                    </td>
                    <td className="p-3 font-semibold text-primary">Feuille d&apos;émargement</td>
                    <td className="p-3 text-on-surface">Sur une ligne ou carte stagiaire : valide instantanément la présence (<strong>Présent</strong>).</td>
                    <td className="p-3 text-on-surface-variant italic">« [Nom du stagiaire] marqué présent »</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-status-late">
                      <kbd className="px-2 py-1 rounded bg-status-late-bg text-status-late border border-status-late-border text-xs">R</kbd>
                    </td>
                    <td className="p-3 font-semibold text-primary">Feuille d&apos;émargement</td>
                    <td className="p-3 text-on-surface">Sur une ligne ou carte stagiaire : marque le stagiaire <strong>En retard</strong> et active la saisie de l&apos;heure d&apos;arrivée.</td>
                    <td className="p-3 text-on-surface-variant italic">« [Nom du stagiaire] marqué en retard »</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-status-absent">
                      <kbd className="px-2 py-1 rounded bg-status-absent-bg text-status-absent border border-status-absent-border text-xs">A</kbd>
                    </td>
                    <td className="p-3 font-semibold text-primary">Feuille d&apos;émargement</td>
                    <td className="p-3 text-on-surface">Sur une ligne ou carte stagiaire : valide l&apos;absence injustifiée (<strong>Absent</strong>).</td>
                    <td className="p-3 text-on-surface-variant italic">« [Nom du stagiaire] marqué absent »</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-primary">
                      <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Tab</kbd> / <kbd className="px-2 py-1 rounded bg-surface-container border text-xs">Shift + Tab</kbd>
                    </td>
                    <td className="p-3 font-semibold text-secondary">Navigation séquentielle</td>
                    <td className="p-3 text-on-surface">Passe à l&apos;élément interactif suivant ou précédent avec indicateur de focus haute visibilité (anneau double bicolore).</td>
                    <td className="p-3 text-on-surface-variant italic">Vocalise l&apos;intitulé et le rôle de l&apos;élément sélectionné.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          {/* Lecteurs d'écran & Commandes dédiées */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-secondary" aria-hidden="true" />
              <span>Guide d&apos;utilisation des lecteurs d&apos;écran (NVDA, JAWS, VoiceOver, Orca)</span>
            </h3>
            <div className="text-sm text-on-surface-variant flex flex-col gap-3">
              <p>
                L&apos;ensemble de l&apos;application est conçu et vérifié pour offrir une expérience fluide, rapide et prédictible avec les lecteurs d&apos;écran majeurs :
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3.5 flex flex-col gap-1.5">
                  <strong className="text-primary font-bold text-sm">NVDA (Windows)</strong>
                  <ul className="list-disc pl-4 space-y-1 text-on-surface">
                    <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">NVDA + F7</kbd> : Ouvre la <strong>Liste des éléments</strong> (Liens, Titres, Boutons, Régions).</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">K</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Shift + K</kbd> : Sauter directement au lien suivant ou précédent.</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">B</kbd> : Sauter de bouton en bouton.</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">H</kbd> : Naviguer de titre en titre pour une vue d&apos;ensemble.</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">D</kbd> : Passer de région en région (Bannière, Navigation, Principal, Pied de page).</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3.5 flex flex-col gap-1.5">
                  <strong className="text-primary font-bold text-sm">JAWS, VoiceOver &amp; Orca</strong>
                  <ul className="list-disc pl-4 space-y-1 text-on-surface">
                    <li><strong>JAWS (Windows) :</strong> <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Insert + F7</kbd> liste tous les liens de la page.</li>
                    <li><strong>VoiceOver (macOS / iOS) :</strong> Utilisez le rotor (<kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">VO + U</kbd> ou geste rotatif sur iPhone/iPad) pour naviguer par liens, boutons ou titres.</li>
                    <li><strong>Orca (Linux) :</strong> Navigation par touches de saut rapide ou affichage de la liste d&apos;éléments (<kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Alt + Maj + L</kbd>).</li>
                  </ul>
                </div>
              </div>

              {/* Règle d'or WCAG 2.5.3 : Label in Name */}
              <div className="rounded-xl border-2 border-secondary/40 bg-surface-container-low p-3.5 text-xs text-on-surface flex flex-col gap-1">
                <strong className="text-primary font-bold text-sm">Conformité WCAG 2.5.3 (Label in Name / Étiquette dans le nom) :</strong>
                <p className="leading-relaxed">
                  Tous les liens et boutons de l&apos;application ont été audités pour que leur <strong>intitulé accessible commence exactement par leur texte visible</strong>.
                  Dans la boîte <kbd className="px-1 rounded bg-surface-container font-mono">NVDA + F7</kbd>, vous pouvez ainsi appuyer directement sur la touche <kbd className="px-1 rounded bg-surface-container font-mono">C</kbd> pour atteindre <strong>« Connexion »</strong>, sur <kbd className="px-1 rounded bg-surface-container font-mono">G</kbd> pour <strong>« Guide »</strong>, ou sur <kbd className="px-1 rounded bg-surface-container font-mono">D</kbd> pour <strong>« Déconnexion »</strong> sans aucun décalage alphabétique.
                </p>
              </div>

              {/* Notifications et Centre d'alertes */}
              <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3.5 text-xs text-on-surface flex flex-col gap-2">
                <strong className="text-primary font-bold text-sm flex items-center gap-2">
                  <span>Centre de notifications en temps réel (<kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Alt + N</kbd>)</span>
                </strong>
                <p className="leading-relaxed">
                  L&apos;icône cloche située dans le bandeau supérieur affiche en permanence le nombre d&apos;alertes non lues. Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Alt + N</kbd> depuis n&apos;importe quelle page pour ouvrir le tiroir des notifications :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-on-surface-variant">
                  <li><strong>Formateurs :</strong> alertés en direct dès qu&apos;un arrêt maladie ou justificatif est déposé pour un stagiaire de leur cours, ou en cas d&apos;annulation de cours.</li>
                  <li><strong>Secrétariat &amp; Responsables pédagogiques :</strong> informés lors de la finalisation des émargements, des imports de stagiaires ou de modifications de calendrier.</li>
                  <li><strong>Tous profils :</strong> alertes d&apos;information institutionnelle, mises à jour de planning et rappels réglementaires ASP / DGEFP.</li>
                </ul>
              </div>
            </div>
          </article>

          {/* Personnes sourdes / malentendantes et handicap moteur */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-3">
            <h3 className="text-lg font-bold text-primary">
              Handicap auditif, moteur et troubles cognitifs
            </h3>
            <div className="text-sm text-on-surface-variant flex flex-col gap-2">
              <p>
                <strong>Sourds et malentendants :</strong> Aucun signal sonore n&apos;est utilisé de manière exclusive. Chaque confirmation ou alerte bénéficie d&apos;un bandeau textuel clair avec icône distinctive.
              </p>
              <p>
                <strong>Handicap moteur :</strong> Toutes les cibles interactives (boutons, liens, sélecteurs) mesurent au moins 44 par 44 pixels. Les délais de session sont très confortables et aucune action n&apos;est chronométrée.
              </p>
            </div>
          </article>
        </section>
      )}

      {/* 4. FOIRE AUX QUESTIONS HUMAINE (FAQ) */}
      <section aria-labelledby="faq-heading" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col gap-4">
        <h2 id="faq-heading" className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-secondary shrink-0" aria-hidden="true" />
          <span>Foire Aux Questions Fréquentes (FAQ)</span>
        </h2>
        <p className="text-sm text-on-surface-variant">
          Des réponses concrètes aux questions les plus courantes pour vous dépanner immédiatement :
        </p>

        <div className="flex flex-col gap-3 mt-2">
          {/* FAQ 1 */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-low overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq("pwd")}
              aria-expanded={expandedFaq["pwd"] ?? false}
              aria-controls="faq-ans-pwd"
              className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <span>J&apos;ai oublié mon mot de passe ou mon compte est bloqué, que faire ?</span>
              {expandedFaq["pwd"] ? <ChevronUp className="h-5 w-5 text-secondary shrink-0" /> : <ChevronDown className="h-5 w-5 text-secondary shrink-0" />}
            </button>
            {expandedFaq["pwd"] && (
              <div id="faq-ans-pwd" className="p-4 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-border-subtle bg-surface-container-lowest">
                Contactez votre secrétariat ou votre administrateur. Ils peuvent réinitialiser votre mot de passe en 1 clic dans l&apos;onglet « Utilisateurs » et vous fournir un lien de connexion immédiat.
              </div>
            )}
          </div>

          {/* FAQ 2 */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-low overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq("ferie")}
              aria-expanded={expandedFaq["ferie"] ?? false}
              aria-controls="faq-ans-ferie"
              className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <span>Est-ce qu&apos;un jour férié ou un week-end peut être compté en absence ?</span>
              {expandedFaq["ferie"] ? <ChevronUp className="h-5 w-5 text-secondary shrink-0" /> : <ChevronDown className="h-5 w-5 text-secondary shrink-0" />}
            </button>
            {expandedFaq["ferie"] && (
              <div id="faq-ans-ferie" className="p-4 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-border-subtle bg-surface-container-lowest">
                <strong>Absolument jamais !</strong> Le moteur de calcul exclut systématiquement les samedis, les dimanches et les 11 jours fériés nationaux français. Même si aucun clic n&apos;a été fait dans le calendrier, ces jours ne sont jamais comptabilisés en heures dues ni en absences stagiaires.
              </div>
            )}
          </div>

          {/* FAQ 3 */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-low overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq("asp_err")}
              aria-expanded={expandedFaq["asp_err"] ?? false}
              aria-controls="faq-ans-asp_err"
              className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <span>Pourquoi la colonne « Déduction ASP » apparaît-elle en rouge pour un stagiaire ?</span>
              {expandedFaq["asp_err"] ? <ChevronUp className="h-5 w-5 text-secondary shrink-0" /> : <ChevronDown className="h-5 w-5 text-secondary shrink-0" />}
            </button>
            {expandedFaq["asp_err"] && (
              <div id="faq-ans-asp_err" className="p-4 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-border-subtle bg-surface-container-lowest">
                Cette alerte signale au secrétariat que ce stagiaire a des <strong>absences injustifiées ou des retards</strong> sur le mois qui donneront lieu à une retenue financière sur son allocation par l&apos;ASP. Cliquez sur « Fiche ASP » pour vérifier si un arrêt maladie n&apos;a pas été oublié avant de finaliser l&apos;envoi.
              </div>
            )}
          </div>

          {/* FAQ 4 */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-low overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq("nvda")}
              aria-expanded={expandedFaq["nvda"] ?? false}
              aria-controls="faq-ans-nvda"
              className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <span>Comment faire un émargement rapide avec NVDA ou JAWS ?</span>
              {expandedFaq["nvda"] ? <ChevronUp className="h-5 w-5 text-secondary shrink-0" /> : <ChevronDown className="h-5 w-5 text-secondary shrink-0" />}
            </button>
            {expandedFaq["nvda"] && (
              <div id="faq-ans-nvda" className="p-4 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-border-subtle bg-surface-container-lowest">
                En entrant sur la page d&apos;émargement, appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">B</kbd> pour atteindre le bouton « Marquer tous présents », ou naviguez dans la liste des stagiaires avec <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">Tab</kbd> et pressez la touche <kbd className="px-1.5 py-0.5 rounded bg-surface-container border font-mono">P</kbd> pour valider un présent. Le lecteur vocal vous confirme immédiatement la validation.
              </div>
            )}
          </div>

          {/* FAQ 5 */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-low overflow-hidden">
            <button
              type="button"
              onClick={() => toggleFaq("shortcuts")}
              aria-expanded={expandedFaq["shortcuts"] ?? false}
              aria-controls="faq-ans-shortcuts"
              className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <span>Quels sont les raccourcis clavier pour basculer en mode sombre et naviguer sans souris ?</span>
              {expandedFaq["shortcuts"] ? <ChevronUp className="h-5 w-5 text-secondary shrink-0" /> : <ChevronDown className="h-5 w-5 text-secondary shrink-0" />}
            </button>
            {expandedFaq["shortcuts"] && (
              <div id="faq-ans-shortcuts" className="p-4 pt-1 text-xs sm:text-sm text-on-surface-variant border-t border-border-subtle bg-surface-container-lowest flex flex-col gap-2">
                <p>
                  L&apos;application intègre des raccourcis universels utilisables depuis n&apos;importe quelle page :
                </p>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-xs text-on-surface">
                  <li><kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">Alt + M</kbd> : Bascule instantanément entre le <strong>Mode Standard</strong> et le <strong>Mode Sombre</strong> (avec annonce vocale).</li>
                  <li><kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">Alt + A</kbd> : Ouvre la boîte de dialogue d&apos;accessibilité (contrastes, tailles de police 100%, 125%, 140%, interligne).</li>
                  <li><kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">Alt + N</kbd> : Ouvre ou referme le centre de notifications et d&apos;alertes.</li>
                  <li><kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">Échap</kbd> : Ferme toute boîte de dialogue ou fenêtre modale ouverte.</li>
                  <li><kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">P</kbd>, <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">R</kbd>, <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container border">A</kbd> : Sur une feuille d&apos;émargement, valide directement un stagiaire Présent (P), Retard (R) ou Absent (A).</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-on-surface-variant font-bold">
          Chargement du guide…
        </div>
      }
    >
      <GuidePageContent />
    </Suspense>
  );
}
