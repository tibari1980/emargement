"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { focusRing } from "@/components/ui/Button";
import { authFetch, downloadBlob, fileNameFromResponse } from "@/lib/core/apiClient";
import { todayIso } from "@/lib/core/dates";
import { slotMinutes } from "@/lib/domain/schedule";
import { WEEKDAYS, type TimetableSlot } from "@/lib/domain/types";
import {
  timetableExportFileName,
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
}: {
  mode: "formation" | "trainer";
  targetId: string;
  targetTitle: string;
  slots: TimetableSlot[];
  subjectTitle: (id: string) => string;
  formationTitle: (id: string) => string;
  trainerName: (id: string) => string;
}) {
  const announce = useAnnounce();
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const buildPayload = (): TimetableExportPayload => {
    // If a formation has no custom slots configured, export its standard regulatory 09:00-17:00 schedule (35h/week)
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

    return {
      mode,
      targetId,
      targetTitle,
      isStandardFallback,
      slots: exportSlots,
    };
  };

  const handleExport = async (format: "pdf" | "excel") => {
    if (!targetId || exporting) return;
    setExporting(format);
    try {
      const payload = buildPayload();
      const endpoint = format === "pdf" ? "/api/export-timetable-pdf" : "/api/export-timetable-excel";
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const response = await authFetch(endpoint, { payload });
      const fallbackName = timetableExportFileName(payload, ext);
      downloadBlob(await response.blob(), fileNameFromResponse(response, fallbackName));
      announce(
        `Emploi du temps de « ${targetTitle} » téléchargé au format ${format === "pdf" ? "PDF" : "Excel"}.`,
      );
    } catch {
      announce(
        `Le téléchargement de l'emploi du temps au format ${format === "pdf" ? "PDF" : "Excel"} a échoué.`,
        "assertive",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={`Télécharger l'emploi du temps de ${targetTitle}`}
      className="flex flex-wrap items-center gap-2"
    >
      <button
        type="button"
        onClick={() => handleExport("pdf")}
        disabled={exporting !== null}
        aria-label={`Télécharger l'emploi du temps de ${targetTitle} au format PDF`}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
      >
        <FileText className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
        <span>{exporting === "pdf" ? "Génération PDF…" : "Télécharger PDF"}</span>
        <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => handleExport("excel")}
        disabled={exporting !== null}
        aria-label={`Télécharger l'emploi du temps de ${targetTitle} au format Excel (.xlsx)`}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
      >
        <FileSpreadsheet className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
        <span>{exporting === "excel" ? "Génération Excel…" : "Télécharger Excel"}</span>
        <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
