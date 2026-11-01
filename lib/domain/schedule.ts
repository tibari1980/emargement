// Weekly timetable rules: which sessions take place on a given day,
// and which slots conflict with each other.

import { addDays, isWeekend, nowTime, parseIsoDate, timeToMinutes, todayIso } from "@/lib/core/dates";
import type { TimetableSlot, Weekday } from "./types";

export type SlotTiming = Pick<TimetableSlot, "weekday" | "startTime" | "endTime" | "validFrom" | "validTo">;

export function slotMinutes(slot: Pick<TimetableSlot, "startTime" | "endTime">): number {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return start === null || end === null ? 0 : Math.max(end - start, 0);
}

export function weekdayOf(iso: string): Weekday | null {
  const day = parseIsoDate(iso).getDay();
  return day >= 1 && day <= 5 ? (day as Weekday) : null;
}

export function isSlotActiveOn(slot: SlotTiming, iso: string): boolean {
  return (
    weekdayOf(iso) === slot.weekday &&
    slot.validFrom <= iso &&
    (!slot.validTo || iso <= slot.validTo)
  );
}

export const byStartTime = (a: Pick<TimetableSlot, "startTime">, b: Pick<TimetableSlot, "startTime">) =>
  (a?.startTime ?? "").localeCompare(b?.startTime ?? "");

/** Sessions held on a day: none on weekends and closure days. */
export function sessionsOn<T extends SlotTiming>(slots: T[], iso: string, closedDays: Set<string>): T[] {
  if (isWeekend(iso) || closedDays.has(iso)) return [];
  return slots.filter((s) => isSlotActiveOn(s, iso)).sort(byStartTime);
}

/** Next working day (Monday–Friday, excluding closedDays) strictly after `fromIso`. */
export function nextWorkingDay(fromIso: string, closedDays: Set<string>): string {
  let cursor = addDays(fromIso, 1);
  for (let i = 0; i < 366; i++) {
    if (!isWeekend(cursor) && !closedDays.has(cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/** Previous working day (Monday–Friday, excluding closedDays) strictly before `fromIso`. */
export function previousWorkingDay(fromIso: string, closedDays: Set<string>): string {
  let cursor = addDays(fromIso, -1);
  for (let i = 0; i < 366; i++) {
    if (!isWeekend(cursor) && !closedDays.has(cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

function periodsOverlap(a: SlotTiming, b: SlotTiming): boolean {
  const aEnd = a.validTo ?? "9999-12-31";
  const bEnd = b.validTo ?? "9999-12-31";
  return a.validFrom <= bEnd && b.validFrom <= aEnd;
}

function timesOverlap(a: SlotTiming, b: SlotTiming): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function slotsOverlap(a: SlotTiming, b: SlotTiming): boolean {
  return a.weekday === b.weekday && timesOverlap(a, b) && periodsOverlap(a, b);
}

export interface SlotConflict {
  kind: "formation" | "trainer";
  slot: TimetableSlot;
}

export type SessionTemporalStatus = "future" | "current" | "ended_today" | "past";

export interface SessionTemporalInfo {
  status: SessionTemporalStatus;
  /** Whether a trainer can record attendance right now (only during active session + 15 min grace). */
  isUnlockedForTrainer: boolean;
  /** Whether supervision staff (admin / pedagogical_lead / secretary) can record or regularize attendance right now (never on future sessions). */
  isUnlockedForStaff: boolean;
  message: string;
}

/**
 * Determines the temporal status of a session relative to current time.
 * Enforces the core rule:
 * - NO ONE (trainer, secretary, pedagogical lead, or admin) can take attendance BEFORE the session starts ("future").
 * - A trainer takes attendance DURING the session (with a 15-minute grace period to finalize).
 * - AFTER the session/grace period or on past dates, the session is locked for trainers
 *   and can only be modified/regularized by the Secretary, Pedagogical Lead, or Admin.
 */
export function getSessionTemporalStatus(
  slot: Pick<TimetableSlot, "startTime" | "endTime">,
  sessionDate: string,
  nowTimeStr?: string,
  nowDateStr?: string,
  graceMinutes: number = 15,
): SessionTemporalInfo {
  const today = nowDateStr ?? todayIso();
  const currentClock = nowTimeStr ?? nowTime();

  if (sessionDate > today) {
    return {
      status: "future",
      isUnlockedForTrainer: false,
      isUnlockedForStaff: false,
      message: `Émargement verrouillé (Séance à venir) — Cette séance est programmée le ${sessionDate} de ${slot.startTime} à ${slot.endTime}. L'émargement ne peut pas être effectué avant le début de la séance.`,
    };
  }

  if (sessionDate < today) {
    return {
      status: "past",
      isUnlockedForTrainer: false,
      isUnlockedForStaff: true,
      message: `Séance passée — L'émargement est clôturé pour le formateur. Seuls le secrétariat et la direction peuvent régulariser cette feuille.`,
    };
  }

  // sessionDate === today
  if (currentClock < slot.startTime) {
    return {
      status: "future",
      isUnlockedForTrainer: false,
      isUnlockedForStaff: false,
      message: `Émargement non ouvert — La séance commence à ${slot.startTime} (actuellement ${currentClock}). Les boutons d'émargement s'activeront au début du cours.`,
    };
  }

  // Calculate end time with grace period
  const endMinutes = timeToMinutes(slot.endTime);
  const currentMinutes = timeToMinutes(currentClock);

  if (endMinutes !== null && currentMinutes !== null) {
    if (currentMinutes <= endMinutes + graceMinutes) {
      const isGrace = currentMinutes > endMinutes;
      return {
        status: "current",
        isUnlockedForTrainer: true,
        isUnlockedForStaff: true,
        message: isGrace
          ? `Séance terminée à ${slot.endTime} — Période de finalisation de l'émargement en cours (${graceMinutes} min de grâce).`
          : `Séance en cours — Émargement ouvert jusqu'à ${slot.endTime}.`,
      };
    }
  } else if (currentClock <= slot.endTime) {
    return {
      status: "current",
      isUnlockedForTrainer: true,
      isUnlockedForStaff: true,
      message: `Séance en cours — Émargement ouvert jusqu'à ${slot.endTime}.`,
    };
  }

  // Current time > end time + grace
  return {
    status: "ended_today",
    isUnlockedForTrainer: false,
    isUnlockedForStaff: true,
    message: `Séance clôturée — La séance est terminée depuis ${slot.endTime}. L'émargement est en lecture seule pour le formateur. Contactez le secrétariat pour toute régularisation.`,
  };
}

/**
 * Conflicts of a candidate slot with existing ones: another session of the
 * same formation at the same time, or the trainer already teaching elsewhere.
 */
export function findConflicts(
  candidate: SlotTiming & Pick<TimetableSlot, "formationId" | "trainerId"> & { id?: string },
  existing: TimetableSlot[],
): SlotConflict[] {
  const conflicts: SlotConflict[] = [];
  for (const slot of existing) {
    if (slot.id === candidate.id || !slotsOverlap(candidate, slot)) continue;
    if (slot.formationId === candidate.formationId) conflicts.push({ kind: "formation", slot });
    else if (slot.trainerId === candidate.trainerId) conflicts.push({ kind: "trainer", slot });
  }
  return conflicts;
}
