"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck, History } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { addDays, eachDay, formatLongDate, isValidIsoDate, isWeekend, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { justifySessions, listForFormation, revokeJustification } from "@/lib/data/attendances";
import { groupFormations, listFormations } from "@/lib/data/formations";
import { listHolidays } from "@/lib/data/holidays";
import { listSlots } from "@/lib/data/timetable";
import { listUsersByIds } from "@/lib/data/users";
import { closedDaySet } from "@/lib/domain/hoursCalculator";
import { isSlotActiveOn } from "@/lib/domain/schedule";
import type { Attendance, Formation, Holiday, TimetableSlot, UserProfile } from "@/lib/domain/types";

const REASONS = [
  "Arrêt maladie",
  "Rendez-vous médical",
  "Convocation administrative",
  "Hospitalisation",
  "Événement familial",
];
const OTHER = "Autre";
const LOOKBACK_DAYS = 90;

export function JustificationManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const [formations, setFormations] = useState<Formation[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [formationId, setFormationId] = useState("");
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [trainees, setTrainees] = useState<UserProfile[]>([]);
  const [traineeId, setTraineeId] = useState("");
  const [history, setHistory] = useState<Attendance[]>([]);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    Promise.all([
      listFormations().catch(() => []),
      listHolidays().catch(() => []),
    ])
      .then(([fList, hList]) => {
        if (!stale) {
          setFormations(fList);
          setHolidays(hList);
          if (fList.length > 0) setFormationId(fList[0].id);
        }
      })
      .catch((err) => {
        console.warn("Justifications: load failed", err);
        if (!stale) {
          setFormations([]);
          setHolidays([]);
        }
      });
    return () => {
      stale = true;
    };
  }, []);

  const formation = formations?.find((f) => f.id === formationId) ?? null;
  const trainee = trainees.find((t) => t.id === traineeId) ?? null;

  useEffect(() => {
    if (formation) {
      listUsersByIds(formation.traineeIds ?? [])
        .then((tList) => {
          setTrainees(tList);
          if (tList.length > 0) setTraineeId(tList[0].id);
        })
        .catch(() => {});
      listSlots({ formationId: formation.id }).then(setSlots).catch(() => setSlots([]));
    }
  }, [formation]);

  const refreshHistory = useCallback(async () => {
    if (!formation || !traineeId) return;
    const today = todayIso();
    const months = [...new Set(eachDay(addDays(today, -LOOKBACK_DAYS), today).map((d) => d.slice(0, 7)))];
    const records = await listForFormation(formation.id, months);
    setHistory(
      records
        .filter((r) => r.traineeId === traineeId && (r.status === "absent" || r.status === "excused"))
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }, [formation, traineeId]);

  useEffect(() => {
    let ignore = false;
    if (!formation || !traineeId) {
      return;
    }
    const today = todayIso();
    const months = [...new Set(eachDay(addDays(today, -LOOKBACK_DAYS), today).map((d) => d.slice(0, 7)))];
    listForFormation(formation.id, months)
      .then((records) => {
        if (!ignore) {
          setHistory(
            records
              .filter((r) => r.traineeId === traineeId && (r.status === "absent" || r.status === "excused"))
              .sort((a, b) => b.date.localeCompare(a.date)),
          );
        }
      })
      .catch(() => {
        if (!ignore) setHistory([]);
      });
    return () => {
      ignore = true;
    };
  }, [formation, traineeId]);

  const selectFormation = (id: string) => {
    setFormationId(id);
    setTraineeId("");
    setTrainees([]);
    setHistory([]);
  };

  const selectTrainee = (id: string) => {
    setTraineeId(id);
    setHistory([]);
  };

  if (!formations) return <Loading label="Chargement des justificatifs..." />;

  const closed = closedDaySet(holidays);
  const schoolDays = (start: string, end: string) =>
    eachDay(start, end).filter((d) => !isWeekend(d) && !closed.has(d));

  const finalReason = reason === OTHER ? otherReason.trim() : reason;

  const apply = async (dates: string[]) => {
    if (!formation || !trainee) return;
    setBusy(true);
    try {
      const activeSessions: { slot: TimetableSlot; date: string }[] = [];
      for (const d of dates) {
        const matchingSlots = slots.filter((s) => isSlotActiveOn(s, d));
        if (matchingSlots.length > 0) {
          for (const s of matchingSlots) activeSessions.push({ slot: s, date: d });
        } else {
          // If no specific slot defined, create a fallback virtual slot
          activeSessions.push({
            slot: {
              id: "general",
              formationId: formation.id,
              subjectId: "general",
              trainerId: actor.id,
              weekday: 1,
              startTime: "09:00",
              endTime: "17:00",
              room: "",
              validFrom: "1970-01-01",
              validTo: null,
            },
            date: d,
          });
        }
      }

      await justifySessions(actor, {
        trainee,
        sessions: activeSessions,
        reason: finalReason,
        periodLabel: dates.length === 1 ? dates[0] : `du ${dates[0]} au ${dates[dates.length - 1]}`,
      });

      await refreshHistory();
      const plural = dates.length > 1 ? "s" : "";
      announce(`${dates.length} jour${plural} justifié${plural} pour ${trainee.fullName} : ${finalReason}.`);
    } catch {
      announce("L'enregistrement du justificatif a échoué.", "assertive");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const e: Record<string, string> = {};
    if (!formation) e.formation = "Choisissez une formation.";
    if (!trainee) e.trainee = "Choisissez un stagiaire.";
    if (!isValidIsoDate(startDate)) e.startDate = "Date de début invalide.";
    if (!isValidIsoDate(endDate)) e.endDate = "Date de fin invalide.";
    else if (endDate < startDate) e.endDate = "La fin doit être après le début.";
    if (!finalReason) e.otherReason = "Précisez le motif.";
    if (!Object.keys(e).length && schoolDays(startDate, endDate).length === 0) {
      e.endDate = "La période ne contient aucun jour de formation (week-ends et fermetures exclus).";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    await apply(schoolDays(startDate, endDate));
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="justify-heading" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
        <h2 id="justify-heading" className="mb-4 text-xl font-bold text-primary flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Nouveau justificatif</span>
        </h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {Object.keys(errors).length > 0 && (
            <Alert tone="error">Le formulaire contient des erreurs. Corrigez les champs signalés.</Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Formation"
              value={formationId}
              onChange={(e) => selectFormation(e.target.value)}
              error={errors.formation}
            >
              <option value="">Choisir une formation</option>
              {groupFormations(formations).map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>
            <SelectField
              label="Stagiaire"
              value={traineeId}
              onChange={(e) => selectTrainee(e.target.value)}
              error={errors.trainee}
              disabled={!formation}
            >
              <option value="">{formation ? "Choisir un stagiaire" : "Choisissez d'abord une formation"}</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Premier jour d'absence"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={errors.startDate}
            />
            <TextField
              label="Dernier jour d'absence"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={errors.endDate}
            />
            <SelectField label="Motif" value={reason} onChange={(e) => setReason(e.target.value)}>
              {[...REASONS, OTHER].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
            {reason === OTHER && (
              <TextField
                label="Précisez le motif"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                error={errors.otherReason}
              />
            )}
          </div>
          <p className="text-xs text-on-surface-variant">Les week-ends et jours de fermeture de la période sont ignorés automatiquement.</p>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer le justificatif"}
            </Button>
          </div>
        </form>
      </section>

      {trainee && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <h2 id="history-heading" className="text-xl font-bold text-primary flex items-center gap-2">
            <History className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            <span>Absences de {trainee.fullName} sur les {LOOKBACK_DAYS} derniers jours</span>
          </h2>
          {history.length === 0 ? (
            <Alert tone="info">Aucune absence enregistrée sur cette période.</Alert>
          ) : (
            <ul className="divide-y divide-surface-container rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden">
              {history.map((h) => (
                <li key={h.date} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-on-surface">{formatLongDate(h.date)}</span>
                    <span className="text-outline text-xs">•</span>
                    {h.status === "excused" ? (
                      <span className="inline-flex rounded-full bg-status-excused-bg text-status-excused border border-status-excused-border/50 px-2.5 py-0.5 text-xs font-bold">
                        Justifiée : {h.excuseReason ?? "validé"}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-status-absent-bg text-status-absent border border-status-absent-border/50 px-2.5 py-0.5 text-xs font-bold">
                        Non justifiée
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {h.status === "absent" && (
                      <Button
                        variant="secondary"
                        disabled={busy || !finalReason}
                        onClick={() => apply([h.date])}
                        className="!min-h-9 !px-3 text-xs rounded-xl"
                        aria-label={`Justifier l'absence du ${formatLongDate(h.date)} avec le motif ${finalReason || "non renseigné"}`}
                      >
                        Justifier ({finalReason || "motif à préciser"})
                      </Button>
                    )}
                    {h.status === "excused" && (
                      <ConfirmDialog
                        triggerLabel="Annuler le justificatif"
                        triggerAccessibleLabel={`Annuler le justificatif du ${formatLongDate(h.date)} pour ${trainee.fullName}`}
                        title="Annuler ce justificatif ?"
                        description={`L'absence du ${formatLongDate(h.date)} repassera en statut non justifié dans les rapports.`}
                        confirmLabel="Confirmer l'annulation"
                        onConfirm={async () => {
                          try {
                            await revokeJustification(actor, {
                              trainee,
                              slotId: h.slotId || "general",
                              date: h.date,
                              formationId: h.formationId,
                              subjectId: h.subjectId,
                              trainerId: h.trainerId,
                            });
                            await refreshHistory();
                            announce(`Justificatif du ${formatLongDate(h.date)} annulé.`);
                          } catch {
                            announce("Échec de l'annulation du justificatif.", "assertive");
                          }
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
