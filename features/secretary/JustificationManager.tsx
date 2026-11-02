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
import { getDemoFormations, getInitialFormations, groupFormations, listFormations } from "@/lib/data/formations";
import { listHolidays } from "@/lib/data/holidays";
import { createNotification } from "@/lib/data/notifications";
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
  // Toujours initialisé avec les formations du catalogue officiel pour éviter toute liste déroulante vide
  const [formations, setFormations] = useState<Formation[]>(() => getInitialFormations());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [formationId, setFormationId] = useState(() => {
    const init = getInitialFormations();
    const withTrainees = init.find((f) => (f.traineeIds?.length ?? 0) > 0);
    return withTrainees ? withTrainees.id : (init[0]?.id ?? "");
  });
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
  const [successFeedback, setSuccessFeedback] = useState<{
    traineeName: string;
    daysCount: number;
    dates: string[];
    reason: string;
  } | null>(null);

  useEffect(() => {
    let stale = false;
    Promise.all([
      listFormations().catch(() => getDemoFormations()),
      listHolidays().catch(() => []),
    ])
      .then(([fList, hList]) => {
        if (!stale) {
          const validList = fList && fList.length > 0 ? fList : getDemoFormations();
          setFormations(validList);
          setHolidays(hList);
          setFormationId((prev) => {
            if (prev && validList.some((f) => f.id === prev)) return prev;
            // Priorité absolue à une promotion ayant des stagiaires inscrits (ex. Adaptation avec ses 8 stagiaires)
            const withTrainees = validList.find((f) => (f.traineeIds?.length ?? 0) > 0);
            return withTrainees ? withTrainees.id : (validList[0]?.id ?? "");
          });
        }
      })
      .catch((err) => {
        console.warn("Justifications: load failed", err);
        if (!stale) {
          const fallback = getDemoFormations();
          setFormations(fallback);
          setHolidays([]);
          setFormationId((prev) => prev || fallback[0]?.id || "");
        }
      });
    return () => {
      stale = true;
    };
  }, []);

  const formation = formations.find((f) => f.id === formationId) ?? null;
  const trainee = trainees.find((t) => t.id === traineeId) ?? null;

  useEffect(() => {
    if (formation) {
      listUsersByIds(formation.traineeIds ?? [])
        .then((tList) => {
          setTrainees(tList);
          setTraineeId((prev) => {
            if (prev && tList.some((t) => t.id === prev)) return prev;
            return tList.length > 0 ? tList[0].id : "";
          });
        })
        .catch(() => {
          setTrainees([]);
          setTraineeId("");
        });
      listSlots({ formationId: formation.id }).then(setSlots).catch(() => setSlots([]));
    } else {
      setTrainees([]);
      setTraineeId("");
      setSlots([]);
    }
  }, [formation]);

  const getRelevantMonths = useCallback(() => {
    const today = todayIso();
    const pastMonths = eachDay(addDays(today, -LOOKBACK_DAYS), today).map((d) => d.slice(0, 7));
    const futureMonths = eachDay(today, addDays(today, 60)).map((d) => d.slice(0, 7));
    const selectedMonths = [startDate.slice(0, 7), endDate.slice(0, 7)].filter(Boolean);
    return [...new Set([...pastMonths, ...futureMonths, ...selectedMonths])];
  }, [startDate, endDate]);

  const refreshHistory = useCallback(async () => {
    if (!formation || !traineeId) return;
    const months = getRelevantMonths();
    const records = await listForFormation(formation.id, months);
    setHistory(
      records
        .filter((r) => r.traineeId === traineeId && (r.status === "absent" || r.status === "excused"))
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }, [formation, traineeId, getRelevantMonths]);

  useEffect(() => {
    let ignore = false;
    if (!formation || !traineeId) {
      return;
    }
    const months = getRelevantMonths();
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
  }, [formation, traineeId, getRelevantMonths]);

  const selectFormation = (id: string) => {
    if (id === formationId) return;
    setFormationId(id);
    setTraineeId("");
    setHistory([]);
    setSuccessFeedback(null);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.formation;
      delete copy.trainee;
      return copy;
    });
  };

  const selectTrainee = (id: string) => {
    setTraineeId(id);
    setHistory([]);
    setSuccessFeedback(null);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.trainee;
      return copy;
    });
  };

  const closed = closedDaySet(holidays);
  const schoolDays = (start: string, end: string) =>
    eachDay(start, end).filter((d) => !isWeekend(d) && !closed.has(d));

  const finalReason = reason === OTHER ? otherReason.trim() : reason;

  const apply = async (dates: string[]) => {
    if (!formation || !trainee) return;
    setBusy(true);
    setSuccessFeedback(null);
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

      // Dispatch institutional notifications to trainers and pedagogical supervisor
      void createNotification(
        {
          title: "Absence justifiée enregistrée",
          message: `${trainee.fullName} (${formation.title}) : absence justifiée pour « ${finalReason} » (${dates.length} j).`,
          type: "info",
          targetRole: "trainer",
        },
        actor
      );
      void createNotification(
        {
          title: "Nouveau justificatif enregistré",
          message: `${trainee.fullName} (${formation.title}) : absence justifiée enregistrée par ${actor.fullName}.`,
          type: "info",
          targetRole: "pedagogical_lead",
        },
        actor
      );

      await refreshHistory();
      const plural = dates.length > 1 ? "s" : "";
      announce(`${dates.length} jour${plural} justifié${plural} pour ${trainee.fullName} : ${finalReason}.`);
      setSuccessFeedback({
        traineeName: trainee.fullName,
        daysCount: dates.length,
        dates,
        reason: finalReason,
      });
    } catch {
      announce("L'enregistrement du justificatif n'a pas pu aboutir. Veuillez vérifier votre connexion et réessayer.", "assertive");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const e: Record<string, string> = {};
    if (!formation) e.formation = "Veuillez choisir une formation.";
    if (!trainee) e.trainee = "Veuillez sélectionner un stagiaire.";
    if (!isValidIsoDate(startDate)) e.startDate = "Veuillez renseigner une date de début valide.";
    if (!isValidIsoDate(endDate)) e.endDate = "Veuillez renseigner une date de fin valide.";
    else if (endDate < startDate) e.endDate = "La date de fin doit être égale ou postérieure à la date de début.";
    if (!finalReason) e.otherReason = "Merci de préciser le motif de l'absence.";
    if (!Object.keys(e).length && schoolDays(startDate, endDate).length === 0) {
      e.endDate = "La période sélectionnée ne comporte aucun jour ouvré de formation (week-ends et jours fériés exclus).";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    await apply(schoolDays(startDate, endDate));
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="justify-heading" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-6 shadow-xs">
        <h2 id="justify-heading" className="mb-4 text-xl font-bold text-primary flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Nouveau justificatif</span>
        </h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {successFeedback && (
            <Alert tone="success" onClose={() => setSuccessFeedback(null)}>
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-sm">
                  Justificatif enregistré avec succès pour {successFeedback.traineeName}
                </span>
                <span className="text-xs">
                  {successFeedback.daysCount} jour{successFeedback.daysCount > 1 ? "s" : ""} de formation justifié{successFeedback.daysCount > 1 ? "s" : ""} pour le motif « <strong>{successFeedback.reason}</strong> ».
                </span>
                <span className="text-xs opacity-90 font-mono">
                  Dates appliquées : {successFeedback.dates.map((d) => formatLongDate(d)).join(", ")}
                </span>
                <span className="text-[11px] opacity-75 italic">
                  Note : Les samedis, dimanches et jours fériés de la période sont automatiquement exclus.
                </span>
              </div>
            </Alert>
          )}
          {Object.keys(errors).length > 0 && (
            <Alert tone="error">Merci de vérifier les informations signalées ci-dessous pour finaliser l&apos;enregistrement du justificatif.</Alert>
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
              disabled={!formation || trainees.length === 0}
            >
              <option value="">
                {!formation
                  ? "Choisissez d'abord une formation"
                  : trainees.length === 0
                  ? "Aucun stagiaire inscrit dans cette formation"
                  : "Choisir un stagiaire"}
              </option>
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
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Enregistrement…" : "Enregistrer le justificatif"}
            </Button>
          </div>
        </form>
      </section>

      {trainee && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <h2 id="history-heading" className="text-xl font-bold text-primary flex items-center gap-2">
            <History className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            <span>Historique des absences et justificatifs de {trainee.fullName}</span>
          </h2>
          {history.length === 0 ? (
            <Alert tone="info">
              Parfait ! Aucune absence ni justificatif n&apos;est enregistré pour {trainee.fullName} sur la période ({LOOKBACK_DAYS} derniers jours et 60 prochains jours). L&apos;assiduité est exemplaire.
            </Alert>
          ) : (
            <ul className="divide-y divide-surface-container rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden">
              {Array.from(
                history.reduce<Map<string, Attendance[]>>((acc, item) => {
                  const list = acc.get(item.date) ?? [];
                  list.push(item);
                  acc.set(item.date, list);
                  return acc;
                }, new Map()),
              ).map(([dateKey, dayRecords]) => {
                const isExcused = dayRecords.some((r) => r.status === "excused");
                const excuseLabel = dayRecords.find((r) => r.excuseReason)?.excuseReason ?? "validé";
                return (
                  <li key={dateKey} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-sm text-on-surface">{formatLongDate(dateKey)}</span>
                      {dayRecords.length > 1 && (
                        <span className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                          {dayRecords.length} séances
                        </span>
                      )}
                      <span className="text-outline text-xs">•</span>
                      {isExcused ? (
                        <span className="inline-flex rounded-full bg-status-excused-bg text-status-excused border border-status-excused-border/50 px-2.5 py-0.5 text-xs font-bold">
                          Justifiée : {excuseLabel}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-status-absent-bg text-status-absent border border-status-absent-border/50 px-2.5 py-0.5 text-xs font-bold">
                          Non justifiée
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {!isExcused && (
                        <Button
                          variant="secondary"
                          disabled={busy || !finalReason}
                          onClick={() => apply([dateKey])}
                          className="!min-h-9 !px-3 text-xs rounded-xl"
                          aria-label={`Justifier l'absence du ${formatLongDate(dateKey)} avec le motif ${finalReason || "non renseigné"}`}
                        >
                          Justifier ({finalReason || "motif à préciser"})
                        </Button>
                      )}
                      {isExcused && (
                        <ConfirmDialog
                          triggerLabel="Annuler le justificatif"
                          triggerAccessibleLabel={`Annuler le justificatif du ${formatLongDate(dateKey)} pour ${trainee.fullName}`}
                          title="Annuler ce justificatif ?"
                          description={`L'absence du ${formatLongDate(dateKey)} repassera en statut non justifié dans les rapports.`}
                          confirmLabel="Confirmer l'annulation"
                          onConfirm={async () => {
                            try {
                              await Promise.all(
                                dayRecords.map((rec) =>
                                  revokeJustification(actor, {
                                    trainee,
                                    slotId: rec.slotId || "general",
                                    date: rec.date,
                                    formationId: rec.formationId,
                                    subjectId: rec.subjectId,
                                    trainerId: rec.trainerId,
                                  }),
                                ),
                              );
                              void createNotification(
                                {
                                  title: "Justificatif révoqué",
                                  message: `Le justificatif d'absence de ${trainee.fullName} (${formatLongDate(dateKey)}) a été révoqué par ${actor.fullName}.`,
                                  type: "warning",
                                  targetRole: "pedagogical_lead",
                                },
                                actor
                              );
                              await refreshHistory();
                              announce(`Justificatif du ${formatLongDate(dateKey)} annulé.`);
                            } catch {
                              announce("Échec de l'annulation du justificatif.", "assertive");
                            }
                          }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
