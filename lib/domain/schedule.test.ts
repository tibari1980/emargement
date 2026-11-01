import { describe, expect, it } from "vitest";
import {
  findConflicts,
  getSessionTemporalStatus,
  isSlotActiveOn,
  nextWorkingDay,
  previousWorkingDay,
  sessionsOn,
  slotMinutes,
  slotsOverlap,
  weekdayOf,
} from "./schedule";
import type { TimetableSlot } from "./types";

describe("schedule: slotMinutes", () => {
  it("computes duration in minutes correctly", () => {
    expect(slotMinutes({ startTime: "09:00", endTime: "12:30" })).toBe(210);
    expect(slotMinutes({ startTime: "13:30", endTime: "17:00" })).toBe(210);
  });

  it("handles zero or invalid gracefully", () => {
    expect(slotMinutes({ startTime: "10:00", endTime: "10:00" })).toBe(0);
    expect(slotMinutes({ startTime: "12:00", endTime: "10:00" })).toBe(0);
  });
});

describe("schedule: weekdayOf & isSlotActiveOn", () => {
  it("identifies weekdays (Monday = 1, Friday = 5)", () => {
    // 2026-11-02 is Monday (1)
    expect(weekdayOf("2026-11-02")).toBe(1);
    // 2026-11-06 is Friday (5)
    expect(weekdayOf("2026-11-06")).toBe(5);
    // 2026-11-07 is Saturday -> null
    expect(weekdayOf("2026-11-07")).toBeNull();
  });

  it("validates slot activity on dates within validity period", () => {
    const slot = {
      weekday: 1 as const,
      startTime: "09:00",
      endTime: "12:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };

    // Valid Monday in period
    expect(isSlotActiveOn(slot, "2026-11-02")).toBe(true);
    // Tuesday -> false
    expect(isSlotActiveOn(slot, "2026-11-03")).toBe(false);
    // Monday outside validity period
    expect(isSlotActiveOn(slot, "2026-08-24")).toBe(false);
  });
});

describe("schedule: sessionsOn & closed days", () => {
  it("filters sessions on weekends and closed days", () => {
    const slot = {
      weekday: 1 as const,
      startTime: "09:00",
      endTime: "12:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };

    const closed = new Set(["2026-11-02"]); // 2026-11-02 is closed
    expect(sessionsOn([slot], "2026-11-02", closed)).toHaveLength(0);

    const normal = new Set<string>();
    expect(sessionsOn([slot], "2026-11-02", normal)).toHaveLength(1);
    // Weekend (Saturday)
    expect(sessionsOn([slot], "2026-11-07", normal)).toHaveLength(0);
  });
});

describe("schedule: conflicts detection", () => {
  const existing: TimetableSlot[] = [
    {
      id: "s1",
      formationId: "f1",
      subjectId: "sub1",
      trainerId: "tr1",
      room: "Salle 101",
      weekday: 1,
      startTime: "09:00",
      endTime: "12:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    },
  ];

  it("detects conflict when same formation has overlapping slot", () => {
    const candidate = {
      formationId: "f1",
      trainerId: "tr2", // Different trainer
      weekday: 1 as const,
      startTime: "10:00",
      endTime: "13:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };

    const conflicts = findConflicts(candidate, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("formation");
  });

  it("detects conflict when same trainer is booked elsewhere", () => {
    const candidate = {
      formationId: "f2", // Different formation
      trainerId: "tr1", // Same trainer
      weekday: 1 as const,
      startTime: "11:00",
      endTime: "14:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };

    const conflicts = findConflicts(candidate, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("trainer");
  });

  it("permits non-overlapping slots", () => {
    const candidate = {
      formationId: "f1",
      trainerId: "tr1",
      weekday: 1 as const,
      startTime: "13:30",
      endTime: "17:00",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };

    expect(findConflicts(candidate, existing)).toHaveLength(0);
  });
});

describe("schedule: getSessionTemporalStatus (anti-fraud & timing enforcement)", () => {
  const slot = {
    startTime: "09:00",
    endTime: "12:00",
  };

  it("locks future dates for ALL profiles (trainers, secretaries, pedagogical leads, and admins)", () => {
    const res = getSessionTemporalStatus(slot, "2026-11-05", "10:00", "2026-11-01");
    expect(res.status).toBe("future");
    expect(res.isUnlockedForTrainer).toBe(false);
    expect(res.isUnlockedForStaff).toBe(false);
    expect(res.message).toContain("Émargement verrouillé");
  });

  it("locks past dates for trainers while allowing regularization for staff", () => {
    const res = getSessionTemporalStatus(slot, "2026-10-25", "10:00", "2026-11-01");
    expect(res.status).toBe("past");
    expect(res.isUnlockedForTrainer).toBe(false);
    expect(res.isUnlockedForStaff).toBe(true);
    expect(res.message).toContain("Séance passée");
  });

  it("locks today before start time for ALL profiles (e.g. at 08:30 for a 09:00 slot)", () => {
    const res = getSessionTemporalStatus(slot, "2026-11-01", "08:30", "2026-11-01");
    expect(res.status).toBe("future");
    expect(res.isUnlockedForTrainer).toBe(false);
    expect(res.isUnlockedForStaff).toBe(false);
    expect(res.message).toContain("commence à 09:00");
  });

  it("unlocks today during the slot for trainers and staff (e.g. at 10:15 for a 09:00-12:00 slot)", () => {
    const res = getSessionTemporalStatus(slot, "2026-11-01", "10:15", "2026-11-01");
    expect(res.status).toBe("current");
    expect(res.isUnlockedForTrainer).toBe(true);
    expect(res.isUnlockedForStaff).toBe(true);
    expect(res.message).toContain("Séance en cours");
  });

  it("allows finalization grace period right after end time (e.g. 12:10 with 15min grace)", () => {
    const res = getSessionTemporalStatus(slot, "2026-11-01", "12:10", "2026-11-01", 15);
    expect(res.status).toBe("current");
    expect(res.isUnlockedForTrainer).toBe(true);
    expect(res.isUnlockedForStaff).toBe(true);
    expect(res.message).toContain("Période de finalisation");
  });

  it("locks today after slot and grace period for trainers while allowing regularization for staff", () => {
    const res = getSessionTemporalStatus(slot, "2026-11-01", "12:30", "2026-11-01", 15);
    expect(res.status).toBe("ended_today");
    expect(res.isUnlockedForTrainer).toBe(false);
    expect(res.isUnlockedForStaff).toBe(true);
    expect(res.message).toContain("Séance clôturée");
  });
});

describe("schedule: nextWorkingDay & previousWorkingDay", () => {
  it("skips weekends and closed days when jumping to previous/next working day", () => {
    const closed = new Set(["2026-11-01", "2026-11-11"]);
    // From Saturday 2026-10-31 -> previous working day is Friday 2026-10-30, next is Monday 2026-11-02
    expect(previousWorkingDay("2026-10-31", closed)).toBe("2026-10-30");
    expect(nextWorkingDay("2026-10-31", closed)).toBe("2026-11-02");

    // From Wednesday 2026-11-11 (Armistice public holiday) -> prev is 2026-11-10, next is 2026-11-12
    expect(previousWorkingDay("2026-11-11", closed)).toBe("2026-11-10");
    expect(nextWorkingDay("2026-11-11", closed)).toBe("2026-11-12");
  });
});
