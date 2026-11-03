"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Accessibility,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  EyeOff,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartHandshake,
  Layers,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Volume2,
} from "lucide-react";
import { useAccessibility, type ContrastMode, type FontSize } from "@/components/AccessibilityProvider";
import { useAuth } from "@/components/AuthProvider";
import { focusRing } from "@/components/ui/Button";
import { homeFor } from "@/lib/core/navigation";
import { ROLE_LABELS } from "@/lib/domain/types";

export default function LandingPage() {
  const { user, profile } = useAuth();
  const { contrast, setContrast, fontSize, setFontSize } = useAccessibility();

  return (
    <div className="flex flex-col gap-8 sm:gap-14 pb-8 sm:pb-12">
      {/* 0. BANDEAU UTILISATEUR CONNECTÉ (Si déjà authentifié) */}
      {user && profile && (
        <section
          aria-label="Votre session active"
          className="rounded-2xl border-2 border-primary/40 bg-surface-container-high p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-white font-bold text-sm shadow-xs">
              {profile.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Session active
              </p>
              <h2 className="text-base sm:text-lg font-bold text-on-surface truncate">
                Bonjour, {profile.fullName} ({ROLE_LABELS[profile.role]})
              </h2>
            </div>
          </div>
          <Link
            href={homeFor(profile.role)}
            className={`inline-flex w-full sm:w-auto justify-center min-h-11 items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-bold text-on-primary shadow-xs hover:opacity-95 transition-opacity ${focusRing}`}
          >
            <span>Accéder à mon espace ({ROLE_LABELS[profile.role]})</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* 1. HERO SECTION : L'AUTONOMIE EN PREMIER PLAN */}
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-8 lg:p-12 shadow-sm"
      >
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-12 lg:items-center">
          {/* Colonne Gauche : Titre, Mission & CTAs */}
          <div className="flex flex-col gap-5 sm:gap-6 lg:col-span-7">
            {/* Badges d'homologation & Œil d'accessibilité */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary shadow-xs">
                <ShieldCheck className="h-4 w-4 text-focus-outer shrink-0" aria-hidden="true" />
                <span>Plateforme Certifiée ESRP / CFRP</span>
              </span>

              {/* L'Œil de l'Accessibilité - Repère visuel central */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-container-high px-3 py-1 text-xs font-bold text-secondary">
                <Eye className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Œil de l&apos;Accessibilité · RGAA 4.1 AAA</span>
              </span>
            </div>

            {/* Titre Principal */}
            <h1
              id="hero-title"
              className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-primary leading-tight"
            >
              L&apos;émargement et le suivi pédagogique certifié,{" "}
              <span className="text-secondary underline decoration-focus-outer decoration-4 underline-offset-4">
                au service de l&apos;autonomie
              </span>{" "}
              de chacun.
            </h1>

            {/* Sous-titre & descriptif */}
            <p className="text-sm sm:text-lg text-on-surface-variant leading-relaxed max-w-2xl">
              Bienvenue sur la plateforme officielle de l&apos;<strong>ESRP / CFRP Valentin Haüy</strong>.
              Conçue pour et avec des personnes aveugles, malvoyantes et l&apos;ensemble de la communauté pédagogique,
              elle garantit un suivi de présence infalsifiable, des feuilles d&apos;émargement conformes
              et un accompagnement sur-mesure vers l&apos;insertion professionnelle.
            </p>

            {/* Boutons d'Action Principaux */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-1">
              <Link
                href={user && profile ? homeFor(profile.role) : "/login"}
                className={`inline-flex w-full sm:w-auto justify-center min-h-12 items-center gap-2.5 rounded-xl bg-primary-container px-5 sm:px-6 py-3 text-sm sm:text-base font-bold text-on-primary shadow-md hover:opacity-95 transition-all ${focusRing}`}
              >
                <LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{user && profile ? "Accéder à mon espace" : "Connexion à l'espace certifié"}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>

              <a
                href="#accessibilite-vision"
                className={`inline-flex w-full sm:w-auto justify-center min-h-12 items-center gap-2 rounded-xl border-2 border-border-subtle bg-surface-container-high px-5 py-3 text-sm sm:text-base font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
              >
                <Eye className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
                <span>Confort visuel &amp; Accessibilité</span>
              </a>
            </div>

            {/* Micro-engagements de confiance */}
            <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-y-2 gap-x-6 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
                <span>Horodatage et Suivi Certifiés ASP</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
                <span>Lecteurs d&apos;écran (JAWS, NVDA, VoiceOver)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
                <span>Contraste renforcé Jaune / Noir</span>
              </span>
            </div>
          </div>

          {/* Colonne Droite : Photo Authentique (Femme avec Chien Guide et Canne) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative w-full max-w-md lg:max-w-none overflow-hidden rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-border-subtle bg-surface-container shadow-xl">
              <Image
                src="/images/autonomie-guide-dog.jpg"
                alt="Jeune femme malvoyante souriante marchant avec assurance dans une rue piétonne ensoleillée, guidée par son chien guide Labrador et tenant sa canne blanche"
                width={800}
                height={600}
                priority
                className="w-full h-auto object-cover max-h-[380px] sm:max-h-[460px] hover:scale-102 transition-transform duration-500"
              />

              {/* Badges superposés sur l'image */}
              <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-4 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 backdrop-blur-md px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-white border border-white/20 shadow-md">
                  <Eye className="h-3.5 w-3.5 text-yellow-300 shrink-0" aria-hidden="true" />
                  <span>Autonomie &amp; Inclusion</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-yellow-300 border border-yellow-300/40">
                  ESRP / CFRP
                </span>
              </div>

              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 rounded-xl sm:rounded-2xl bg-black/85 backdrop-blur-md p-2.5 sm:p-3 text-white border border-white/10 shadow-lg pointer-events-none">
                <p className="text-xs font-bold leading-snug text-yellow-300 flex items-center gap-1.5">
                  <HeartHandshake className="h-4 w-4 text-yellow-300 shrink-0" aria-hidden="true" />
                  <span>Au service des personnes aveugles et malvoyantes</span>
                </p>
                <p className="text-[11px] text-gray-200 mt-0.5 hidden xs:block">
                  Formations professionnelles diplômantes &amp; réadaptation vers l&apos;emploi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. IDENTITÉ VALENTIN HAÜY : MISSION & ENGAGEMENT */}
      <section
        aria-labelledby="mission-heading"
        className="rounded-2xl sm:rounded-3xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-8 lg:p-10 shadow-sm"
      >
        <div className="grid gap-8 md:grid-cols-12 items-center">
          {/* Logo officiel Valentin Haüy mis en valeur */}
          <div className="logo-container md:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-border-subtle shadow-xs">
            <Image
              src="/images/logo-valentin-hauy.png"
              alt="Logo officiel de l'Association Valentin Haüy — Avec les aveugles et les malvoyants — Agir pour l'autonomie"
              width={320}
              height={200}
              className="w-full max-w-[260px] h-auto object-contain"
            />
            <p className="mt-4 text-center text-xs font-semibold text-gray-700 border-t border-gray-200 pt-2 w-full">
              Pionnier de l&apos;autonomie des personnes déficientes visuelles depuis 1889
            </p>
          </div>

          {/* Présentation du centre ESRP / CFRP */}
          <div className="md:col-span-8 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                Centre de Réadaptation Professionnelle
              </span>
            </div>
            <h2 id="mission-heading" className="text-xl sm:text-3xl font-extrabold text-primary">
              Former, accompagner et certifier vers l&apos;emploi durable
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
              Le <strong>CFRP / ESRP Valentin Haüy</strong> accueille des adultes en situation de handicap visuel
              pour des parcours d&apos;évaluation, de pré-orientation et de formation qualifiante.
              Notre plateforme numérique assure la conformité rigoureuse des présences exigée
              pour l&apos;ASP tout en offrant une interface nativement accessible.
            </p>

            <blockquote className="rounded-2xl border-l-4 border-secondary bg-surface-container-high p-4 text-sm sm:text-base italic text-on-surface">
              « Donner aux personnes déficientes visuelles les moyens de leur pleine autonomie sociale, civique et professionnelle. »
            </blockquote>
          </div>
        </div>
      </section>

      {/* 3. L'ŒIL DE L'ACCESSIBILITÉ : UN SYSTÈME PENSÉ POUR TOUS LES REGARDS */}
      <section
        id="accessibilite-vision"
        aria-labelledby="vision-heading"
        className="rounded-2xl sm:rounded-3xl border-2 border-secondary/30 bg-surface-container-lowest p-4 sm:p-8 lg:p-10 shadow-sm flex flex-col gap-6 sm:gap-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-on-secondary shadow-sm">
              <Eye className="h-7 w-7 text-focus-outer" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                Technologie Inclusive
              </span>
              <h2 id="vision-heading" className="text-xl sm:text-2xl font-extrabold text-primary">
                L&apos;Œil de l&apos;Accessibilité : Conçu pour tous les regards
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1 rounded-full bg-status-present-bg text-status-present text-xs font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>100% Conforme RGAA 4.1 AAA</span>
          </span>
        </div>

        {/* 3 Profils d'Utilisateurs : Non-voyants, Malvoyants, Voyants */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Carte 1 : Personnes Non-Voyantes */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-low p-5 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-white shrink-0">
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-primary">Personnes Non-Voyantes</h3>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Navigation intégrale à la synthèse vocale (JAWS, NVDA, VoiceOver) et plage tactile braille.
              Balisage sémantique rigoureux, liens d&apos;évitement et alertes vocales en temps réel.
            </p>
            <ul className="text-xs font-semibold text-secondary space-y-1.5 pt-2 border-t border-border-subtle">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Horodatage vocal et annonces ARIA</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Navigation 100% au clavier</span>
              </li>
            </ul>
          </article>

          {/* Carte 2 : Personnes Malvoyantes */}
          <article className="rounded-2xl border-2 border-focus-outer/60 bg-surface-container-low p-5 flex flex-col gap-3 shadow-xs hover:border-focus-outer transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-focus-outer text-navy-deep font-bold shrink-0">
                <Eye className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-primary">Personnes Malvoyantes</h3>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Mode contraste renforcé <strong>Jaune sur Noir</strong> (ratio 19.5:1), typographie
              spécialisée <strong>Atkinson Hyperlegible</strong> et réglage instantané de la taille de texte.
            </p>
            <ul className="text-xs font-semibold text-secondary space-y-1.5 pt-2 border-t border-border-subtle">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Agrandissement 100%, 125%, 140%</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Interlignage aéré (+20%)</span>
              </li>
            </ul>
          </article>

          {/* Carte 3 : Voyants & Équipes Pédagogiques */}
          <article className="rounded-2xl border border-border-subtle bg-surface-container-low p-5 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-white shrink-0">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-primary">Formateurs &amp; Secrétariat</h3>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Interface ergonomique, claire et rapide pour l&apos;encadrement.
              Pointage express des séances, consultation en direct des justificatifs et exports automatisés.
            </p>
            <ul className="text-xs font-semibold text-secondary space-y-1.5 pt-2 border-t border-border-subtle">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Tableaux de présence en temps réel</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-present shrink-0" aria-hidden="true" />
                <span>Télétransmission normalisée en 1 clic</span>
              </li>
            </ul>
          </article>
        </div>

        {/* Démonstrateur Interactif des Modes Visuels (Essayer en direct) */}
        <div className="rounded-2xl border border-border-subtle bg-surface-container-high p-4 sm:p-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-secondary shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm sm:text-base font-bold text-on-surface">
                Testez vos préférences visuelles en direct
              </h4>
              <p className="text-xs text-on-surface-variant">
                Changez le contraste et la taille de police : la page s&apos;adapte immédiatement.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setContrast("standard")}
              aria-pressed={contrast === "standard"}
              className={`min-h-10 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                contrast === "standard"
                  ? "bg-primary-container text-white border-primary-container"
                  : "bg-surface-container text-on-surface border-border-subtle hover:bg-surface-variant"
              } ${focusRing}`}
            >
              ⚪ Standard
            </button>
            <button
              type="button"
              onClick={() => setContrast("high-contrast")}
              aria-pressed={contrast === "high-contrast"}
              className={`min-h-10 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                contrast === "high-contrast"
                  ? "bg-black text-yellow-300 border-yellow-300 ring-2 ring-yellow-300"
                  : "bg-surface-container text-on-surface border-border-subtle hover:bg-surface-variant"
              } ${focusRing}`}
            >
              🟡 Contraste Renforcé
            </button>
            <button
              type="button"
              onClick={() => setContrast("dark")}
              aria-pressed={contrast === "dark"}
              className={`min-h-10 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                contrast === "dark"
                  ? "bg-slate-900 text-white border-slate-700 ring-2 ring-slate-400"
                  : "bg-surface-container text-on-surface border-border-subtle hover:bg-surface-variant"
              } ${focusRing}`}
            >
              🌑 Sombre
            </button>
          </div>
        </div>
      </section>

      {/* 4. LES 4 PILIERS DU SUIVI PÉDAGOGIQUE */}
      <section aria-labelledby="features-heading" className="flex flex-col gap-6">
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            Fonctionnalités Métier
          </span>
          <h2 id="features-heading" className="text-2xl sm:text-3xl font-extrabold text-primary">
            Une architecture certifiée au cœur des exigences de formation
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Tous les modules indispensables réunis pour une gestion rigoureuse, sécurisée et fluide.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Pilier 1 : Émargement */}
          <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container text-white shrink-0">
              <FileCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-primary">Émargement Certifié</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Feuilles de présence numériques horodatées séance par séance. Signature dématérialisée,
              pointage formateur et traçabilité inviolable par journal d&apos;audit.
            </p>
          </div>

          {/* Pilier 2 : Formations & Promotions */}
          <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-white shrink-0">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-primary">Promotions Qualifiantes</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Gestion pluriannuelle des cursus officiels : IFMK Masseur-Kinésithérapeute (K1 à K4),
              Titre TIP, CAGA, DAAV et cycles qualifiants adaptés.
            </p>
          </div>

          {/* Pilier 3 : Justificatifs */}
          <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-focus-outer text-navy-deep font-bold shrink-0">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-primary">Gestion des Justificatifs</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Enregistrement et vérification des arrêts maladie, convocations et dispenses.
              Recalcul immédiat des heures en absence justifiée.
            </p>
          </div>

          {/* Pilier 4 : Rapports & Télétransmission */}
          <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 flex flex-col gap-3 shadow-xs hover:border-secondary transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-status-present text-white shrink-0">
              <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-primary">Rapports &amp; Télétransmission</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Génération mensuelle de relevés d&apos;assiduité certifiés (PDF officiels et tableurs XLSX)
              pour l&apos;ASP (Agence de Services et de Paiement).
            </p>
          </div>
        </div>
      </section>

      {/* 5. ESPACES DE TRAVAIL PAR PROFIL */}
      <section
        aria-labelledby="workspaces-heading"
        className="rounded-2xl sm:rounded-3xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-8 lg:p-10 shadow-sm flex flex-col gap-5 sm:gap-6"
      >
        <div className="flex items-center gap-3">
          <Compass className="h-6 w-6 text-secondary shrink-0" aria-hidden="true" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Espaces Sécurisés
            </span>
            <h2 id="workspaces-heading" className="text-xl sm:text-2xl font-extrabold text-primary">
              Des environnements calibrés pour chaque rôle
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-surface-container-low p-4 flex flex-col gap-2">
            <span className="font-bold text-sm text-primary">Formateurs</span>
            <p className="text-xs text-on-surface-variant">
              Pointage express des présences, plannings de cours, signatures et signalement des retards.
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-container-low p-4 flex flex-col gap-2">
            <span className="font-bold text-sm text-primary">Responsables Pédagogiques</span>
            <p className="text-xs text-on-surface-variant">
              Emplois du temps hebdomadaires, validation des modules, assiduité et coordination des cursus.
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-container-low p-4 flex flex-col gap-2">
            <span className="font-bold text-sm text-primary">Secrétariat</span>
            <p className="text-xs text-on-surface-variant">
              Import de promotions par tableur, gestion des justificatifs d&apos;absence et attestations.
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-container-low p-4 flex flex-col gap-2">
            <span className="font-bold text-sm text-primary">Administrateurs</span>
            <p className="text-xs text-on-surface-variant">
              Gestion globale des comptes, journal d&apos;audit infalsifiable et paramètres d&apos;établissement.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION FINAL */}
      <section
        aria-labelledby="cta-heading"
        className="rounded-2xl sm:rounded-3xl bg-primary-container text-white p-6 sm:p-12 shadow-xl flex flex-col items-center text-center gap-5 sm:gap-6"
      >
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
          <Eye className="h-7 w-7 sm:h-8 sm:w-8 text-focus-outer" aria-hidden="true" />
        </div>
        <div className="max-w-2xl flex flex-col gap-2">
          <h2 id="cta-heading" className="text-xl sm:text-4xl font-extrabold text-white">
            Prêt à accéder à votre espace de formation ?
          </h2>
          <p className="text-xs sm:text-base text-gray-200">
            Connectez-vous avec vos identifiants académiques sécurisés pour débuter votre journée.
          </p>
        </div>
        <Link
          href={user && profile ? homeFor(profile.role) : "/login"}
          className={`inline-flex w-full sm:w-auto justify-center min-h-12 items-center gap-2.5 rounded-xl bg-focus-outer px-6 sm:px-8 py-3.5 text-sm sm:text-base font-extrabold text-navy-deep shadow-lg hover:bg-yellow-300 transition-colors ${focusRing}`}
        >
          <LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{user && profile ? "Accéder à mon tableau de bord" : "Connexion à l'espace de formation"}</span>
        </Link>
      </section>
    </div>
  );
}
