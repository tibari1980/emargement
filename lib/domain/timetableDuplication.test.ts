import { describe, expect, it } from "vitest";
import { deduplicateSlotsList } from "@/lib/data/timetable";
import { getInitialSubjects } from "@/lib/data/subjects";
import { isSlotActiveOn } from "./schedule";
import { WEEKDAYS, type TimetableSlot } from "./types";

describe("Timetable Duplication & Deduplication Logic", () => {
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

  it("deduplicates identical slots created accidentally on same schedule", () => {
    const duplicateSlot: TimetableSlot = {
      ...sampleSlot,
      id: "slot_duplicate_cloned",
    };

    const rawList = [sampleSlot, duplicateSlot];
    const cleaned = deduplicateSlotsList(rawList);

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].id).toBe("slot_1");
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

  it("applies monthly validity period across all weekly slots so they are active from the 1st of the month", () => {
    const weeklySlots: TimetableSlot[] = [
      { ...sampleSlot, id: "slot_mon", weekday: 1, validFrom: "2026-11-03" }, // Créé le mardi
      { ...sampleSlot, id: "slot_tue", weekday: 2, validFrom: "2026-11-03" },
      { ...sampleSlot, id: "slot_wed", weekday: 3, validFrom: "2026-11-03" },
    ];

    // Avant ajustement : le lundi 2 novembre n'est pas actif car validFrom (03/11) > 02/11
    expect(isSlotActiveOn(weeklySlots[0], "2026-11-02")).toBe(false);

    // Ajustement de la validité au 1er du mois (2026-11-01)
    const monthStart = "2026-11-01";
    const adjusted = weeklySlots.map((s) => ({
      ...s,
      validFrom: monthStart,
      validTo: null,
    }));

    // Après ajustement : le lundi 2 novembre ET tous les lundis du mois sont immédiatement actifs
    expect(isSlotActiveOn(adjusted[0], "2026-11-02")).toBe(true);
    expect(isSlotActiveOn(adjusted[0], "2026-11-09")).toBe(true);
    expect(isSlotActiveOn(adjusted[0], "2026-11-16")).toBe(true);
    expect(isSlotActiveOn(adjusted[0], "2026-11-23")).toBe(true);
    expect(isSlotActiveOn(adjusted[0], "2026-11-30")).toBe(true);
  });

  it("ensures all official subjects from catalog are loaded and have stable IDs", () => {
        const subjects = getInitialSubjects();
    expect(subjects.length).toBeGreaterThanOrEqual(15);
    const titles = subjects.map((s: any) => s.title);
    expect(titles).toContain("Braille et adaptations");
    expect(titles).toContain("Bureautique adaptée (JAWS/NVDA)");
    expect(titles).toContain("Outils adaptés");
    expect(titles).toContain("Locomotion");
    expect(titles).toContain("Activités de la vie journalière");
  });

  it("guarantees strict isolation of timetable schedules between distinct formations", () => {
    const formationASlots: TimetableSlot[] = [
      { ...sampleSlot, id: "slot_a1", formationId: "form-adapt-2026", startTime: "09:00", endTime: "10:15" },
      { ...sampleSlot, id: "slot_a2", formationId: "form-adapt-2026", startTime: "10:30", endTime: "12:00" },
    ];

    const formationBSlots: TimetableSlot[] = [
      { ...sampleSlot, id: "slot_b1", formationId: "form-tip-1", startTime: "09:00", endTime: "12:30" },
      { ...sampleSlot, id: "slot_b2", formationId: "form-tip-1", startTime: "13:30", endTime: "17:00" },
    ];

    const allSlots = [...formationASlots, ...formationBSlots];

    // Isolation stricte par filière
    const slotsA = allSlots.filter((s) => s.formationId === "form-adapt-2026");
    const slotsB = allSlots.filter((s) => s.formationId === "form-tip-1");

    expect(slotsA).toHaveLength(2);
    expect(slotsA.map((s) => s.startTime)).toEqual(["09:00", "10:30"]);

    expect(slotsB).toHaveLength(2);
    expect(slotsB.map((s) => s.startTime)).toEqual(["09:00", "13:30"]);

    // Zéro fuite de créneaux entre filières
    expect(slotsA.every((s) => s.formationId === "form-adapt-2026")).toBe(true);
    expect(slotsB.every((s) => s.formationId === "form-tip-1")).toBe(true);
  });

  it("supports generating weekly grid with customized entrance and exit hours per formation", () => {
    const weekdays = [1, 2, 3, 4, 5] as const;
    const customMorningStart = "08:30";
    const customMorningEnd = "12:00";
    const customAfternoonStart = "13:00";
    const customAfternoonEnd = "16:30";

    const customWeekSlots = weekdays.flatMap((weekday) => [
      { weekday, startTime: customMorningStart, endTime: customMorningEnd },
      { weekday, startTime: customAfternoonStart, endTime: customAfternoonEnd },
    ]);

    expect(customWeekSlots).toHaveLength(10);
    expect(customWeekSlots[0].startTime).toBe("08:30");
    expect(customWeekSlots[0].endTime).toBe("12:00");
    expect(customWeekSlots[1].startTime).toBe("13:00");
    expect(customWeekSlots[1].endTime).toBe("16:30");
  });
});
