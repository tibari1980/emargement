"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { eachDay, formatLongDate, isValidIsoDate, isWeekend } from "@/lib/dates";
import { addHolidays, deleteHoliday, listHolidays } from "@/lib/firestore";
import { frenchPublicHolidays } from "@/lib/frenchHolidays";
import { rolesFor } from "@/lib/navigation";
import { HOLIDAY_TYPE_LABELS, type Holiday, type HolidayType } from "@/lib/types";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendrier de l'établissement"
        description="Jours fériés et périodes de fermeture : ces jours sont exclus des heures théoriques de toutes les formations."
      />
      <RoleGuard roles={rolesFor("/admin/calendar")}>{() => <HolidayManager />}</RoleGuard>
    </>
  );
}

const weekdaysCount = (h: Holiday) => eachDay(h.startDate, h.endDate).filter((d) => !isWeekend(d)).length;

function HolidayManager() {
  const announce = useAnnounce();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const listHeading = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async () => setHolidays(await listHolidays()), []);

  useEffect(() => {
    listHolidays()
      .then(setHolidays)
      .catch(() => setError("Impossible de charger le calendrier."));
  }, []);

  if (!holidays) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  const addPublicHolidays = async () => {
    const missing = frenchPublicHolidays(Number(year)).filter(
      (p) => !holidays.some((h) => h.type === "holiday" && h.startDate === p.date),
    );
    if (!missing.length) {
      announce(`Les jours fériés ${year} sont déjà tous enregistrés.`);
      return;
    }
    try {
      await addHolidays(missing.map((p) => ({ title: p.title, startDate: p.date, endDate: p.date, type: "holiday" })));
      await reload();
      announce(`${missing.length} jours fériés ${year} ajoutés.`);
    } catch {
      announce("Échec de l'ajout des jours fériés.", "assertive");
    }
  };

  const thisYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-8">
      <HolidayForm
        onAdded={async (title) => {
          await reload();
          announce(`${title} ajouté au calendrier.`);
        }}
      />

      <section aria-labelledby="public-heading" className="flex flex-col gap-4 rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="public-heading" className="text-xl font-bold">
          Jours fériés nationaux
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <SelectField label="Année" value={year} onChange={(e) => setYear(e.target.value)}>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectField>
          </div>
          <Button variant="secondary" onClick={addPublicHolidays}>
            Ajouter les 11 jours fériés de {year}
          </Button>
        </div>
      </section>

      <section aria-labelledby="list-heading" className="flex flex-col gap-4">
        <h2 id="list-heading" ref={listHeading} tabIndex={-1} className="text-xl font-bold outline-none">
          Jours de fermeture enregistrés ({holidays.length})
        </h2>
        {holidays.length === 0 ? (
          <Alert tone="info">Aucun jour de fermeture enregistré.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Jours fériés et périodes de fermeture, par date</caption>
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="p-3">Intitulé</th>
                  <th scope="col" className="p-3">Type</th>
                  <th scope="col" className="p-3">Période</th>
                  <th scope="col" className="p-3">Jours ouvrés exclus</th>
                  <th scope="col" className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-t-2 border-gray-200">
                    <th scope="row" className="p-3 font-semibold">{h.title}</th>
                    <td className="p-3">{HOLIDAY_TYPE_LABELS[h.type]}</td>
                    <td className="p-3">
                      {h.startDate === h.endDate
                        ? formatLongDate(h.startDate)
                        : `du ${formatLongDate(h.startDate)} au ${formatLongDate(h.endDate)}`}
                    </td>
                    <td className="p-3">{weekdaysCount(h)}</td>
                    <td className="p-3">
                      <ConfirmDialog
                        triggerLabel="Supprimer"
                        triggerAccessibleLabel={`Supprimer ${h.title}`}
                        title="Supprimer ce jour de fermeture ?"
                        description={`« ${h.title} » ne sera plus exclu des heures théoriques.`}
                        confirmLabel="Supprimer"
                        onConfirm={async () => {
                          try {
                            await deleteHoliday(h.id);
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
        )}
      </section>
    </div>
  );
}

function HolidayForm({ onAdded }: { onAdded: (title: string) => Promise<void> }) {
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
      await addHolidays([{ title: title.trim(), type, startDate, endDate: end }]);
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
    <section aria-labelledby="add-holiday-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
      <h2 id="add-holiday-heading" className="mb-4 text-xl font-bold">
        Ajouter une fermeture
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
