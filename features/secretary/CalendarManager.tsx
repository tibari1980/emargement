"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, CalendarDays, PlusCircle, UploadCloud } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { eachDay, formatLongDate, isValidIsoDate, isWeekend } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { addHolidays, deleteHoliday, listHolidays } from "@/lib/data/holidays";
import { frenchPublicHolidays } from "@/lib/domain/frenchHolidays";
import { HOLIDAY_TYPE_LABELS, type Holiday, type HolidayType } from "@/lib/domain/types";
import { CalendarImporter } from "./CalendarImporter";

const weekdaysCount = (h: Holiday) => eachDay(h.startDate, h.endDate).filter((d: string) => !isWeekend(d)).length;

export function CalendarManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState<"manual" | "import">("manual");
  const listHeading = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async () => setHolidays(await listHolidays()), []);

  useEffect(() => {
    listHolidays()
      .then((h) => {
        setHolidays(h);
        setError(null);
      })
      .catch((err) => {
        console.warn("CalendarManager: listHolidays failed", err);
        setHolidays([]);
      });
  }, []);

  if (!holidays) return error ? <Alert tone="error">{error}</Alert> : <Loading label="Chargement du calendrier..." />;

  const addPublicHolidays = async () => {
    const missing = frenchPublicHolidays(Number(year)).filter(
      (p) => !holidays.some((h) => h.type === "holiday" && h.startDate === p.date),
    );
    if (!missing.length) {
      announce(`Les jours fériés ${year} sont déjà tous enregistrés.`);
      return;
    }
    try {
      await addHolidays(
        actor,
        missing.map((p) => ({ title: p.title, startDate: p.date, endDate: p.date, type: "holiday" })),
      );
      await reload();
      announce(`${missing.length} jours fériés ${year} ajoutés.`);
    } catch {
      announce("Échec de l'ajout des jours fériés.", "assertive");
    }
  };

  const thisYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-8">
      {/* Mode Switcher: Saisie manuelle vs Import en lot */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          aria-pressed={activeTab === "manual"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${focusRing} ${
            activeTab === "manual"
              ? "bg-primary-container text-on-primary shadow-xs"
              : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-border-subtle"
          }`}
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Saisie manuelle</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("import")}
          aria-pressed={activeTab === "import"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${focusRing} ${
            activeTab === "import"
              ? "bg-primary-container text-on-primary shadow-xs"
              : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-border-subtle"
          }`}
        >
          <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Import en lot (Excel / CSV)</span>
        </button>
      </div>

      {activeTab === "manual" ? (
        <HolidayForm
          actor={actor}
          onAdded={async (title) => {
            await reload();
            announce(`${title} ajouté au calendrier.`);
          }}
        />
      ) : (
        <CalendarImporter
          actor={actor}
          existingHolidays={holidays}
          onImported={reload}
        />
      )}

      <section aria-labelledby="public-heading" className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
        <h2 id="public-heading" className="text-xl font-bold text-primary flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Jours fériés nationaux</span>
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <SelectField label="Année" value={year} onChange={(e) => setYear(e.target.value)} className="!min-h-10 text-sm">
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectField>
          </div>
          <Button variant="secondary" onClick={addPublicHolidays} className="!min-h-10 !px-4 text-sm">
            Ajouter les 11 jours fériés de {year}
          </Button>
        </div>
      </section>

      <section aria-labelledby="list-heading" className="flex flex-col gap-4">
        <h2 id="list-heading" ref={listHeading} tabIndex={-1} className="text-xl font-bold text-primary outline-none">
          Jours de fermeture enregistrés ({holidays.length})
        </h2>
        {holidays.length === 0 ? (
          <Alert tone="info">Aucun jour de fermeture enregistré.</Alert>
        ) : (
          <>
            {/* Vue Cartes sur Smartphone (< 768px) */}
            <div className="grid gap-3 md:hidden">
              {holidays.map((h) => (
                <article
                  key={h.id}
                  className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-on-surface text-base leading-snug">{h.title}</h3>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        h.type === "holiday"
                          ? "bg-status-late-bg text-status-late"
                          : "bg-surface-container-high text-primary"
                      }`}
                    >
                      {HOLIDAY_TYPE_LABELS[h.type]}
                    </span>
                  </div>

                  <div className="rounded-lg bg-surface-container-low p-2.5 text-xs flex flex-col gap-1">
                    <div>
                      <span className="font-semibold text-on-surface-variant">Période : </span>
                      <span className="font-bold text-on-surface">
                        {h.startDate === h.endDate
                          ? formatLongDate(h.startDate)
                          : `du ${formatLongDate(h.startDate)} au ${formatLongDate(h.endDate)}`}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-on-surface-variant">Jours ouvrés exclus : </span>
                      <span className="font-bold text-primary">{weekdaysCount(h)} j</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <ConfirmDialog
                      triggerLabel="Supprimer"
                      triggerAccessibleLabel={`Supprimer ${h.title}`}
                      title="Supprimer ce jour de fermeture ?"
                      description={`« ${h.title} » ne sera plus exclu des heures théoriques.`}
                      confirmLabel="Supprimer"
                      onConfirm={async () => {
                        try {
                          await deleteHoliday(actor, h);
                          await reload();
                          announce(`${h.title} supprimé du calendrier.`);
                          setTimeout(() => listHeading.current?.focus(), 0);
                        } catch {
                          announce("Échec de la suppression.", "assertive");
                        }
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>

            {/* Vue Tableau sur Tablette & Ordinateur (>= 768px) */}
            <div
              tabIndex={0}
              role="region"
              aria-label={`Tableau des ${holidays.length} jours de fermeture enregistrés`}
              className="hidden md:block overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
            >
            <table className="w-full border-collapse text-left text-sm min-w-[500px]">
              <caption className="sr-only">Jours fériés et périodes de fermeture, par date</caption>
              <thead className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
                <tr>
                  <th scope="col" className="p-3 sm:p-4">Intitulé</th>
                  <th scope="col" className="p-3 sm:p-4">Type</th>
                  <th scope="col" className="p-3 sm:p-4">Période</th>
                  <th scope="col" className="p-3 sm:p-4">Jours ouvrés exclus</th>
                  <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-container-low transition-colors">
                    <th scope="row" className="p-3 sm:p-4 font-bold text-on-surface">{h.title}</th>
                    <td className="p-3 sm:p-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        h.type === "holiday" ? "bg-status-late-bg text-status-late" : "bg-surface-container-high text-primary"
                      }`}>
                        {HOLIDAY_TYPE_LABELS[h.type]}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-on-surface-variant font-medium">
                      {h.startDate === h.endDate
                        ? formatLongDate(h.startDate)
                        : `du ${formatLongDate(h.startDate)} au ${formatLongDate(h.endDate)}`}
                    </td>
                    <td className="p-3 sm:p-4 font-bold text-primary">{weekdaysCount(h)} j</td>
                    <td className="p-3 sm:p-4 text-right">
                      <ConfirmDialog
                        triggerLabel="Supprimer"
                        triggerAccessibleLabel={`Supprimer ${h.title}`}
                        title="Supprimer ce jour de fermeture ?"
                        description={`« ${h.title} » ne sera plus exclu des heures théoriques.`}
                        confirmLabel="Supprimer"
                        onConfirm={async () => {
                          try {
                            await deleteHoliday(actor, h);
                            await reload();
                            announce(`${h.title} supprimé du calendrier.`);
                            setTimeout(() => listHeading.current?.focus(), 0);
                          } catch {
                            announce("Échec de la suppression.", "assertive");
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}

function HolidayForm({ actor, onAdded }: { actor: Actor; onAdded: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<HolidayType>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const end = endDate || startDate;
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "L'intitulé est obligatoire.";
    if (!isValidIsoDate(startDate)) e.startDate = "Date de début invalide.";
    if (endDate && !isValidIsoDate(endDate)) e.endDate = "Date de fin invalide.";
    else if (isValidIsoDate(startDate) && end < startDate) e.endDate = "La fin doit être après le début.";
    setErrors(e);
    if (Object.keys(e).length) {
      setSaveError("Le formulaire contient des erreurs. Corrigez les champs signalés.");
      return;
    }
    setSaveError(null);
    setBusy(true);
    try {
      await addHolidays(actor, [{ title: title.trim(), type, startDate, endDate: end }]);
      await onAdded(title.trim());
      setTitle("");
      setStartDate("");
      setEndDate("");
    } catch {
      setSaveError("L'enregistrement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="add-holiday-heading" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
      <h2 id="add-holiday-heading" className="mb-4 text-xl font-bold text-primary flex items-center gap-2">
        <PlusCircle className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
        <span>Ajouter une fermeture</span>
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {saveError && <Alert tone="error">{saveError}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Intitulé"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            hint="Exemple : Vacances de Noël, Pont de l'Ascension."
            required
          />
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as HolidayType)}>
            <option value="vacation">{HOLIDAY_TYPE_LABELS.vacation}</option>
            <option value="holiday">{HOLIDAY_TYPE_LABELS.holiday}</option>
          </SelectField>
          <TextField label="Premier jour" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={errors.startDate} required />
          <TextField
            label="Dernier jour"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            error={errors.endDate}
            hint="Laisser vide pour une seule journée."
          />
        </div>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Ajouter au calendrier"}
          </Button>
        </div>
      </form>
    </section>
  );
}
