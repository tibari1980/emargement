"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Receipt,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { authFetch, downloadBlob, fileNameFromResponse } from "@/lib/core/apiClient";
import { currentMonth, formatHours, formatMonth, formatShortDate, todayIso } from "@/lib/core/dates";
import { listForFormation } from "@/lib/data/attendances";
import type { Actor } from "@/lib/data/audit";
import { deduplicateFormationsList, getInitialFormations, groupFormations, listFormations } from "@/lib/data/formations";
import { listHolidays } from "@/lib/data/holidays";
import { listSessionOverridesForMonth } from "@/lib/data/sessionOverrides";
import { listSubjects } from "@/lib/data/subjects";
import { listSlots } from "@/lib/data/timetable";
import { listUsersByIds } from "@/lib/data/users";
import {
  computeMonthlyReport,
  type MonthlyReport,
  type TraineeMonthlyHours,
} from "@/lib/domain/hoursCalculator";
import type { Formation } from "@/lib/domain/types";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

interface TransmissionStatus {
  title: string;
  subtitle: string;
  badgeClass: string;
  dotClass: string;
}

function getTransmissionStatus(
  report: MonthlyReport | null,
  month: string,
  currentIsoMonth: string,
): TransmissionStatus {
  if (!report || report.trainees.length === 0) {
    return {
      title: "En attente de stagiaires",
      subtitle: "0 stagiaire inscrit dans la promotion",
      badgeClass: "bg-surface-container text-on-surface-variant border-border-subtle",
      dotClass: "bg-outline",
    };
  }

  if (month > currentIsoMonth) {
    return {
      title: "Période à venir",
      subtitle: "Émargement non ouvert",
      badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
      dotClass: "bg-secondary",
    };
  }

  const unrecorded = report.trainees.reduce(
    (acc, t) => acc + (t.unrecordedDays ?? t.unrecordedSessions ?? 0),
    0,
  );

  if (unrecorded > 0) {
    return {
      title: "Émargement en cours",
      subtitle: `${unrecorded} séance${unrecorded > 1 ? "s" : ""} non émargée${unrecorded > 1 ? "s" : ""}`,
      badgeClass: "bg-status-late-bg text-status-late border-status-late-border/40",
      dotClass: "bg-status-late animate-pulse",
    };
  }

  if (month < currentIsoMonth) {
    return {
      title: "Période clôturable",
      subtitle: "100% émargé • Prêt pour télétransmission",
      badgeClass: "bg-status-present-bg text-status-present border-status-present-border/40",
      dotClass: "bg-status-present animate-pulse",
    };
  }

  return {
    title: "Émargement à jour",
    subtitle: "Séances passées saisies à 100%",
    badgeClass: "bg-status-present-bg text-status-present border-status-present-border/40",
    dotClass: "bg-status-present",
  };
}

export function MonthlyReportView({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const [formations, setFormations] = useState<Formation[]>(() => getInitialFormations());
  const [formationId, setFormationId] = useState(() => {
    const init = getInitialFormations();
    const withTrainees = init.find((f) => (f.traineeIds?.length ?? 0) > 0);
    return withTrainees ? withTrainees.id : (init[0]?.id ?? "");
  });
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [monthNumber, setMonthNumber] = useState(currentMonth().slice(5, 7));
  const [result, setResult] = useState<{ key: string; report?: MonthlyReport; error?: string } | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeMonthlyHours | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // View mode switcher: General consolidated (DGEFP) vs ASP official transmission
  const [viewMode, setViewMode] = useState<"general" | "asp">("general");

  // Trainee detail modal state
  const [modalTab, setModalTab] = useState<"chronology" | "subjects">("chronology");
  const [sessionFilter, setSessionFilter] = useState<"all" | "absences_lates" | "cancelled">("all");

  // Pagination state (10 trainees per page by default)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const month = `${year}-${monthNumber}`;
  const formation = formations?.find((f) => f.id === formationId) ?? null;
  const key = formation ? `${formation.id}|${month}` : null;
  const current = result && result.key === key ? result : null;
  const report = current?.report ?? null;
  const loading = key !== null && !current;

  useEffect(() => {
    setPage(1);
  }, [key]);

  useEffect(() => {
    let stale = false;
    listFormations()
      .then((list) => {
        if (!stale) {
          const deduped = deduplicateFormationsList(list);
          setFormations(deduped);
          if (deduped.length > 0) {
            // Sélection intelligente : choisir en priorité une promotion contenant des stagiaires
            const withTrainees = deduped.find((f) => (f.traineeIds?.length ?? 0) > 0);
            setFormationId(withTrainees ? withTrainees.id : deduped[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn("Reports: listFormations failed", err);
        if (!stale) {
          setFormations([]);
        }
      });
    return () => {
      stale = true;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const list = await listFormations(true);
      const deduped = deduplicateFormationsList(list);
      setFormations(deduped);
      setResult(null);
      announce("Données du rapport actualisées en temps réel.");
    } catch {
      announce("L'actualisation a échoué.", "assertive");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!formation || !key) return;
    let stale = false;
    Promise.all([
      listUsersByIds(formation.traineeIds ?? []).catch(() => []),
      listForFormation(formation.id, [month]).catch(() => []),
      listHolidays().catch(() => []),
      listSlots({ formationId: formation.id }).catch(() => []),
      listSubjects().catch(() => []),
      listSessionOverridesForMonth(month, formation.id).catch(() => []),
    ])
      .then(([trainees, attendances, holidays, slots, subjects, sessionOverrides]) => {
        if (stale) return;
        const subjectTitles = Object.fromEntries(subjects.map((s) => [s.id, s.title]));
        const rep = computeMonthlyReport({
          month,
          formation,
          slots,
          subjectTitles,
          trainees,
          attendances,
          holidays,
          sessionOverrides,
          today: todayIso(),
        });
        setResult({ key, report: rep });
        announce(
          `Rapport de ${formatMonth(month)} calculé : ${rep.trainees.length} stagiaires, ${formatHours(rep.theoreticalHours)} théoriques chacun.`,
        );
      })
      .catch(() => !stale && setResult({ key, error: "Le calcul du rapport a échoué." }));
    return () => {
      stale = true;
    };
  }, [formation, key, month, announce]);

  const handlePrevMonth = () => {
    const m = Number(monthNumber);
    const y = Number(year);
    if (m === 1) {
      setMonthNumber("12");
      setYear(String(y - 1));
    } else {
      setMonthNumber(String(m - 1).padStart(2, "0"));
    }
  };

  const handleNextMonth = () => {
    const m = Number(monthNumber);
    const y = Number(year);
    if (m === 12) {
      setMonthNumber("01");
      setYear(String(y + 1));
    } else {
      setMonthNumber(String(m + 1).padStart(2, "0"));
    }
  };

  const exportReport = async (format: "pdf" | "excel") => {
    if (!report) return;
    setExporting(format);
    try {
      const response = await authFetch(`/api/export-${format}`, { report });
      const extension = format === "pdf" ? "pdf" : "xlsx";
      downloadBlob(await response.blob(), fileNameFromResponse(response, `emargement-${month}.${extension}`));
      announce(`Export ${format === "pdf" ? "PDF" : "Excel"} téléchargé.`);
    } catch {
      announce(`L'exportation ${format.toUpperCase()} a échoué.`, "assertive");
    } finally {
      setExporting(null);
    }
  };

  const currentYr = new Date().getFullYear();
  const years = [String(currentYr - 2), String(currentYr - 1), String(currentYr), String(currentYr + 1)];

  if (!formations) return <Loading label="Chargement des formations…" />;

  const totalTrainees = report?.trainees?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTrainees / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedTrainees = (report?.trainees ?? []).slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. EN-TÊTE INSTITUTIONNEL & ACTIONS GLOBALES (Stitch Design) */}
      <header className="rounded-xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1 font-bold text-xs uppercase tracking-wide text-on-primary">
                <ShieldCheck className="h-4 w-4 text-focus-outer shrink-0" aria-hidden="true" />
                Certification Officielle ASP
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                Période certifiée : {formatMonth(month)}
              </span>
              {formation?.certification && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-surface-container-high px-2.5 py-1 rounded-lg">
                  {formation.certification}
                </span>
              )}
              {formation?.duration && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-lg">
                  {formation.duration}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Rapports Mensuels d&apos;Assiduité &amp; Calcul d&apos;Heures Certifiées
            </h1>
            <p className="text-sm text-on-surface-variant">
              Relevé officiel certifié pour l&apos;ASP (Agence de Services et de Paiement).
              Données sécurisées avec horodatage électronique et conformité d&apos;accessibilité RGAA AAA.
            </p>
          </div>

          {/* Boutons d'actions et d'exportation */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 self-stretch lg:self-center shrink-0 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 !px-3.5 !py-2.5 text-sm flex-1 sm:flex-none"
              aria-label="Actualiser les données du rapport en temps réel"
            >
              <RotateCw className={`h-4 w-4 text-secondary shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{refreshing ? "Actualisation…" : "Actualiser"}</span>
            </Button>

            <Button
              onClick={() => exportReport("pdf")}
              disabled={!report || report.trainees.length === 0 || exporting !== null}
              className="inline-flex items-center justify-center gap-2 !px-4 !py-2.5 text-sm flex-1 sm:flex-none"
              aria-label="Générer et télécharger le relevé global en PDF certifié"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{exporting === "pdf" ? "Génération PDF…" : "Générer Relevé (PDF)"}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportReport("excel")}
              disabled={!report || report.trainees.length === 0 || exporting !== null}
              className="inline-flex items-center justify-center gap-2 !px-4 !py-2.5 text-sm flex-1 sm:flex-none"
              aria-label="Exporter les données au format tableur Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span>{exporting === "excel" ? "Génération…" : "Export XLSX"}</span>
            </Button>
            <Link
              href="/secretary/justifications"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-status-late-border/50 bg-status-late-bg px-3.5 py-2 text-sm font-bold text-status-late transition-colors hover:bg-status-late-bg/80 flex-1 sm:flex-none ${focusRing}`}
            >
              <ClipboardList className="h-4 w-4 text-status-late shrink-0" aria-hidden="true" />
              <span>Justificatifs</span>
            </Link>
          </div>
        </div>

        {/* 2. FILTRES ET PÉRIODES INTERACTIFS */}
        <div className="rounded-xl border border-border-subtle bg-surface-container-low p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          {/* Pagination du mois */}
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-2 py-1.5 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mois précédent"
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 px-3">
              <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span className="text-base font-bold text-primary capitalize">{formatMonth(month)}</span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Mois suivant"
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Sélecteurs de Formation et Année */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 xl:max-w-2xl">
            <div>
              <SelectField
                label="Filière / Promotion"
                value={formationId}
                onChange={(e) => setFormationId(e.target.value)}
                className="!min-h-10 text-sm"
              >
                <option value="">Sélectionner une promotion</option>
                {groupFormations(formations).map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((f) => {
                      const count = f.traineeIds?.length ?? 0;
                      return (
                        <option key={f.id} value={f.id}>
                          {f.title} ({count} stagiaire{count > 1 ? "s" : ""})
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </SelectField>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <SelectField
                  label="Mois"
                  value={monthNumber}
                  onChange={(e) => setMonthNumber(e.target.value)}
                  className="!min-h-10 text-sm capitalize"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={String(i + 1).padStart(2, "0")}>
                      {name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="w-28">
                <SelectField
                  label="Année"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="!min-h-10 text-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          </div>

          {/* Statut de télétransmission dynamique */}
          {(() => {
            const status = getTransmissionStatus(report, month, currentMonth());
            return (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-2 border shrink-0 ${status.badgeClass}`}>
                <div className={`h-3 w-3 rounded-full shrink-0 ${status.dotClass}`} aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{status.title}</span>
                  <span className="text-[11px] opacity-90">{status.subtitle}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </header>

      {current?.error && <Alert tone="error">{current.error}</Alert>}
      {loading && <Loading label="Calcul du rapport en cours…" />}

      {formations.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Calendar className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-primary">Aucune formation active</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Les rapports mensuels d&apos;heures certifiées nécessitent des formations et des stagiaires inscrits.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Link
              href="/pedagogical/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-primary-container px-4 py-2 text-sm font-bold text-on-primary hover:opacity-95 transition-opacity"
            >
              <span>Créer une formation</span>
            </Link>
          </div>
        </div>
      )}

      {report && (
        <section aria-labelledby="report-heading" className="flex flex-col gap-6">
          {/* SÉLECTEUR DE MODE : RELEVÉ GÉNÉRAL vs DÉCLARATION ASP */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-container-low p-2.5 shadow-xs">
            <div role="tablist" aria-label="Mode d'affichage du rapport" className="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-xl border border-border-subtle w-full sm:w-auto">
              <button
                type="button"
                role="tab"
                id="tab-mode-general"
                aria-selected={viewMode === "general"}
                aria-controls="panel-mode-general"
                onClick={() => setViewMode("general")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "general"
                    ? "bg-primary-container text-on-primary shadow-xs ring-2 ring-primary"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Relevé Général d&apos;Assiduité ASP</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-mode-asp"
                aria-selected={viewMode === "asp"}
                aria-controls="panel-mode-asp"
                onClick={() => setViewMode("asp")}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "asp"
                    ? "bg-primary-container text-on-primary shadow-xs ring-2 ring-focus-outer"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Bordereau Déclaration ASP (RSFP)</span>
                {report.aspTotals.traineesWithDeductionsCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-status-absent text-on-primary px-2 py-0.5 text-[10px] font-bold">
                    {report.aspTotals.traineesWithDeductionsCount} avec retenue
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 px-2 text-xs text-on-surface-variant font-medium">
              <span className="h-2 w-2 rounded-full bg-status-present shrink-0" aria-hidden="true" />
              <span>Conforme ASP : week-ends &amp; 11 fériés légaux français exclus</span>
            </div>
          </div>

          {/* 3. TABLEAU DE BORD DES METRICS CERTIFIÉES */}
          {viewMode === "general" ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Carte 1 : Heures Théoriques DGEFP */}
              <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-on-surface-variant truncate">
                    Heures théoriques
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-surface-container text-primary shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
                    {formatHours(report.totals.theoreticalHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
                    {report.workingDays.length}j × {report.trainees.length} stagiaires
                  </p>
                </div>
              </div>

              {/* Carte 2 : Présence Effective Réalisée */}
              <div className="rounded-xl border border-status-present-border/40 bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-status-present truncate">
                    Présence certifiée
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-status-present-bg text-status-present shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-status-present tracking-tight">
                    {formatHours(report.totals.effectivePresenceHours)}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[11px] sm:text-xs font-bold text-status-present">
                    <span>
                      {report.totals.theoreticalHours > 0
                        ? `${((report.totals.effectivePresenceHours / report.totals.theoreticalHours) * 100).toFixed(1)} %`
                        : "0 %"}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-normal text-on-surface-variant truncate">d&apos;assiduité</span>
                  </div>
                </div>
              </div>

              {/* Carte 3 : Absences Justifiées */}
              <div className="rounded-xl border border-status-excused-border/40 bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-status-excused truncate">
                    Abs. justifiées
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-status-excused-bg text-status-excused shrink-0">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-status-excused tracking-tight">
                    {formatHours(report.totals.excusedHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
                    Justificatifs validés
                  </p>
                </div>
              </div>

              {/* Carte 4 : Absences Injustifiées & Retards */}
              <div className="rounded-xl border border-status-absent-border/40 bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-status-absent truncate">
                    Abs. injustifiées
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-status-absent-bg text-status-absent shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-status-absent tracking-tight">
                    {formatHours(report.totals.absentHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-status-late font-bold mt-1 truncate">
                    +{report.totals.lateMinutes} min retards
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CARTES SPÉCIFIQUES BORDEREAU DÉCLARATION ASP */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Carte 1 ASP : Heures Nettes Exigibles */}
              <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-on-surface-variant truncate">
                    Heures nettes exigibles
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-surface-container text-primary shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
                    {formatHours(report.netTheoreticalHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
                    {report.workingDays.length} jours ouvrés nets
                  </p>
                </div>
              </div>

              {/* Carte 2 ASP : Présence Réalisée & TP Autonomie */}
              <div className="rounded-xl border border-status-present-border/40 bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-status-present truncate">
                    Présence certifiée ASP
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-status-present-bg text-status-present shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-status-present tracking-tight">
                    {formatHours(report.totals.effectivePresenceHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
                    Présence cours + TP encadrés
                  </p>
                </div>
              </div>

              {/* Carte 3 ASP : TOTAL HEURES À DÉDUIRE ASP (Injustifiées + Retards) */}
              <div className="rounded-xl border-2 border-status-absent bg-status-absent-bg/40 p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-status-absent truncate">
                    Heures à déduire ASP
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-status-absent text-on-primary shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-status-absent tracking-tight">
                    {formatHours(report.totals.aspDeductibleHours)}
                  </div>
                  <p className="text-[11px] sm:text-xs font-bold text-status-absent mt-1 truncate">
                    {report.aspTotals.traineesWithDeductionsCount} stagiaire(s) avec retenue
                  </p>
                </div>
              </div>

              {/* Carte 4 ASP : Justifiées & Dispensées Organisme */}
              <div className="rounded-xl border border-secondary/30 bg-surface-container-lowest p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-secondary truncate">
                    Justifiées &amp; Dispensées
                  </span>
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-surface-container text-secondary shrink-0">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-2xl sm:text-3xl font-bold text-secondary tracking-tight">
                    {formatHours(report.totals.excusedHours + (report.totals.exemptedHours ?? 0))}
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
                    {formatHours(report.totals.excusedHours)} justifiées + {formatHours(report.totals.exemptedHours ?? 0)} dispenses
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. BANDEAU DE DÉTAIL DU CALENDRIER DU MOIS */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-secondary">
                <Calendar className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="report-heading" className="text-base font-bold text-primary">
                  Structure du mois : {report.formationTitle} ({formatMonth(report.month)})
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {report.workingDays.length} jours travaillés (samedi/dimanche et 11 fériés légaux exclus) • {report.closedDays.length} jours de fermeture • {report.exemptedHours > 0 ? `${formatHours(report.exemptedHours)} dispensées centre • ` : ""}{report.sessionCount} séances
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant">
                {viewMode === "asp" ? "Heures nettes exigibles :" : "Heures par stagiaire :"}
              </span>
              <span className="rounded-lg bg-surface-container px-2.5 py-1 font-mono text-sm font-bold text-primary">
                {formatHours(viewMode === "asp" ? report.netTheoreticalHours : report.theoreticalHours)}
              </span>
            </div>
          </div>

          {/* 5. TABLEAU D'ÉMARGEMENT CONSOLIDÉ (Stitch Data Table) */}
          {report.trainees.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
              <div className="max-w-md">
                <p className="text-base font-bold text-primary">
                  Aucun stagiaire inscrit dans « {formation?.title ?? "cette promotion"} » pour le moment.
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Téléchargez un modèle Excel ou CSV vierge pré-rempli, renseignez vos stagiaires et lancez l&apos;import en quelques secondes.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={formation?.id ? `/secretary/import?formationId=${formation.id}` : "/secretary/import"}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2 text-sm font-bold text-on-primary hover:opacity-95 transition-opacity"
                >
                  <span>Importer des stagiaires</span>
                </Link>
                <Link
                  href={formation?.id ? `/pedagogical/timetable?formationId=${formation.id}` : "/pedagogical/timetable"}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-4 py-2 text-sm font-bold text-primary hover:bg-surface-variant transition-colors"
                >
                  <span>Gérer l&apos;emploi du temps</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Vue Mobile (< 768px) : Cartes d'assiduité individuelles tactiles */}
              <div className="md:hidden flex flex-col gap-3">
                {paginatedTrainees.map((t) => {
                  const percent = Math.round(t.attendanceRate * 100);
                  const isAsp = viewMode === "asp";
                  return (
                    <article
                      key={t.traineeId}
                      className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-4 shadow-xs flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-border-subtle pb-3">
                        <div>
                          <h3 className="text-base font-bold text-primary">{t.fullName}</h3>
                          <span className="text-xs text-on-surface-variant font-mono">ID: {t.traineeId.slice(0, 8)}</span>
                        </div>
                        {isAsp ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              t.aspStatus === "compliant"
                                ? "bg-status-present-bg text-status-present"
                                : t.aspStatus === "has_deductions"
                                  ? "bg-status-absent-bg text-status-absent border border-status-absent"
                                  : "bg-status-late-bg text-status-late"
                            }`}
                          >
                            {t.aspStatus === "compliant"
                              ? "Conforme"
                              : t.aspStatus === "has_deductions"
                                ? `Retenue ${formatHours(t.aspDeductibleHours)}`
                                : "À régulariser"}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              percent >= 90
                                ? "bg-status-present-bg text-status-present"
                                : percent >= 75
                                  ? "bg-status-late-bg text-status-late"
                                  : "bg-status-absent-bg text-status-absent"
                            }`}
                          >
                            {percent} %
                          </span>
                        )}
                      </div>

                      {/* Jauge d'assiduité mobile */}
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            percent >= 90
                              ? "bg-status-present"
                              : percent >= 75
                                ? "bg-status-late"
                                : "bg-status-absent"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                        ></div>
                      </div>

                      {/* Métriques clés en grille 2x2 */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-status-present-bg/30 p-2.5">
                          <span className="text-status-present font-bold block">Présence eff.</span>
                          <span className="text-sm font-bold text-status-present mt-0.5 block font-mono">
                            {formatHours(t.effectivePresenceHours)}
                          </span>
                        </div>
                        <div className={`rounded-xl p-2.5 ${t.aspDeductibleHours > 0 ? "bg-status-absent-bg text-status-absent border border-status-absent/40" : "bg-surface-container"}`}>
                          <span className="font-bold block">
                            {isAsp ? "Déduction ASP" : "Injustifiée"}
                          </span>
                          <span className="text-sm font-bold mt-0.5 block font-mono">
                            {formatHours(isAsp ? t.aspDeductibleHours : t.absentHours)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-status-excused-bg/30 p-2.5">
                          <span className="text-status-excused font-bold block">Justifiée</span>
                          <span className="text-sm font-bold text-status-excused mt-0.5 block font-mono">
                            {formatHours(t.excusedHours)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-status-late-bg/30 p-2.5">
                          <span className="text-status-late font-bold block">Retards</span>
                          <span className="text-sm font-bold text-status-late mt-0.5 block font-mono">
                            {t.lateCount} ({t.lateMinutes}m)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                        <span className="text-xs text-on-surface-variant font-medium">
                          {(t.unrecordedDays ?? t.unrecordedSessions) ? (
                            <span className="text-status-late font-bold">
                              {t.unrecordedDays ?? t.unrecordedSessions} séances non saisies
                            </span>
                          ) : (
                            "Toutes séances saisies"
                          )}
                        </span>
                        <Button
                          variant="secondary"
                          className="!min-h-9 !px-3 text-xs rounded-xl inline-flex items-center gap-1.5"
                          onClick={() => setSelectedTrainee(t)}
                          aria-label={`Détail pour ${t.fullName}`}
                        >
                          <BarChart3 className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                          <span>Fiche ASP / Détail</span>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Vue Tablette & Bureau (>= 768px) : Tableau consolidé complet */}
              <div
                tabIndex={0}
                role="region"
                aria-label={`Tableau du rapport mensuel de présence de ${report.formationTitle}, ${report.trainees.length} stagiaires`}
                className="hidden md:block overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Rapport mensuel d&apos;assiduité de {report.formationTitle} pour {formatMonth(report.month)}
                  </caption>
                  <thead className="border-b border-border-subtle bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface">
                    {viewMode === "general" ? (
                      <tr>
                        <th scope="col" className="p-3 sm:p-4">Stagiaire</th>
                        <th scope="col" className="p-3 sm:p-4 text-center">Assiduité</th>
                        <th scope="col" className="p-3 sm:p-4">Présence eff.</th>
                        <th scope="col" className="p-3 sm:p-4">Abs. injustifiées</th>
                        <th scope="col" className="p-3 sm:p-4">Abs. justifiées</th>
                        <th scope="col" className="p-3 sm:p-4">Retards</th>
                        <th scope="col" className="p-3 sm:p-4">Total absence</th>
                        <th scope="col" className="p-3 sm:p-4 text-center">Non saisies</th>
                        <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
                      </tr>
                    ) : (
                      <tr>
                        <th scope="col" className="p-3 sm:p-4">Stagiaire</th>
                        <th scope="col" className="p-3 sm:p-4">Heures nettes</th>
                        <th scope="col" className="p-3 sm:p-4">Présence certifiée</th>
                        <th scope="col" className="p-3 sm:p-4 text-status-absent">Déduction ASP</th>
                        <th scope="col" className="p-3 sm:p-4">Abs. justifiées</th>
                        <th scope="col" className="p-3 sm:p-4">Retards</th>
                        <th scope="col" className="p-3 sm:p-4">Dispensées centre</th>
                        <th scope="col" className="p-3 sm:p-4 text-center">Statut ASP</th>
                        <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {paginatedTrainees.map((t) => {
                      const percent = Math.round(t.attendanceRate * 100);
                      return viewMode === "general" ? (
                        <tr key={t.traineeId} className="align-middle hover:bg-surface-container-low transition-colors">
                          {/* Stagiaire */}
                          <th scope="row" className="p-3 sm:p-4 font-normal">
                            <span className="font-bold text-on-surface text-base block">{t.fullName}</span>
                            <span className="text-xs text-on-surface-variant font-mono">ID: {t.traineeId.slice(0, 8)}</span>
                          </th>

                          {/* Taux d'assiduité avec jauge */}
                          <td className="p-3 sm:p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  percent >= 90
                                    ? "bg-status-present-bg text-status-present"
                                    : percent >= 75
                                      ? "bg-status-late-bg text-status-late"
                                      : "bg-status-absent-bg text-status-absent"
                                }`}
                              >
                                {percent} %
                              </span>
                              <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    percent >= 90
                                      ? "bg-status-present"
                                      : percent >= 75
                                        ? "bg-status-late"
                                        : "bg-status-absent"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Présence effective */}
                          <td className="p-3 sm:p-4 font-mono font-bold text-status-present text-base">
                            {formatHours(t.effectivePresenceHours)}
                          </td>

                          {/* Absences injustifiées */}
                          <td className="p-3 sm:p-4 text-sm font-semibold text-status-absent">
                            {formatHours(t.absentHours)}
                          </td>

                          {/* Absences justifiées */}
                          <td className="p-3 sm:p-4 text-sm font-semibold text-status-excused">
                            {formatHours(t.excusedHours)}
                          </td>

                          {/* Retards */}
                          <td className="p-3 sm:p-4 text-sm text-status-late font-semibold">
                            {t.lateCount} ({t.lateMinutes} min)
                          </td>

                          {/* Total absences */}
                          <td className="p-3 sm:p-4 text-sm font-bold text-on-surface">
                            {formatHours(t.totalAbsenceHours)}
                          </td>

                          {/* Séances non saisies */}
                          <td className="p-3 sm:p-4 text-center">
                            {(t.unrecordedDays ?? t.unrecordedSessions) ? (
                              <span className="inline-flex rounded-full bg-status-late-bg px-2.5 py-0.5 text-xs font-bold text-status-late">
                                {t.unrecordedDays ?? t.unrecordedSessions}
                              </span>
                            ) : (
                              <span className="text-outline text-xs">—</span>
                            )}
                          </td>

                          {/* Bouton de détail */}
                          <td className="p-3 sm:p-4 text-right">
                            <Button
                              variant="secondary"
                              className="!min-h-9 !px-3 !py-1 text-xs rounded-xl inline-flex items-center gap-1"
                              onClick={() => setSelectedTrainee(t)}
                              aria-label={`Détail de présence et ventilation par matière pour ${t.fullName}`}
                            >
                              <BarChart3 className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                              <span className="hidden sm:inline">Détail</span>
                            </Button>
                          </td>
                        </tr>
                      ) : (
                        /* LIGNE SPÉCIFIQUE BORDEREAU ASP */
                        <tr key={t.traineeId} className="align-middle hover:bg-surface-container-low transition-colors">
                          {/* Stagiaire */}
                          <th scope="row" className="p-3 sm:p-4 font-normal">
                            <span className="font-bold text-on-surface text-base block">{t.fullName}</span>
                            <span className="text-xs text-on-surface-variant font-mono">ID: {t.traineeId.slice(0, 8)}</span>
                          </th>

                          {/* Heures nettes prévues */}
                          <td className="p-3 sm:p-4 font-mono font-semibold text-primary">
                            {formatHours(t.netTheoreticalHours)}
                          </td>

                          {/* Présence certifiée réalisée */}
                          <td className="p-3 sm:p-4 font-mono font-bold text-status-present">
                            {formatHours(t.effectivePresenceHours)}
                          </td>

                          {/* Déduction ASP */}
                          <td className="p-3 sm:p-4">
                            {t.aspDeductibleHours > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-status-absent-bg px-2.5 py-1 text-xs font-bold text-status-absent border border-status-absent/30">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatHours(t.aspDeductibleHours)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-status-present">0,00 h</span>
                            )}
                          </td>

                          {/* Absences justifiées */}
                          <td className="p-3 sm:p-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-sm font-semibold text-status-excused">
                                {formatHours(t.excusedHours)}
                              </span>
                              {Object.keys(t.excuseReasonsSummary ?? {}).length > 0 && (
                                <span className="text-[11px] text-on-surface-variant truncate max-w-[12rem]">
                                  {Object.keys(t.excuseReasonsSummary).join(", ")}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Retards */}
                          <td className="p-3 sm:p-4 text-xs font-semibold text-status-late">
                            {t.lateCount > 0 ? `${t.lateCount} (${t.lateMinutes}m)` : "0"}
                          </td>

                          {/* Dispensées centre */}
                          <td className="p-3 sm:p-4 text-xs font-mono text-on-surface-variant">
                            {formatHours(t.exemptedHours ?? 0)}
                          </td>

                          {/* Statut ASP */}
                          <td className="p-3 sm:p-4 text-center">
                            {t.unrecordedSessions > 0 ? (
                              <span className="inline-flex rounded-full bg-status-late-bg px-2.5 py-0.5 text-xs font-bold text-status-late">
                                {t.unrecordedSessions} non saisie(s)
                              </span>
                            ) : t.aspDeductibleHours > 0 ? (
                              <span className="inline-flex rounded-full bg-status-absent-bg px-2.5 py-0.5 text-xs font-bold text-status-absent border border-status-absent/30">
                                Retenue à déduire
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-status-present-bg px-2.5 py-0.5 text-xs font-bold text-status-present">
                                Conforme ASP
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 sm:p-4 text-right">
                            <Button
                              variant="secondary"
                              className="!min-h-9 !px-3 !py-1 text-xs rounded-xl inline-flex items-center gap-1"
                              onClick={() => setSelectedTrainee(t)}
                              aria-label={`Fiche ASP et émargements détaillés pour ${t.fullName}`}
                            >
                              <Landmark className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                              <span className="hidden sm:inline">Fiche ASP</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Contrôles de pagination accessibles pour le rapport */}
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={totalTrainees}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                pageSizeOptions={[10, 25, 50]}
                itemName="stagiaires"
                ariaLabel="Pagination des stagiaires du rapport"
              />
            </>
          )}

          {/* 6. MODALE ACCESSIBLE DU DÉTAIL / FICHE ASP PAR STAGIAIRE */}
          {selectedTrainee && (
            <Dialog.Root open={true} onOpenChange={(open) => !open && setSelectedTrainee(null)}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs" />
                <Dialog.Content
                  className="fixed left-1/2 top-1/2 z-[111] max-h-[92dvh] w-[min(96vw,52rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-4 sm:p-6 text-on-surface shadow-2xl focus:outline-none"
                  aria-describedby="trainee-detail-desc"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
                    <div>
                      <Dialog.Title className="text-2xl font-bold text-primary flex items-center gap-2">
                        <span>{selectedTrainee.fullName}</span>
                        {selectedTrainee.aspDeductibleHours > 0 ? (
                          <span className="inline-flex rounded-full bg-status-absent text-on-primary px-2.5 py-0.5 text-xs font-bold">
                            Retenue ASP : {formatHours(selectedTrainee.aspDeductibleHours)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-status-present-bg text-status-present px-2.5 py-0.5 text-xs font-bold">
                            Assiduité 100% conforme ASP
                          </span>
                        )}
                      </Dialog.Title>
                      <Dialog.Description id="trainee-detail-desc" className="text-sm text-on-surface-variant mt-1">
                        Fiche d&apos;Émargement Mensuelle &amp; Relevé ASP • {report.formationTitle} — {formatMonth(report.month)}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <Button variant="secondary" className="!min-h-9 !px-3 text-sm rounded-xl">
                        Fermer
                      </Button>
                    </Dialog.Close>
                  </div>

                  {/* 5 KPI Cartes */}
                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                    <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3">
                      <p className="text-[11px] uppercase font-bold text-on-surface-variant">Heures nettes</p>
                      <p className="text-lg font-bold text-primary mt-0.5">
                        {formatHours(selectedTrainee.netTheoreticalHours)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-status-present-border/40 bg-status-present-bg p-3">
                      <p className="text-[11px] uppercase font-bold text-status-present">Présence</p>
                      <p className="text-lg font-bold text-status-present mt-0.5">
                        {formatHours(selectedTrainee.effectivePresenceHours)}
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 border ${selectedTrainee.aspDeductibleHours > 0 ? "border-status-absent bg-status-absent-bg text-status-absent" : "border-border-subtle bg-surface-container-low"}`}>
                      <p className="text-[11px] uppercase font-bold">Déduction ASP</p>
                      <p className="text-lg font-bold mt-0.5">
                        {formatHours(selectedTrainee.aspDeductibleHours)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-status-excused-border/40 bg-status-excused-bg p-3">
                      <p className="text-[11px] uppercase font-bold text-status-excused">Justifiées</p>
                      <p className="text-lg font-bold text-status-excused mt-0.5">
                        {formatHours(selectedTrainee.excusedHours)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-surface-container-low p-3 col-span-2 sm:col-span-1">
                      <p className="text-[11px] uppercase font-bold text-secondary">Dispensées</p>
                      <p className="text-lg font-bold text-secondary mt-0.5">
                        {formatHours(selectedTrainee.exemptedHours ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Onglets de la modale */}
                  <div className="mt-6 flex items-center justify-between border-b border-border-subtle pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalTab("chronology")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          modalTab === "chronology"
                            ? "bg-primary-container text-on-primary"
                            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        📅 Journal chronologique ({selectedTrainee.sessionsList?.length ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalTab("subjects")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          modalTab === "subjects"
                            ? "bg-primary-container text-on-primary"
                            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        📚 Ventilation par matière ({selectedTrainee.bySubject?.length ?? 0})
                      </button>
                    </div>

                    {modalTab === "chronology" && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setSessionFilter("all")}
                          className={`px-2 py-1 rounded-md font-semibold ${sessionFilter === "all" ? "bg-surface-container-high text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Toutes
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionFilter("absences_lates")}
                          className={`px-2 py-1 rounded-md font-semibold ${sessionFilter === "absences_lates" ? "bg-status-absent-bg text-status-absent font-bold" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Absences/Retards
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionFilter("cancelled")}
                          className={`px-2 py-1 rounded-md font-semibold ${sessionFilter === "cancelled" ? "bg-surface-container-high text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Dispensées
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CONTENU ONGLET 1 : Journal Chronologique */}
                  {modalTab === "chronology" && (
                    <div className="mt-4 flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                      {(() => {
                        const list = (selectedTrainee.sessionsList ?? []).filter((s) => {
                          if (sessionFilter === "absences_lates") return s.status === "absent" || s.status === "late" || s.status === "excused";
                          if (sessionFilter === "cancelled") return s.isCancelled;
                          return true;
                        });

                        if (list.length === 0) {
                          return (
                            <p className="text-center text-xs text-on-surface-variant py-8">
                              Aucune séance ne correspond aux filtres sélectionnés.
                            </p>
                          );
                        }

                        return list.map((s, idx) => (
                          <div
                            key={`${s.date}_${s.slotId}_${idx}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-container-low p-3 hover:bg-surface-container transition-colors text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-primary w-24">
                                {formatShortDate(s.date)}
                              </span>
                              <span className="font-semibold text-on-surface-variant">
                                {s.startTime} - {s.endTime}
                              </span>
                              <span className="font-bold text-on-surface">
                                {s.subjectTitle}
                              </span>
                              {s.isSelfStudyTP && (
                                <span className="rounded-md bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                                  TP libre encadré
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {s.status === "present" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-status-present-bg px-2.5 py-0.5 font-bold text-status-present">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Présent ({formatHours(s.durationMinutes / 60)})
                                </span>
                              )}
                              {s.status === "absent" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-status-absent-bg px-2.5 py-0.5 font-bold text-status-absent border border-status-absent/40">
                                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Absent ({formatHours(s.durationMinutes / 60)}) — Déduction ASP
                                </span>
                              )}
                              {s.status === "late" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-status-late-bg px-2.5 py-0.5 font-bold text-status-late">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  Retard {s.lateMinutes} min (Arrivée {s.arrivalTime})
                                </span>
                              )}
                              {s.status === "excused" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-status-excused-bg px-2.5 py-0.5 font-bold text-status-excused">
                                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                  Justifié : {s.excuseReason} ({formatHours(s.durationMinutes / 60)})
                                </span>
                              )}
                              {s.status === "cancelled" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 font-bold text-on-surface-variant">
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  Dispensé centre ({s.cancellationReason ?? "Absence formateur"}) — Sans pénalité
                                </span>
                              )}
                              {s.status === "unrecorded" && (
                                <span className="inline-flex rounded-full bg-surface-container px-2.5 py-0.5 font-medium text-outline">
                                  Séance non saisie
                                </span>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* CONTENU ONGLET 2 : Ventilation par matière */}
                  {modalTab === "subjects" && selectedTrainee.bySubject && selectedTrainee.bySubject.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="overflow-x-auto rounded-xl border border-border-subtle">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead className="bg-surface-container text-xs font-bold uppercase text-on-surface">
                            <tr>
                              <th scope="col" className="p-3">Matière</th>
                              <th scope="col" className="p-3">Théorique</th>
                              <th scope="col" className="p-3">Présence estimée</th>
                              <th scope="col" className="p-3">Absences</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-container">
                            {selectedTrainee.bySubject.map((sub) => (
                              <tr key={sub.subjectId} className="hover:bg-surface-container-low">
                                <th scope="row" className="p-3 font-semibold text-on-surface">
                                  {sub.title}
                                </th>
                                <td className="p-3 text-primary font-semibold">{formatHours(sub.theoreticalHours)}</td>
                                <td className="p-3 text-status-present font-semibold">{formatHours(Math.max(0, sub.theoreticalHours - sub.absenceHours))}</td>
                                <td className="p-3 text-status-absent font-semibold">{formatHours(sub.absenceHours)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </section>
      )}
    </div>
  );
}
