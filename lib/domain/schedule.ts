// Weekly timetable rules: which sessions take place on a given day,
// and which slots conflict with each other.

import { isWeekend, parseIsoDate, timeToMinutes } from "@/lib/core/dates";
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
  a.startTime.localeCompare(b.startTime);

/** Sessions held on a day: none on weekends and closure days. */
export function sessionsOn<T extends SlotTiming>(slots: T[], iso: string, closedDays: Set<string>): T[] {
  if (isWeekend(iso) || closedDays.has(iso)) return [];
  return slots.filter((s) => isSlotActiveOn(s, iso)).sort(byStartTime);
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
