import { describe, expect, it } from "vitest";
import { WEEKDAYS, type TimetableSlot } from "./types";

describe("Timetable Duplication Logic", () => {
  const sampleSlot: TimetableSlot = {
    id: "slot_1",
    formationId: "form_kin1",
    subjectId: "subj_anat",
    trainerId: "trainer_dupont",
    weekday: 1, // Lundi
    startTime: "09:00",
    endTime: "10:30",
    room: "Salle 102",
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
  };

  it("duplicates slot across selected target days", () => {
    const targetDays = [2, 4]; // Mardi, Jeudi
    const duplicated = targetDays.map((weekday) => ({
      ...sampleSlot,
      id: `slot_${weekday}`,
      weekday: weekday as any,
    }));

    expect(duplicated).toHaveLength(2);
    expect(duplicated[0].weekday).toBe(2);
    expect(duplicated[0].startTime).toBe("09:00");
    expect(duplicated[1].weekday).toBe(4);
    expect(duplicated[1].startTime).toBe("09:00");
  });

  it("duplicates whole week slots to target formation", () => {
    const weekSlots: TimetableSlot[] = [
      sampleSlot,
      { ...sampleSlot, id: "slot_2", weekday: 3, startTime: "13:30", endTime: "17:00" },
    ];

    const targetFormationId = "form_kin2";
    const cloned = weekSlots.map((s) => ({
      ...s,
      formationId: targetFormationId,
    }));

    expect(cloned).toHaveLength(2);
    expect(cloned.every((s) => s.formationId === "form_kin2")).toBe(true);
  });

  it("bounds duplicated week to a specific monthly date range", () => {
    const weekSlots: TimetableSlot[] = [sampleSlot];
    const targetMonthStart = "2026-12-01";
    const targetMonthEnd = "2026-12-31";

    const bounded = weekSlots.map((s) => ({
      ...s,
      validFrom: targetMonthStart,
      validTo: targetMonthEnd,
    }));

    expect(bounded[0].validFrom).toBe("2026-12-01");
    expect(bounded[0].validTo).toBe("2026-12-31");
  });

  it("generates 35h standard weekly grid structure correctly", () => {
    const weekdays = [1, 2, 3, 4, 5] as const;
    const generated = weekdays.flatMap((weekday) => [
      { weekday, startTime: "09:00", endTime: "12:30", duration: 3.5 },
      { weekday, startTime: "13:30", endTime: "17:00", duration: 3.5 },
    ]);

    expect(generated).toHaveLength(10);
    const totalWeeklyHours = generated.reduce((sum, s) => sum + s.duration, 0);
    expect(totalWeeklyHours).toBe(35); // 35h standard week
  });
});
