import { describe, expect, it } from "vitest";
import {
  findConflicts,
  isSlotActiveOn,
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
