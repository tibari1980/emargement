// Monthly hours calculation engine (PRD section 5), per session.
//
//   Theoretical hours  = Σ duration of the sessions scheduled on working days
//                        (Monday to Friday, excluding holidays, vacations, and French public holidays)
//   Total absence (h)  = Σ absent sessions + Σ justified sessions + Σ late minutes / 60
//   Effective presence = theoretical hours − total absence − exempted hours
//
// ASP Transmission Rules (Agence de Services et de Paiement):
//   - Deductible hours = unexcused absences + late minutes (prorated)
//   - Excused hours    = medical / official justifications transmitted with proofs
//   - Exempted hours   = sessions cancelled by the center (dispense administrative)
// Pure functions: used in the browser and covered by unit tests.

import { eachDay, isWeekend, monthBounds, timeToMinutes } from "@/lib/core/dates";
import { frenchPublicHolidays } from "./frenchHolidays";
import { isSlotActiveOn, slotMinutes } from "./schedule";
import type { Attendance, Holiday, SessionOverride, TimetableSlot, UserProfile } from "./types";

export type ReportSlot = Pick<
  TimetableSlot,
  "id" | "subjectId" | "weekday" | "startTime" | "endTime" | "validFrom" | "validTo"
>;
export type ReportTrainee = Pick<UserProfile, "id" | "fullName">;
export type ReportAttendance = Pick<Attendance, "traineeId" | "date" | "status" | "arrivalTime"> & {
  slotId?: string;
  excuseReason?: string | null;
};
export type ReportHoliday = Pick<Holiday, "startDate" | "endDate"> & {
  title?: string;
};
export type ReportSessionOverride = Pick<
  SessionOverride,
  "slotId" | "date" | "isCancelled" | "cancellationReason" | "isSelfStudyTP" | "substituteTrainerName"
>;

export interface SubjectHours {
  subjectId: string;
  title: string;
  theoreticalHours: number;
  absenceHours: number;
}

export interface TraineeSessionRecord {
  date: string;
  slotId: string;
  subjectId: string;
  subjectTitle: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "present" | "absent" | "late" | "excused" | "cancelled" | "unrecorded";
  arrivalTime: string | null;
  lateMinutes: number;
  excuseReason: string | null;
  isCancelled: boolean;
  cancellationReason?: string | null;
  isSelfStudyTP: boolean;
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
  /** Effective presence / net theoretical hours, between 0 and 1. */
  attendanceRate: number;
  bySubject: SubjectHours[];

  // --- ASP & Enhanced Transmission Fields ---
  /** Strict deductible hours for ASP (unexcused absences + late minutes) */
  aspDeductibleHours: number;
  /** Excused hours with justification (sick leave, official summons) transmitted to ASP */
  aspExcusedHours: number;
  /** Certified realized presence hours */
  aspRealizedHours: number;
  /** Hours administratively exempted by the center (cancelled sessions, trainer absent) */
  exemptedHours: number;
  /** Net billable / payable theoretical hours (theoreticalHours - exemptedHours) */
  netTheoreticalHours: number;
  /** Compliance status for ASP transmission */
  aspStatus: "compliant" | "warning_unrecorded" | "has_deductions";
  /** Breakdown of excused hours by reason (e.g. "Arrêt maladie": { count: 2, hours: 7 }) */
  excuseReasonsSummary: Record<string, { count: number; hours: number }>;
  /** Chronological history of all sessions in the month for audit/justification */
  sessionsList: TraineeSessionRecord[];

  /** Backwards compatibility fields */
  presentDays?: number;
  absentDays?: number;
  excusedDays?: number;
  unrecordedDays?: number;
}

export interface MonthlyReport {
  month: string;
  formationId: string;
  formationTitle: string;
  /** Backwards compatibility field */
  courseTitle?: string;
  dailyHours?: number;
  defaultStartTime?: string;
  defaultEndTime?: string;
  /** Weekdays of the month that are not closed. */
  workingDays: string[];
  /** Weekdays of the month closed for a holiday, vacation, or French public holiday. */
  closedDays: string[];
  /** Closed days with their title/reason (e.g. "2026-11-11": "Armistice 1918") */
  holidayTitles?: Record<string, string>;
  sessionCount: number;
  theoreticalHours: number;
  exemptedHours: number;
  netTheoreticalHours: number;
  subjects: SubjectHours[];
  trainees: TraineeMonthlyHours[];
  totals: {
    theoreticalHours: number;
    absentHours: number;
    excusedHours: number;
    lateMinutes: number;
    totalAbsenceHours: number;
    effectivePresenceHours: number;
    exemptedHours: number;
    netTheoreticalHours: number;
    aspDeductibleHours: number;
  };
  aspTotals: {
    totalDeductibleHours: number;
    totalRealizedHours: number;
    totalExcusedHours: number;
    totalExemptedHours: number;
    traineesWithDeductionsCount: number;
    unrecordedSessionsCount: number;
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

/**
 * Calculates working days and closed days for a month ("YYYY-MM").
 * Automatically incorporates French public holidays (11 legal holidays) by default.
 * Weekends (Saturday and Sunday) are strictly excluded.
 */
export function workingDaysOfMonth(
  month: string,
  holidays: ReportHoliday[] = [],
  options?: { includeFrenchPublicHolidays?: boolean },
): { workingDays: string[]; closedDays: string[]; holidayTitles: Record<string, string> } {
  const { start, end } = monthBounds(month);
  const closed = closedDaySet(holidays);
  const holidayTitles: Record<string, string> = {};

  // Map known user-defined holiday titles if present
  for (const h of holidays) {
    if (h.startDate && h.endDate && h.title) {
      for (const d of eachDay(h.startDate, h.endDate)) {
        holidayTitles[d] = h.title;
      }
    }
  }

  // Automatically include French legal public holidays (unless explicitly turned off)
  const includeFrench = options?.includeFrenchPublicHolidays ?? true;
  if (includeFrench) {
    const year = Number(month.slice(0, 4));
    if (!Number.isNaN(year)) {
      const publicHolidays = frenchPublicHolidays(year);
      for (const ph of publicHolidays) {
        if (ph.date.startsWith(month)) {
          closed.add(ph.date);
          holidayTitles[ph.date] = ph.title;
        }
      }
    }
  }

  const workingDays: string[] = [];
  const closedDays: string[] = [];
  for (const day of eachDay(start, end)) {
    if (isWeekend(day)) continue; // Weekends are NEVER counted
    if (closed.has(day)) {
      closedDays.push(day);
    } else {
      workingDays.push(day);
    }
  }
  return { workingDays, closedDays, holidayTitles };
}

/** Minutes between the session start and the actual arrival, capped to the session length. */
export function lateMinutesFor(
  arrivalTime: string | null,
  slotOrStartTime: Pick<TimetableSlot, "startTime" | "endTime"> | string,
  legacyHours = 7,
): number {
  if (!arrivalTime) return 0;
  const arrival = timeToMinutes(arrivalTime);
  const startStr = typeof slotOrStartTime === "string" ? slotOrStartTime : slotOrStartTime.startTime;
  const start = timeToMinutes(startStr);
  if (arrival === null || start === null) return 0;
  const maxMinutes =
    typeof slotOrStartTime === "string"
      ? legacyHours * 60
      : slotMinutes(slotOrStartTime);
  return Math.min(Math.max(arrival - start, 0), maxMinutes);
}

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export interface ComputeMonthlyReportInput {
  month: string;
  formation?: { id: string; title: string };
  course?: {
    id: string;
    title: string;
    dailyHours?: number;
    defaultStartTime?: string;
    defaultEndTime?: string;
  };
  slots?: ReportSlot[];
  subjectTitles?: Record<string, string>;
  trainees: ReportTrainee[];
  attendances: ReportAttendance[];
  holidays: ReportHoliday[];
  sessionOverrides?: ReportSessionOverride[];
  includeFrenchPublicHolidays?: boolean;
  /** Sessions after this date are not counted as "unrecorded". Defaults to the whole month. */
  today?: string;
}

export function computeMonthlyReport(input: ComputeMonthlyReportInput): MonthlyReport {
  const formation = input.formation ?? input.course ?? { id: "unknown", title: "Formation" };
  const month = input.month;
  const holidays = input.holidays;
  const trainees = input.trainees;
  const attendances = input.attendances;

  const dailyHours = input.course?.dailyHours ?? 7;
  const defaultStartTime = input.course?.defaultStartTime ?? "09:00";
  const defaultEndTime =
    input.course?.dailyHours != null
      ? `${String(Number(defaultStartTime.slice(0, 2)) + dailyHours).padStart(2, "0")}:${defaultStartTime.slice(3, 5)}`
      : input.course?.defaultEndTime ?? "17:00";

  let slots = input.slots;
  if (!slots || slots.length === 0) {
    slots = ([1, 2, 3, 4, 5] as const).map((weekday) => ({
      id: `default_slot_${weekday}`,
      subjectId: "default_subject",
      weekday,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      validFrom: "1970-01-01",
      validTo: null,
    }));
  }

  const subjectTitles = input.subjectTitles ?? { default_subject: "Général" };
  const { workingDays, closedDays, holidayTitles } = workingDaysOfMonth(month, holidays, {
    includeFrenchPublicHolidays: input.includeFrenchPublicHolidays ?? true,
  });
  const today = input.today ?? monthBounds(month).end;
  const titleOf = (id: string) => subjectTitles[id] ?? "Matière supprimée";

  // Map session overrides for the month (cancellations, TP autonomie, replacements)
  const overrides = new Map<string, ReportSessionOverride>();
  if (input.sessionOverrides) {
    for (const o of input.sessionOverrides) {
      overrides.set(`${o.slotId}_${o.date}`, o);
    }
  }

  // Generate scheduled sessions on active working days
  const sessions = workingDays.flatMap((date) =>
    slots!
      .filter((slot) => isSlotActiveOn(slot, date))
      .map((slot) => {
        const override = overrides.get(`${slot.id}_${date}`);
        const isCancelled = override?.isCancelled === true;
        const isSelfStudyTP = override?.isSelfStudyTP === true;
        return {
          date,
          slot,
          minutes: slotMinutes(slot),
          isCancelled,
          cancellationReason: override?.cancellationReason ?? null,
          isSelfStudyTP,
        };
      }),
  );

  const theoreticalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalCancelledMinutes = sessions.filter((s) => s.isCancelled).reduce((sum, s) => sum + s.minutes, 0);
  const netTheoreticalMinutes = Math.max(0, theoreticalMinutes - totalCancelledMinutes);

  const subjectTheory = new Map<string, number>();
  for (const s of sessions) {
    subjectTheory.set(s.slot.subjectId, (subjectTheory.get(s.slot.subjectId) ?? 0) + s.minutes);
  }

  const records = new Map<string, ReportAttendance>();
  for (const a of attendances) {
    if (a.slotId) {
      records.set(`${a.slotId}|${a.traineeId}|${a.date}`, a);
    }
    // Also index without slotId for legacy tests or single-session days
    records.set(`*|${a.traineeId}|${a.date}`, a);
  }

  const subjectAbsence = new Map<string, number>();

  const rows: TraineeMonthlyHours[] = trainees.map((trainee) => {
    let lateCount = 0;
    let lateMinutes = 0;
    let absentSessions = 0;
    let excusedSessions = 0;
    let presentDays = 0;
    let absentMinutes = 0;
    let excusedMinutes = 0;
    let unrecordedSessions = 0;
    let exemptedMinutes = 0;
    const absenceBySubject = new Map<string, number>();
    const excuseReasonsSummary: Record<string, { count: number; hours: number }> = {};
    const sessionsList: TraineeSessionRecord[] = [];

    for (const { date, slot, minutes, isCancelled, cancellationReason, isSelfStudyTP } of sessions) {
      const subjectTitle = titleOf(slot.subjectId);

      // 1. Session administratively cancelled (e.g. trainer absent without replacement)
      if (isCancelled) {
        exemptedMinutes += minutes;
        sessionsList.push({
          date,
          slotId: slot.id,
          subjectId: slot.subjectId,
          subjectTitle,
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMinutes: minutes,
          status: "cancelled",
          arrivalTime: null,
          lateMinutes: 0,
          excuseReason: null,
          isCancelled: true,
          cancellationReason,
          isSelfStudyTP: false,
        });
        continue;
      }

      // 2. Normal scheduled session or supervised self-study TP
      const record = records.get(`${slot.id}|${trainee.id}|${date}`) ?? records.get(`*|${trainee.id}|${date}`);
      let missed = 0;
      let sessionStatus: TraineeSessionRecord["status"] = "unrecorded";
      let sessionLateMinutes = 0;
      let sessionExcuseReason: string | null = null;

      if (!record) {
        if (date <= today) unrecordedSessions++;
        sessionStatus = "unrecorded";
      } else if (record.status === "present") {
        presentDays++;
        sessionStatus = "present";
      } else if (record.status === "absent") {
        absentSessions++;
        absentMinutes += minutes;
        missed = minutes;
        sessionStatus = "absent";
      } else if (record.status === "excused") {
        excusedSessions++;
        excusedMinutes += minutes;
        missed = minutes;
        sessionStatus = "excused";
        sessionExcuseReason = record.excuseReason || "Absence justifiée";
        const reasonKey = sessionExcuseReason;
        if (!excuseReasonsSummary[reasonKey]) {
          excuseReasonsSummary[reasonKey] = { count: 0, hours: 0 };
        }
        excuseReasonsSummary[reasonKey].count += 1;
        excuseReasonsSummary[reasonKey].hours = hours(
          Math.round((excuseReasonsSummary[reasonKey].hours * 60 + minutes)),
        );
      } else if (record.status === "late") {
        lateCount++;
        missed = lateMinutesFor(record.arrivalTime, slot);
        lateMinutes += missed;
        sessionLateMinutes = missed;
        sessionStatus = "late";
      }

      sessionsList.push({
        date,
        slotId: slot.id,
        subjectId: slot.subjectId,
        subjectTitle,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: minutes,
        status: sessionStatus,
        arrivalTime: record?.arrivalTime ?? null,
        lateMinutes: sessionLateMinutes,
        excuseReason: sessionExcuseReason,
        isCancelled: false,
        cancellationReason: null,
        isSelfStudyTP,
      });

      if (missed) absenceBySubject.set(slot.subjectId, (absenceBySubject.get(slot.subjectId) ?? 0) + missed);
    }

    for (const [subjectId, minutes] of absenceBySubject) {
      subjectAbsence.set(subjectId, (subjectAbsence.get(subjectId) ?? 0) + minutes);
    }

    const totalAbsenceMinutes = absentMinutes + excusedMinutes + lateMinutes;
    const effectiveMinutes = Math.max(theoreticalMinutes - totalAbsenceMinutes - exemptedMinutes, 0);

    // ASP compliance fields
    const aspDeductibleMinutes = absentMinutes + lateMinutes;
    const aspDeductibleHours = hours(aspDeductibleMinutes);
    const aspExcusedHours = hours(excusedMinutes);
    const aspRealizedHours = hours(effectiveMinutes);
    const traineeExemptedHours = hours(exemptedMinutes);
    const netTheoryHours = hours(netTheoreticalMinutes);

    let aspStatus: TraineeMonthlyHours["aspStatus"] = "compliant";
    if (unrecordedSessions > 0) {
      aspStatus = "warning_unrecorded";
    } else if (aspDeductibleHours > 0) {
      aspStatus = "has_deductions";
    }

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
      attendanceRate: netTheoreticalMinutes > 0 ? effectiveMinutes / netTheoreticalMinutes : 1,
      bySubject: [...subjectTheory].map(([subjectId, minutes]) => ({
        subjectId,
        title: titleOf(subjectId),
        theoreticalHours: hours(minutes),
        absenceHours: hours(absenceBySubject.get(subjectId) ?? 0),
      })),

      // ASP specific fields
      aspDeductibleHours,
      aspExcusedHours,
      aspRealizedHours,
      exemptedHours: traineeExemptedHours,
      netTheoreticalHours: netTheoryHours,
      aspStatus,
      excuseReasonsSummary,
      sessionsList,

      // Backwards compatibility
      presentDays,
      absentDays: absentSessions,
      excusedDays: excusedSessions,
      unrecordedDays: unrecordedSessions,
    };
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));

  const sum = (pick: (r: TraineeMonthlyHours) => number) =>
    Math.round(rows.reduce((acc, r) => acc + pick(r), 0) * 100) / 100;

  return {
    month,
    formationId: formation.id,
    formationTitle: formation.title,
    courseTitle: formation.title,
    dailyHours,
    defaultStartTime,
    defaultEndTime,
    workingDays,
    closedDays,
    holidayTitles,
    sessionCount: sessions.length,
    theoreticalHours: hours(theoreticalMinutes),
    exemptedHours: hours(totalCancelledMinutes),
    netTheoreticalHours: hours(netTheoreticalMinutes),
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
      exemptedHours: sum((r) => r.exemptedHours),
      netTheoreticalHours: sum((r) => r.netTheoreticalHours),
      aspDeductibleHours: sum((r) => r.aspDeductibleHours),
    },
    aspTotals: {
      totalDeductibleHours: sum((r) => r.aspDeductibleHours),
      totalRealizedHours: sum((r) => r.aspRealizedHours),
      totalExcusedHours: sum((r) => r.aspExcusedHours),
      totalExemptedHours: sum((r) => r.exemptedHours),
      traineesWithDeductionsCount: rows.filter((r) => r.aspDeductibleHours > 0).length,
      unrecordedSessionsCount: rows.reduce((acc, r) => acc + r.unrecordedSessions, 0),
    },
  };
}
