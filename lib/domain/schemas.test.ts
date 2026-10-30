import { describe, expect, it } from "vitest";
import {
  AttendanceEntrySchema,
  FormationInputSchema,
  HolidayInputSchema,
  MonthlyReportPayloadSchema,
  SlotInputSchema,
} from "./schemas";

describe("schemas validation", () => {
  it("validates valid AttendanceEntry", () => {
    const valid = {
      trainee: { id: "u1", fullName: "Alice Dupont" },
      status: "late",
      arrivalTime: "09:15",
    };
    expect(AttendanceEntrySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid AttendanceEntry with bad time", () => {
    const invalid = {
      trainee: { id: "u1", fullName: "Alice Dupont" },
      status: "late",
      arrivalTime: "25:99",
    };
    expect(AttendanceEntrySchema.safeParse(invalid).success).toBe(false);
  });

  it("validates SlotInputSchema and enforces start < end", () => {
    const valid = {
      formationId: "f1",
      subjectId: "s1",
      trainerId: "t1",
      weekday: 2,
      startTime: "09:00",
      endTime: "10:30",
      room: "Salle 12",
      validFrom: "2026-09-01",
      validTo: "2027-06-30",
    };
    expect(SlotInputSchema.safeParse(valid).success).toBe(true);

    const invertedTimes = { ...valid, startTime: "11:00", endTime: "09:00" };
    expect(SlotInputSchema.safeParse(invertedTimes).success).toBe(false);

    const invertedDates = { ...valid, validFrom: "2027-01-01", validTo: "2026-01-01" };
    expect(SlotInputSchema.safeParse(invertedDates).success).toBe(false);
  });

  it("validates FormationInputSchema", () => {
    const valid = {
      title: "Technicien informatique",
      category: "professional",
      duration: "10 mois",
    };
    const res = FormationInputSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.active).toBe(true);
      expect(res.data.traineeIds).toEqual([]);
    }
  });

  it("validates HolidayInputSchema and rejects endDate < startDate", () => {
    const valid = {
      title: "Vacances de Noël",
      startDate: "2026-12-19",
      endDate: "2027-01-03",
      type: "vacation",
    };
    expect(HolidayInputSchema.safeParse(valid).success).toBe(true);

    const invalid = { ...valid, startDate: "2027-01-03", endDate: "2026-12-19" };
    expect(HolidayInputSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates MonthlyReportPayloadSchema", () => {
    const validPayload = {
      report: {
        month: "2026-11",
        formationTitle: "Kinésithérapie",
        theoreticalHours: 140,
        workingDays: ["2026-11-02", "2026-11-03"],
        closedDays: ["2026-11-11"],
        totals: {
          theoreticalHours: 140,
          absentHours: 7,
          excusedHours: 0,
          lateMinutes: 15,
          totalAbsenceHours: 7.25,
          effectivePresenceHours: 132.75,
        },
        trainees: [
          {
            fullName: "Pierre Durand",
            theoreticalHours: 140,
            effectivePresenceHours: 132.75,
            totalAbsenceHours: 7.25,
            lateMinutes: 15,
          },
        ],
      },
    };
    expect(MonthlyReportPayloadSchema.safeParse(validPayload).success).toBe(true);
  });
});
