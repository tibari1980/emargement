"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { focusRing } from "@/components/ui/Button";
import { authFetch, downloadBlob, fileNameFromResponse } from "@/lib/core/apiClient";
import { formatMonth, todayIso } from "@/lib/core/dates";
import { slotMinutes } from "@/lib/domain/schedule";
import { WEEKDAYS, type Holiday, type TimetableSlot } from "@/lib/domain/types";
import {
  timetableExportFileName,
  type TimetableExportHoliday,
  type TimetableExportPayload,
  type TimetableExportSlot,
} from "@/lib/exports/timetableExport";

export function TimetableExportButtons({
  mode,
  targetId,
  targetTitle,
  slots,
  subjectTitle,
  formationTitle,
  trainerName,
  holidays = [],
  selectedMonth,
}: {
  mode: "formation" | "trainer";
  targetId: string;
  targetTitle: string;
  slots: TimetableSlot[];
  subjectTitle: (id: string) => string;
  formationTitle: (id: string) => string;
  trainerName: (id: string) => string;
  holidays?: Holiday[];
  selectedMonth?: string;
}) {
  const announce = useAnnounce();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [month, setMonth] = useState<string>(() => selectedMonth || todayIso().slice(0, 7));
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  // Synchronise le mois présélectionné lorsque l'utilisateur navigue d'une semaine à l'autre
  useEffect(() => {
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      setMonth(selectedMonth);
    }
  }, [selectedMonth]);

  // Liste des mois de l'année scolaire en cours (Septembre à Août)
  const availableMonths = useMemo(() => {
    const current = todayIso().slice(0, 7);
    const [currY, currM] = current.split("-").map(Number);
    const startYear = currM >= 9 ? currY : currY - 1;
    const list: { value: string; label: string }[] = [];
    for (let offset = 0; offset < 12; offset++) {
      const d = new Date(startYear, 8 + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const val = `${y}-${m}`;
      list.push({
        value: val,
        label: formatMonth(val),
      });
    }
    return list;
  }, []);

  const buildPayload = (exportPeriod: "week" | "month"): TimetableExportPayload => {
    const isStandardFallback = mode === "formation" && slots.length === 0;

    const exportSlots: TimetableExportSlot[] = isStandardFallback
      ? WEEKDAYS.map((weekday) => ({
          id: `default_${weekday}_${targetId}`,
          weekday,
          startTime: "09:00",
          endTime: "17:00",
          durationMinutes: 420,
          subjectTitle: "Enseignement général & Travaux pratiques",
          formationTitle: targetTitle,
          trainerName: "Équipe pédagogique ESRP / CFRP",
          room: "Plateau Pédagogique",
          validFrom: "1970-01-01",
          validTo: null,
        }))
      : slots.map((s) => ({
          id: s.id,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: slotMinutes(s),
          subjectTitle: subjectTitle(s.subjectId),
          formationTitle: formationTitle(s.formationId),
          trainerName: trainerName(s.trainerId),
          room: s.room || "Plateau Pédagogique",
          validFrom: s.validFrom || todayIso(),
          validTo: s.validTo ?? null,
        }));

    const exportHolidays: TimetableExportHoliday[] = holidays.map((h) => ({
      startDate: h.startDate,
      endDate: h.endDate,
      title: h.title,
      type: h.type,
    }));

    return {
      mode,
      targetId,
      targetTitle,
      isStandardFallback,
      slots: exportSlots,
      period: exportPeriod,
      month: exportPeriod === "month" ? month : undefined,
      holidays: exportHolidays,
    };
  };

  const handleExport = async (format: "pdf" | "excel") => {
    if (!targetId || exporting) return;
    setExporting(format);
    try {
      const payload = buildPayload(period);
      const endpoint = format === "pdf" ? "/api/export-timetable-pdf" : "/api/export-timetable-excel";
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const response = await authFetch(endpoint, { payload });
      const fallbackName = timetableExportFileName(payload, ext);
      downloadBlob(await response.blob(), fileNameFromResponse(response, fallbackName));

      const periodLabel = period === "month" ? `du mois de ${formatMonth(month)}` : "de la semaine";
      announce(
        `Planning ${periodLabel} de « ${targetTitle} » téléchargé au format ${format === "pdf" ? "PDF" : "Excel"}.`,
      );
    } catch {
      announce(
        `Le téléchargement du planning au format ${format === "pdf" ? "PDF" : "Excel"} a échoué.`,
        "assertive",
      );
    } finally {
      setExporting(null);
    }
  };

  const periodReadable = period === "month" ? `du mois de ${formatMonth(month)}` : "de la semaine";

  return (
    <div
      role="group"
      aria-label={`Options de téléchargement du planning de ${targetTitle}`}
      className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full sm:w-auto"
    >
      {/* 1. Sélecteur de période : Semaine ou Mois complet */}
      <div
        className="inline-flex self-start sm:self-auto rounded-xl bg-surface-container p-1 border border-border-subtle shadow-2xs"
        role="radiogroup"
        aria-label="Période du planning à exporter"
      >
        <button
          type="button"
          role="radio"
          aria-checked={period === "week"}
          onClick={() => setPeriod("week")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            period === "week"
              ? "bg-surface-container-lowest text-primary shadow-xs ring-1 ring-border-subtle"
              : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Semaine
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={period === "month"}
          onClick={() => setPeriod("month")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            period === "month"
              ? "bg-surface-container-lowest text-primary shadow-xs ring-1 ring-border-subtle"
              : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Mois complet
        </button>
      </div>

      {/* 2. Si mode Mois : Sélecteur déroulant du mois */}
      {period === "month" && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="export-month-select" className="sr-only">
            Mois du planning
          </label>
          <div className="relative">
            <select
              id="export-month-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Mois du planning à télécharger"
              className={`min-h-10 rounded-xl border border-secondary/40 bg-surface-container-lowest px-3 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs cursor-pointer ${focusRing}`}
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 3. Boutons d'exportation PDF & Excel */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          aria-label={`Télécharger le planning ${periodReadable} de ${targetTitle} au format PDF`}
          className={`inline-flex w-full sm:w-auto justify-center min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
        >
          <FileText className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
          <span>
            {exporting === "pdf"
              ? "Génération PDF…"
              : period === "month"
              ? "Mois PDF"
              : "Télécharger PDF"}
          </span>
          <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => handleExport("excel")}
          disabled={exporting !== null}
          aria-label={`Télécharger le planning ${periodReadable} de ${targetTitle} au format Excel (.xlsx)`}
          className={`inline-flex w-full sm:w-auto justify-center min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
        >
          <FileSpreadsheet className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
          <span>
            {exporting === "excel"
              ? "Génération Excel…"
              : period === "month"
              ? "Mois Excel"
              : "Télécharger Excel"}
          </span>
          <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
