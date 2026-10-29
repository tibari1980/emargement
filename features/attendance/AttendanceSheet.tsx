"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { addDays, formatLongDate, formatSpokenTime, isValidIsoDate, isWeekend, nowTime, todayIso } from "@/lib/core/dates";
import { listForSession, saveAttendances, type AttendanceEntry } from "@/lib/data/attendances";
import type { Actor } from "@/lib/data/audit";
import { listSlots } from "@/lib/data/timetable";
import { listUsersByIds } from "@/lib/data/users";
import { can } from "@/lib/domain/permissions";
import { sessionsOn } from "@/lib/domain/schedule";
import type { Attendance, AttendanceStatus, TimetableSlot, UserProfile } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { TraineeRow, type RowState } from "./TraineeRow";

const SPOKEN_STATUS: Record<AttendanceStatus, string> = {
  present: "marqué présent",
  absent: "marqué absent",
  late: "marqué en retard",
  excused: "en absence justifiée",
};

/** Session to open by default: the one in progress, else the next one, else the first. */
function defaultSession(sessions: TimetableSlot[], date: string): TimetableSlot | undefined {
  if (date !== todayIso()) return sessions[0];
  const now = nowTime();
  return (
    sessions.find((s) => s.startTime <= now && now < s.endTime) ??
    sessions.find((s) => s.startTime > now) ??
    sessions[sessions.length - 1]
  );
}

export function AttendanceSheet({ profile }: { profile: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error: refError } = useReferenceData();
  const seesAll = can(profile.role, "attendance.recordAny");
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [choice, setChoice] = useState<{ date: string; slotId: string } | null>(null);
  const [roster, setRoster] = useState<{ key: string; trainees: UserProfile[] } | null>(null);
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    listSlots(seesAll ? {} : { trainerId: profile.id })
      .then(setSlots)
      .catch(() => setError("Impossible de charger vos séances."));
  }, [profile.id, seesAll]);

  const sessions = useMemo(() => {
    if (!slots || !lookups || !isValidIsoDate(date)) return [];
    const active = slots.filter((s) => lookups.formation(s.formationId)?.active !== false);
    return sessionsOn(active, date, lookups.closedDays);
  }, [slots, lookups, date]);

  const slot =
    (choice?.date === date ? sessions.find((s) => s.id === choice.slotId) : undefined) ?? defaultSession(sessions, date);
  const formation = slot && lookups ? lookups.formation(slot.formationId) : undefined;
  const sessionKey = slot ? `${slot.id}|${date}` : null;
  const trainees = roster && roster.key === sessionKey ? roster.trainees : null;

  useEffect(() => {
    if (!slot || !formation || !sessionKey) return;
    let stale = false;
    Promise.all([listUsersByIds(formation.traineeIds ?? []), listForSession(slot.id, date)])
      .then(([trainees, attendances]) => {
        if (stale) return;
        setRecords(Object.fromEntries(attendances.map((a) => [a.traineeId, a])));
        setRowState({});
        setRoster({ key: sessionKey, trainees });
      })
      .catch(() => !stale && setError("Impossible de charger la liste des stagiaires."));
    return () => {
      stale = true;
    };
  }, [slot, formation, date, sessionKey]);

  const label = slot && lookups ? `${lookups.subjectTitle(slot.subjectId)} — ${lookups.formationTitle(slot.formationId)}` : "";

  const save = useCallback(
    async (entries: AttendanceEntry[], { silent = false } = {}) => {
      if (!slot) return false;
      const previous = { ...records };
      setRecords((r) => {
        const next = { ...r };
        for (const e of entries) {
          next[e.trainee.id] = {
            id: "",
            formationId: slot.formationId,
            slotId: slot.id,
            subjectId: slot.subjectId,
            trainerId: slot.trainerId,
            traineeId: e.trainee.id,
            date,
            month: date.slice(0, 7),
            status: e.status,
            arrivalTime: e.status === "late" ? (e.arrivalTime ?? null) : null,
            excuseReason: null,
            recordedBy: profile.id,
          };
        }
        return next;
      });
      const mark = (state: RowState) =>
        setRowState((s) => ({ ...s, ...Object.fromEntries(entries.map((e) => [e.trainee.id, state])) }));
      mark("saving");
      try {
        await saveAttendances(profile, { slot, date, label }, entries);
        mark("saved");
        if (!silent && entries.length === 1) {
          const [e] = entries;
          const time =
            e.status === "late" && e.arrivalTime
              ? `, arrivée à ${formatSpokenTime(e.arrivalTime)}. Modifiez l'heure d'arrivée si nécessaire`
              : "";
          announce(`${e.trainee.fullName} ${SPOKEN_STATUS[e.status]}${time}. Enregistré.`);
        }
        return true;
      } catch {
        setRecords(previous);
        mark("error");
        announce("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.", "assertive");
        return false;
      }
    },
    [slot, date, label, profile, records, announce],
  );

  if (error || refError) return <Alert tone="error">{error ?? refError}</Alert>;
  if (!slots || !data || !lookups) return <Loading label="Chargement de vos séances…" />;

  const closure = data.holidays.find((h) => h.startDate <= date && date <= h.endDate);
  const pending = trainees?.filter((t) => !records[t.id]) ?? [];
  const count = (status: AttendanceStatus) => trainees?.filter((t) => records[t.id]?.status === status).length ?? 0;

  const markAllPresent = async () => {
    if (!pending.length) return;
    const ok = await save(
      pending.map((trainee) => ({ trainee, status: "present" as const })),
      { silent: true },
    );
    if (ok) announce(`${pending.length} stagiaire${pending.length > 1 ? "s" : ""} marqué${pending.length > 1 ? "s" : ""} présent${pending.length > 1 ? "s" : ""}.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="day-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="day-heading" className="mb-4 text-xl font-bold">
          Journée
        </h2>
        <div className="max-w-xs">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDate(addDays(date, -1))}>
            Jour précédent
          </Button>
          <Button variant="secondary" onClick={() => setDate(todayIso())}>
            Aujourd&apos;hui
          </Button>
          <Button variant="secondary" onClick={() => setDate(addDays(date, 1))}>
            Jour suivant
          </Button>
        </div>
        {isValidIsoDate(date) && <p className="mt-4 text-lg font-semibold">{formatLongDate(date)}</p>}
      </section>

      {isValidIsoDate(date) && isWeekend(date) && <Alert tone="info">Pas de séance le week-end.</Alert>}
      {closure && <Alert tone="info">Établissement fermé : {closure.title}.</Alert>}
      {isValidIsoDate(date) && !isWeekend(date) && !closure && sessions.length === 0 && (
        <Alert tone="info">
          {seesAll
            ? "Aucune séance programmée ce jour."
            : "Aucune séance ne vous est attribuée ce jour. Les emplois du temps sont gérés par les responsables pédagogiques."}
        </Alert>
      )}

      {sessions.length > 0 && (
        <fieldset className="rounded-lg border-2 border-gray-300 bg-white p-5">
          <legend className="px-1 text-xl font-bold">
            Séances du jour ({sessions.length})
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {sessions.map((s) => (
              <label
                key={s.id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border-2 border-gray-300 p-3 has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-amber-400"
              >
                <input
                  type="radio"
                  name="seance"
                  className="mt-1 h-5 w-5"
                  checked={slot?.id === s.id}
                  onChange={() => setChoice({ date, slotId: s.id })}
                />
                <span>
                  <span className="font-bold">
                    {s.startTime} – {s.endTime} · {lookups.subjectTitle(s.subjectId)}
                  </span>
                  <span className="block text-gray-800">
                    {lookups.formationTitle(s.formationId)}
                    {seesAll && ` · ${lookups.personName(s.trainerId)}`}
                    {s.room && ` · salle ${s.room}`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {slot && !trainees && <Loading label="Chargement des stagiaires…" />}
      {slot && trainees && trainees.length === 0 && (
        <Alert tone="info">Aucun stagiaire n&apos;est inscrit dans cette formation.</Alert>
      )}

      {slot && trainees && trainees.length > 0 && (
        <section aria-labelledby="list-heading" className="flex flex-col gap-4">
          <h2 id="list-heading" className="text-xl font-bold">
            {lookups.subjectTitle(slot.subjectId)}, {slot.startTime} – {slot.endTime}
          </h2>
          <p className="text-lg">
            {trainees.length} stagiaires : {count("present")} présents, {count("late")} en retard, {count("absent")} absents
            {count("excused") > 0 && `, ${count("excused")} en absence justifiée`}, {pending.length} non saisis.
          </p>
          <div>
            <Button onClick={markAllPresent} disabled={pending.length === 0}>
              Marquer présents les {pending.length} stagiaires non saisis
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Émargement de la séance {label}, {formatLongDate(date)} de {slot.startTime} à {slot.endTime}
              </caption>
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="p-3">Stagiaire</th>
                  <th scope="col" className="p-3">Statut</th>
                  <th scope="col" className="p-3">Heure d&apos;arrivée</th>
                  <th scope="col" className="p-3">Enregistrement</th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((trainee) => (
                  <TraineeRow
                    key={trainee.id}
                    trainee={trainee}
                    slot={slot}
                    date={date}
                    record={records[trainee.id]}
                    state={rowState[trainee.id] ?? "idle"}
                    onSave={(t, status, arrivalTime) => save([{ trainee: t, status, arrivalTime }])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
