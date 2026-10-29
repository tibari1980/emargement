// Monthly hours calculation engine (PRD section 5), per session.
//
//   Theoretical hours  = Σ duration of the sessions scheduled on working days
//                        (Monday to Friday, excluding holidays and vacations)
//   Total absence (h)  = Σ absent sessions + Σ justified sessions + Σ late minutes / 60
//   Effective presence = theoretical hours − total absence
//
// Justified absences are deducted from the presence but reported separately.
// Pure functions: used in the browser and covered by unit tests.

import { eachDay, isWeekend, monthBounds, timeToMinutes } from "@/lib/core/dates";
import { isSlotActiveOn, slotMinutes } from "./schedule";
import type { Attendance, Holiday, TimetableSlot, UserProfile } from "./types";

export type ReportSlot = Pick<
  TimetableSlot,
  "id" | "subjectId" | "weekday" | "startTime" | "endTime" | "validFrom" | "validTo"
>;
export type ReportTrainee = Pick<UserProfile, "id" | "fullName">;
export type ReportAttendance = Pick<Attendance, "slotId" | "traineeId" | "date" | "status" | "arrivalTime">;
export type ReportHoliday = Pick<Holiday, "startDate" | "endDate">;

export interface SubjectHours {
  subjectId: string;
  title: string;
  theoreticalHours: number;
  absenceHours: number;
}

export interface TraineeMonthlyHours {
  traineeId: string;
  fullName: string;
  theoreticalHours: number;
  lateCount: number;
  lateMinutes: number;
  absentSessions: number;
  excusedSessions: number;
  absentHours: number;
  excusedHours: number;
  totalAbsenceHours: number;
  effectivePresenceHours: number;
  /** Past sessions without any attendance record. */
  unrecordedSessions: number;
  /** Effective presence / theoretical hours, between 0 and 1. */
  attendanceRate: number;
  bySubject: SubjectHours[];
}

export interface MonthlyReport {
  month: string;
  formationId: string;
  formationTitle: string;
  /** Weekdays of the month that are not closed. */
  workingDays: string[];
  /** Weekdays of the month closed for a holiday or a vacation. */
  closedDays: string[];
  sessionCount: number;
  theoreticalHours: number;
  subjects: SubjectHours[];
  trainees: TraineeMonthlyHours[];
  totals: {
    theoreticalHours: number;
    absentHours: number;
    excusedHours: number;
    lateMinutes: number;
    totalAbsenceHours: number;
    effectivePresenceHours: number;
  };
}

/** Every day (weekends included) covered by a holiday or a vacation. */
export function closedDaySet(holidays: ReportHoliday[]): Set<string> {
  const closed = new Set<string>();
  for (const h of holidays) {
    if (!h.startDate || !h.endDate || h.endDate < h.startDate) continue;
    for (const day of eachDay(h.startDate, h.endDate)) closed.add(day);
  }
  return closed;
}

export function workingDaysOfMonth(
  month: string,
  holidays: ReportHoliday[],
): { workingDays: string[]; closedDays: string[] } {
  const { start, end } = monthBounds(month);
  const closed = closedDaySet(holidays);
  const workingDays: string[] = [];
  const closedDays: string[] = [];
  for (const day of eachDay(start, end)) {
    if (isWeekend(day)) continue;
    (closed.has(day) ? closedDays : workingDays).push(day);
  }
  return { workingDays, closedDays };
}

/** Minutes between the session start and the actual arrival, capped to the session length. */
export function lateMinutesFor(
  arrivalTime: string | null,
  slot: Pick<TimetableSlot, "startTime" | "endTime">,
): number {
  if (!arrivalTime) return 0;
  const arrival = timeToMinutes(arrivalTime);
  const start = timeToMinutes(slot.startTime);
  if (arrival === null || start === null) return 0;
  return Math.min(Math.max(arrival - start, 0), slotMinutes(slot));
}

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export function computeMonthlyReport(input: {
  month: string;
  formation: { id: string; title: string };
  slots: ReportSlot[];
  subjectTitles: Record<string, string>;
  trainees: ReportTrainee[];
  attendances: ReportAttendance[];
  holidays: ReportHoliday[];
  /** Sessions after this date are not counted as "unrecorded". Defaults to the whole month. */
  today?: string;
}): MonthlyReport {
  const { month, formation, slots, subjectTitles, trainees, attendances, holidays } = input;
  const { workingDays, closedDays } = workingDaysOfMonth(month, holidays);
  const today = input.today ?? monthBounds(month).end;
  const titleOf = (id: string) => subjectTitles[id] ?? "Matière supprimée";

  const sessions = workingDays.flatMap((date) =>
    slots.filter((slot) => isSlotActiveOn(slot, date)).map((slot) => ({ date, slot, minutes: slotMinutes(slot) })),
  );
  const theoreticalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);

  const subjectTheory = new Map<string, number>();
  for (const s of sessions) {
    subjectTheory.set(s.slot.subjectId, (subjectTheory.get(s.slot.subjectId) ?? 0) + s.minutes);
  }

  const records = new Map<string, ReportAttendance>();
  for (const a of attendances) records.set(`${a.slotId}|${a.traineeId}|${a.date}`, a);

  const subjectAbsence = new Map<string, number>();

  const rows: TraineeMonthlyHours[] = trainees.map((trainee) => {
    let lateCount = 0;
    let lateMinutes = 0;
    let absentSessions = 0;
    let excusedSessions = 0;
    let absentMinutes = 0;
    let excusedMinutes = 0;
    let unrecordedSessions = 0;
    const absenceBySubject = new Map<string, number>();

    for (const { date, slot, minutes } of sessions) {
      const record = records.get(`${slot.id}|${trainee.id}|${date}`);
      let missed = 0;
      if (!record) {
        if (date <= today) unrecordedSessions++;
      } else if (record.status === "absent") {
        absentSessions++;
        absentMinutes += minutes;
        missed = minutes;
      } else if (record.status === "excused") {
        excusedSessions++;
        excusedMinutes += minutes;
        missed = minutes;
      } else if (record.status === "late") {
        lateCount++;
        missed = lateMinutesFor(record.arrivalTime, slot);
        lateMinutes += missed;
      }
      if (missed) absenceBySubject.set(slot.subjectId, (absenceBySubject.get(slot.subjectId) ?? 0) + missed);
    }

    for (const [subjectId, minutes] of absenceBySubject) {
      subjectAbsence.set(subjectId, (subjectAbsence.get(subjectId) ?? 0) + minutes);
    }

    const totalAbsenceMinutes = absentMinutes + excusedMinutes + lateMinutes;
    const effectiveMinutes = Math.max(theoreticalMinutes - totalAbsenceMinutes, 0);

    return {
      traineeId: trainee.id,
      fullName: trainee.fullName,
      theoreticalHours: hours(theoreticalMinutes),
      lateCount,
      lateMinutes,
      absentSessions,
      excusedSessions,
      absentHours: hours(absentMinutes),
      excusedHours: hours(excusedMinutes),
      totalAbsenceHours: hours(totalAbsenceMinutes),
      effectivePresenceHours: hours(effectiveMinutes),
      unrecordedSessions,
      attendanceRate: theoreticalMinutes > 0 ? effectiveMinutes / theoreticalMinutes : 0,
      bySubject: [...subjectTheory].map(([subjectId, minutes]) => ({
        subjectId,
        title: titleOf(subjectId),
        theoreticalHours: hours(minutes),
        absenceHours: hours(absenceBySubject.get(subjectId) ?? 0),
      })),
    };
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));

  const sum = (pick: (r: TraineeMonthlyHours) => number) =>
    Math.round(rows.reduce((acc, r) => acc + pick(r), 0) * 100) / 100;

  return {
    month,
    formationId: formation.id,
    formationTitle: formation.title,
    workingDays,
    closedDays,
    sessionCount: sessions.length,
    theoreticalHours: hours(theoreticalMinutes),
    subjects: [...subjectTheory]
      .map(([subjectId, minutes]) => ({
        subjectId,
        title: titleOf(subjectId),
        theoreticalHours: hours(minutes),
        absenceHours: hours(subjectAbsence.get(subjectId) ?? 0),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "fr")),
    trainees: rows,
    totals: {
      theoreticalHours: sum((r) => r.theoreticalHours),
      absentHours: sum((r) => r.absentHours),
      excusedHours: sum((r) => r.excusedHours),
      lateMinutes: sum((r) => r.lateMinutes),
      totalAbsenceHours: sum((r) => r.totalAbsenceHours),
      effectivePresenceHours: sum((r) => r.effectivePresenceHours),
    },
  };
}
