"use client";

import { useCallback, useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { addDays, eachDay, formatLongDate, isValidIsoDate, isWeekend, todayIso } from "@/lib/dates";
import {
  justifyAbsences,
  listAttendancesForPeriod,
  listCourses,
  listHolidays,
  listUsersByIds,
} from "@/lib/firestore";
import { closedDaySet } from "@/lib/hoursCalculator";
import { rolesFor } from "@/lib/navigation";
import type { Attendance, Course, Holiday, UserProfile } from "@/lib/types";

const REASONS = [
  "Arrêt maladie",
  "Rendez-vous médical",
  "Convocation administrative",
  "Hospitalisation",
  "Événement familial",
];
const OTHER = "Autre";
const LOOKBACK_DAYS = 90;

/** Absences (justified or not) of a trainee over the last LOOKBACK_DAYS days, newest first. */
async function recentAbsences(courseId: string, traineeId: string): Promise<Attendance[]> {
  const today = todayIso();
  const records = await listAttendancesForPeriod(courseId, addDays(today, -LOOKBACK_DAYS), today);
  return records
    .filter((r) => r.traineeId === traineeId && (r.status === "absent" || r.status === "excused"))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function JustificationsPage() {
  return (
    <>
      <PageHeader
        title="Justificatifs d'absence"
        description="Enregistrez les justificatifs médicaux ou administratifs. Les jours concernés passent en « absence justifiée » dans les rapports."
      />
      <RoleGuard roles={rolesFor("/admin/justifications")}>{(profile) => <Justifications profile={profile} />}</RoleGuard>
    </>
  );
}

function Justifications({ profile }: { profile: UserProfile }) {
  const announce = useAnnounce();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [courseId, setCourseId] = useState("");
  const [trainees, setTrainees] = useState<UserProfile[]>([]);
  const [traineeId, setTraineeId] = useState("");
  const [history, setHistory] = useState<Attendance[]>([]);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCourses(), listHolidays()])
      .then(([courses, holidays]) => {
        setCourses(courses);
        setHolidays(holidays);
      })
      .catch(() => setError("Impossible de charger les formations."));
  }, []);

  const course = courses?.find((c) => c.id === courseId) ?? null;
  const trainee = trainees.find((t) => t.id === traineeId) ?? null;

  useEffect(() => {
    if (course) listUsersByIds(course.traineeIds ?? []).then(setTrainees).catch(() => {});
  }, [course]);

  const loadHistory = useCallback(async () => {
    if (course && traineeId) setHistory(await recentAbsences(course.id, traineeId));
  }, [course, traineeId]);

  useEffect(() => {
    if (!course || !traineeId) return;
    recentAbsences(course.id, traineeId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [course, traineeId]);

  const selectCourse = (id: string) => {
    setCourseId(id);
    setTraineeId("");
    setTrainees([]);
    setHistory([]);
  };

  const selectTrainee = (id: string) => {
    setTraineeId(id);
    setHistory([]);
  };

  if (!courses) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  const closed = closedDaySet(holidays);
  const schoolDays = (start: string, end: string) =>
    eachDay(start, end).filter((d) => !isWeekend(d) && !closed.has(d));

  const finalReason = reason === OTHER ? otherReason.trim() : reason;

  const apply = async (dates: string[]) => {
    if (!course || !trainee) return;
    setBusy(true);
    try {
      await justifyAbsences({
        courseId: course.id,
        traineeId: trainee.id,
        dates,
        reason: finalReason,
        validatedBy: profile.id,
      });
      await loadHistory();
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
    if (!course) e.course = "Choisissez une formation.";
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
      <section aria-labelledby="justify-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="justify-heading" className="mb-4 text-xl font-bold">
          Nouveau justificatif
        </h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {Object.keys(errors).length > 0 && (
            <Alert tone="error">Le formulaire contient des erreurs. Corrigez les champs signalés.</Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Formation" value={courseId} onChange={(e) => selectCourse(e.target.value)} error={errors.course}>
              <option value="">Choisir une formation</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Stagiaire"
              value={traineeId}
              onChange={(e) => selectTrainee(e.target.value)}
              error={errors.trainee}
              disabled={!course}
            >
              <option value="">{course ? "Choisir un stagiaire" : "Choisissez d'abord une formation"}</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </SelectField>
            <TextField label="Premier jour d'absence" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={errors.startDate} />
            <TextField label="Dernier jour d'absence" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} error={errors.endDate} />
            <SelectField label="Motif" value={reason} onChange={(e) => setReason(e.target.value)}>
              {[...REASONS, OTHER].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
            {reason === OTHER && (
              <TextField label="Précisez le motif" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} error={errors.otherReason} />
            )}
          </div>
          <p>Les week-ends et jours de fermeture de la période sont ignorés automatiquement.</p>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer le justificatif"}
            </Button>
          </div>
        </form>
      </section>

      {trainee && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <h2 id="history-heading" className="text-xl font-bold">
            Absences de {trainee.fullName} sur les {LOOKBACK_DAYS} derniers jours
          </h2>
          {history.length === 0 ? (
            <Alert tone="info">Aucune absence enregistrée sur cette période.</Alert>
          ) : (
            <ul className="divide-y-2 divide-gray-200 rounded-lg border-2 border-gray-300 bg-white">
              {history.map((h) => (
                <li key={h.date} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span>
                    <span className="font-semibold">{formatLongDate(h.date)}</span> —{" "}
                    {h.status === "excused" ? `justifiée (${h.excuseReason ?? "motif non précisé"})` : "non justifiée"}
                  </span>
                  {h.status === "absent" && (
                    <Button
                      variant="secondary"
                      disabled={busy || !finalReason}
                      onClick={() => apply([h.date])}
                      aria-label={`Justifier l'absence du ${formatLongDate(h.date)} avec le motif ${finalReason || "non renseigné"}`}
                    >
                      Justifier ({finalReason || "motif à préciser"})
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
