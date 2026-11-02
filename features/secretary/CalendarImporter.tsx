"use client";

import { useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { eachDay, formatLongDate, isWeekend } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { addHolidays } from "@/lib/data/holidays";
import { createNotification } from "@/lib/data/notifications";
import {
  parseCalendarFile,
  type CalendarParseResult,
  type ParsedCalendarHoliday,
} from "@/lib/domain/calendarParser";
import {
  downloadCalendarCsvTemplate,
  downloadCalendarExcelTemplate,
} from "@/lib/domain/templates";
import { HOLIDAY_TYPE_LABELS, type Holiday } from "@/lib/domain/types";

const weekdaysCount = (h: { startDate: string; endDate: string }) =>
  eachDay(h.startDate, h.endDate).filter((d: string) => !isWeekend(d)).length;

export function CalendarImporter({
  actor,
  existingHolidays,
  onImported,
}: {
  actor: Actor;
  existingHolidays: Holiday[];
  onImported: () => Promise<void>;
}) {
  const announce = useAnnounce();
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [result, setResult] = useState<CalendarParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await downloadCalendarExcelTemplate();
      announce("Le modèle Excel du calendrier a été téléchargé avec succès.");
    } catch {
      announce("Erreur lors du téléchargement du modèle Excel.", "assertive");
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleDownloadCsv = () => {
    downloadCalendarCsvTemplate();
    announce("Le modèle CSV du calendrier a été téléchargé avec succès.");
  };

  const processFile = async (file: File) => {
    setError(null);
    setDone(null);
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const parsed = await parseCalendarFile(file);
      setResult(parsed);
      if (parsed.errors.length > 0) {
        announce(
          `Fichier analysé : ${parsed.holidays.length} fermetures valides, ${parsed.errors.length} erreurs détectées.`,
          "assertive"
        );
      } else {
        announce(
          `Fichier analysé : ${parsed.holidays.length} fermetures prêtes à être importées.`
        );
      }
      setTimeout(() => previewHeading.current?.focus(), 100);
    } catch (err) {
      console.warn("Calendar parse error:", err);
      setError("Impossible de lire ce fichier. Assurez-vous qu'il s'agit d'un fichier .xlsx ou .csv valide.");
      setResult(null);
      announce("Échec de la lecture du fichier.", "assertive");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const reset = () => {
    setResult(null);
    setFileName("");
    setFileSize(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const commitImport = async () => {
    if (!result || result.holidays.length === 0) return;
    setBusy(true);
    setError(null);

    try {
      const toAdd = result.holidays.map((h) => ({
        title: h.title,
        type: h.type,
        startDate: h.startDate,
        endDate: h.endDate,
      }));

      await addHolidays(actor, toAdd);

      // Create institutional notification for all staff
      await createNotification(
        {
          title: "Calendrier mis à jour",
          message: `${toAdd.length} période(s) de fermeture importée(s) par ${actor.fullName}.`,
          type: "info",
        },
        actor
      );

      await onImported();
      const count = toAdd.length;
      const msg = `${count} période${count > 1 ? "s" : ""} de fermeture importée${count > 1 ? "s" : ""} avec succès dans le calendrier.`;
      setDone(msg);
      announce(msg);
      reset();
    } catch (err) {
      console.warn("Commit calendar import error:", err);
      setError("Une erreur est survenue lors de l'enregistrement en base de données.");
      announce("Échec de l'import en base de données.", "assertive");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="calendar-importer-heading"
      className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-primary font-bold shadow-xs">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <h2 id="calendar-importer-heading" className="text-lg sm:text-xl font-bold text-primary">
              Import de fermetures en lot (Excel / CSV)
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Importez rapidement les vacances, ponts et fermetures de l&apos;établissement depuis un tableur.
            </p>
          </div>
        </div>

        {/* Download Template Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="!min-h-10 !px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5"
            title="Télécharger le modèle officiel au format Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <span>{downloadingExcel ? "Génération…" : "Modèle Excel (.xlsx)"}</span>
          </Button>

          <Button
            variant="secondary"
            onClick={handleDownloadCsv}
            className="!min-h-10 !px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5"
            title="Télécharger le modèle au format CSV (compatible tous tableurs)"
          >
            <FileText className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <span>Modèle CSV</span>
          </Button>
        </div>
      </div>

      {done && <Alert tone="success">{done}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Guide des colonnes */}
      <div className="rounded-xl border border-border-subtle bg-surface-container-low p-4 text-xs sm:text-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 font-bold text-primary">
          <HelpCircle className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
          <span>Format des colonnes du fichier :</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-lg bg-surface-container-lowest p-2.5 border border-border-subtle">
            <strong className="text-primary block">1. Intitulé *</strong>
            <span className="text-xs text-on-surface-variant">Nom de la fermeture (ex : Vacances d&apos;Hiver).</span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest p-2.5 border border-border-subtle">
            <strong className="text-primary block">2. Type</strong>
            <span className="text-xs text-on-surface-variant">« Vacances / fermeture » ou « Jour férié » (liste déroulante).</span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest p-2.5 border border-border-subtle">
            <strong className="text-primary block">3. Premier jour *</strong>
            <span className="text-xs text-on-surface-variant">Format date : <code>AAAA-MM-JJ</code> ou <code>JJ/MM/AAAA</code>.</span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest p-2.5 border border-border-subtle">
            <strong className="text-primary block">4. Dernier jour</strong>
            <span className="text-xs text-on-surface-variant">Optionnel : laisser vide pour 1 seule journée.</span>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInput.current?.click()}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary-container/10 ring-4 ring-primary/20"
              : "border-border-strong bg-surface-container-low/50 hover:bg-surface-container-low"
          } ${focusRing}`}
          tabIndex={0}
          role="button"
          aria-label="Zone de dépôt de fichier. Cliquez pour choisir un fichier Excel ou CSV, ou glissez-déposez ici."
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={handleFileChange}
            aria-hidden="true"
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-primary mb-3 shadow-xs">
            <UploadCloud className="h-7 w-7" aria-hidden="true" />
          </div>
          <span className="text-base font-bold text-primary">
            Glissez-déposez votre fichier ici, ou parcourez
          </span>
          <span className="mt-1 text-xs text-on-surface-variant">
            Formats acceptés : Microsoft Excel (.xlsx) et CSV (.csv). Taille max : 5 Mo.
          </span>
        </div>
      )}

      {/* Preview & Validation */}
      {result && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-container-high p-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-primary truncate">{fileName}</span>
                {fileSize && (
                  <span className="text-xs text-on-surface-variant font-mono">
                    {Math.round(fileSize / 1024)} Ko
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={reset}
              className="!min-h-9 !px-3 text-xs font-bold"
              aria-label="Changer de fichier"
            >
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              Changer de fichier
            </Button>
          </div>

          {/* Validation Issues / Errors */}
          {result.errors.length > 0 && (
            <div className="rounded-xl border-2 border-status-absent-border bg-status-absent-bg/40 p-4">
              <div className="flex items-center gap-2 text-status-absent font-bold text-sm mb-2">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{result.errors.length} anomalie(s) détectée(s) dans le fichier :</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs font-semibold text-status-absent">
                {result.errors.map((err, idx) => (
                  <li key={idx}>
                    Ligne {err.line} : {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid Holidays Table Preview */}
          {result.holidays.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3
                ref={previewHeading}
                tabIndex={-1}
                className="text-base font-bold text-primary outline-none flex items-center justify-between"
              >
                <span>Fermetures prêtes à être importées ({result.holidays.length})</span>
                <span className="text-xs font-semibold text-secondary">
                  Total jours ouvrés exclus : {result.holidays.reduce((acc, h) => acc + weekdaysCount(h), 0)} j
                </span>
              </h3>

              <div
                tabIndex={0}
                role="region"
                aria-label={`Tableau de prévisualisation des ${result.holidays.length} fermetures à importer`}
                className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest max-h-80 overflow-y-auto shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
              >
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 border-b border-border-subtle bg-surface-container font-bold text-on-surface">
                    <tr>
                      <th scope="col" className="p-2.5 sm:p-3">Ligne</th>
                      <th scope="col" className="p-2.5 sm:p-3">Intitulé</th>
                      <th scope="col" className="p-2.5 sm:p-3">Type</th>
                      <th scope="col" className="p-2.5 sm:p-3">Période</th>
                      <th scope="col" className="p-2.5 sm:p-3 text-right">Jours ouvrés</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {result.holidays.map((h) => (
                      <tr key={`${h.line}-${h.startDate}`} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-2.5 sm:p-3 font-mono text-outline">{h.line}</td>
                        <td className="p-2.5 sm:p-3 font-bold text-primary">{h.title}</td>
                        <td className="p-2.5 sm:p-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                              h.type === "holiday"
                                ? "bg-status-late-bg text-status-late"
                                : "bg-surface-container-high text-primary"
                            }`}
                          >
                            {HOLIDAY_TYPE_LABELS[h.type]}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3 font-medium text-on-surface-variant">
                          {h.startDate === h.endDate
                            ? formatLongDate(h.startDate)
                            : `du ${formatLongDate(h.startDate)} au ${formatLongDate(h.endDate)}`}
                        </td>
                        <td className="p-2.5 sm:p-3 text-right font-bold text-primary">
                          {weekdaysCount(h)} j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
                <Button variant="secondary" onClick={reset} disabled={busy} className="w-full sm:w-auto text-sm">
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={commitImport}
                  disabled={busy}
                  className="w-full sm:w-auto text-sm font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {busy
                      ? "Enregistrement en cours…"
                      : `Confirmer l'import de ${result.holidays.length} fermeture(s)`}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
