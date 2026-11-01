import { describe, expect, it } from "vitest";
import {
  computeMonthlyReport,
  lateMinutesFor,
  workingDaysOfMonth,
  type ReportAttendance,
} from "./hoursCalculator";

const course = {
  id: "c1",
  title: "Technicien informatique de proximité",
  dailyHours: 7,
  defaultStartTime: "09:00",
  defaultEndTime: "17:00",
};
const trainees = [
  { id: "t1", fullName: "Jean Dupont" },
  { id: "t2", fullName: "Amélie Martin" },
];

describe("workingDaysOfMonth", () => {
  it("counts Monday to Friday only when French holidays are disabled", () => {
    // November 2026: 30 days, starts on a Sunday → 21 calendar weekdays.
    expect(workingDaysOfMonth("2026-11", [], { includeFrenchPublicHolidays: false }).workingDays).toHaveLength(21);
  });

  it("automatically excludes French public holidays by default (Armistice 11 Nov)", () => {
    // November 2026 has 21 calendar weekdays, but 11 Nov (Armistice) is automatically closed → 20 working days.
    const res = workingDaysOfMonth("2026-11", []);
    expect(res.workingDays).toHaveLength(20);
    expect(res.closedDays).toContain("2026-11-11");
    expect(res.holidayTitles["2026-11-11"]).toBe("Armistice 1918");
  });

  it("excludes holidays and vacations falling on weekdays", () => {
    const { workingDays, closedDays } = workingDaysOfMonth("2026-11", [
      { startDate: "2026-11-01", endDate: "2026-11-01" }, // Sunday: no effect
      { startDate: "2026-11-11", endDate: "2026-11-11" }, // Wednesday
      { startDate: "2026-11-20", endDate: "2026-11-24" }, // Fri → Tue: 3 weekdays
    ]);
    expect(workingDays).toHaveLength(17);
    expect(closedDays).toEqual(["2026-11-11", "2026-11-20", "2026-11-23", "2026-11-24"]);
  });

  it("handles closures spanning two months", () => {
    const { closedDays } = workingDaysOfMonth("2027-01", [
      { startDate: "2026-12-19", endDate: "2027-01-03" },
    ]);
    // Friday 1 January 2027 is the only weekday of January inside the vacation.
    expect(closedDays).toEqual(["2027-01-01"]);
  });
});

describe("lateMinutesFor", () => {
  it("measures the delay from the scheduled start", () => {
    expect(lateMinutesFor("09:45", "09:00", 7)).toBe(45);
  });
  it("never returns negative or more than a day", () => {
    expect(lateMinutesFor("08:50", "09:00", 7)).toBe(0);
    expect(lateMinutesFor("23:00", "09:00", 7)).toBe(420);
    expect(lateMinutesFor(null, "09:00", 7)).toBe(0);
  });
});

describe("computeMonthlyReport", () => {
  const attendances: ReportAttendance[] = [
    { traineeId: "t1", date: "2026-11-02", status: "present", arrivalTime: null },
    { traineeId: "t1", date: "2026-11-03", status: "absent", arrivalTime: null },
    { traineeId: "t1", date: "2026-11-04", status: "late", arrivalTime: "09:30" },
    { traineeId: "t1", date: "2026-11-05", status: "late", arrivalTime: "10:15" },
    { traineeId: "t1", date: "2026-11-06", status: "excused", arrivalTime: null },
    // Ignored: weekend and closed day.
    { traineeId: "t1", date: "2026-11-07", status: "absent", arrivalTime: null },
    { traineeId: "t1", date: "2026-11-11", status: "absent", arrivalTime: null },
  ];

  const report = computeMonthlyReport({
    month: "2026-11",
    course,
    trainees,
    attendances,
    holidays: [{ startDate: "2026-11-11", endDate: "2026-11-11" }],
  });

  it("applies the PRD formula", () => {
    // 20 working days × 7 h
    expect(report.theoreticalHours).toBe(140);
    const jean = report.trainees.find((t) => t.traineeId === "t1")!;
    expect(jean.absentHours).toBe(7);
    expect(jean.excusedHours).toBe(7);
    expect(jean.lateCount).toBe(2);
    expect(jean.lateMinutes).toBe(30 + 75);
    // 7 + 7 + 105/60 = 15.75
    expect(jean.totalAbsenceHours).toBe(15.75);
    expect(jean.effectivePresenceHours).toBe(124.25);
    expect(jean.presentDays).toBe(1);
    expect(jean.unrecordedDays).toBe(15);
  });

  it("reports trainees without records as unrecorded, sorted by name", () => {
    expect(report.trainees.map((t) => t.fullName)).toEqual(["Amélie Martin", "Jean Dupont"]);
    const amelie = report.trainees[0];
    expect(amelie.unrecordedDays).toBe(20);
    expect(amelie.effectivePresenceHours).toBe(140);
  });

  it("does not count future days as unrecorded", () => {
    const partial = computeMonthlyReport({
      month: "2026-11",
      course,
      trainees,
      attendances: [],
      holidays: [],
      today: "2026-11-04",
    });
    expect(partial.trainees[0].unrecordedDays).toBe(3);
  });

  it("sums totals", () => {
    expect(report.totals.theoreticalHours).toBe(280);
    expect(report.totals.totalAbsenceHours).toBe(15.75);
  });

  it("calculates ASP specific hours with exact deductible breakdown", () => {
    const jean = report.trainees.find((t) => t.traineeId === "t1")!;
    // Jean has:
    // - 1 unexcused absence of 7h
    // - 2 lates: 30 min + 75 min = 105 min = 1.75h
    // -> ASP Deductible Hours = 7 + 1.75 = 8.75h
    expect(jean.aspDeductibleHours).toBe(8.75);
    // - 1 excused absence of 7h
    expect(jean.aspExcusedHours).toBe(7);
    // - Realized presence = 124.25h
    expect(jean.aspRealizedHours).toBe(124.25);
    expect(jean.sessionsList.length).toBe(20);
  });

  it("handles cancelled sessions via sessionOverrides without penalizing trainees", () => {
    // Session on Monday 2026-11-02 cancelled for trainer absence
    const cancelledReport = computeMonthlyReport({
      month: "2026-11",
      course,
      trainees: [{ id: "t1", fullName: "Jean Dupont" }],
      attendances: [],
      holidays: [{ startDate: "2026-11-11", endDate: "2026-11-11" }],
      sessionOverrides: [
        {
          slotId: "default_slot_1",
          date: "2026-11-02",
          isCancelled: true,
          cancellationReason: "trainer_absent",
          isSelfStudyTP: false,
        },
      ],
      today: "2026-11-02",
    });

    const jean = cancelledReport.trainees[0];
    // The cancelled session is exempted: 7h
    expect(jean.exemptedHours).toBe(7);
    // Should NOT be marked as an unrecorded session for 2026-11-02!
    expect(jean.unrecordedSessions).toBe(0);
    // ASP deductible hours must be strictly 0!
    expect(jean.aspDeductibleHours).toBe(0);
    expect(cancelledReport.exemptedHours).toBe(7);
    expect(cancelledReport.netTheoreticalHours).toBe(133); // 140 - 7
  });

  it("isolates custom slots on multi-session days without bleeding across slots", () => {
    const customSlots = [
      {
        id: "slot_morning",
        subjectId: "subj_braille",
        weekday: 1 as const,
        startTime: "09:00",
        endTime: "12:00", // 3h
        validFrom: "2026-09-01",
        validTo: null,
      },
      {
        id: "slot_afternoon",
        subjectId: "subj_bureautique",
        weekday: 1 as const,
        startTime: "13:30",
        endTime: "16:30", // 3h
        validFrom: "2026-09-01",
        validTo: null,
      },
    ];

    const multiSlotReport = computeMonthlyReport({
      month: "2026-11",
      formation: { id: "f_adapt", title: "Adaptation" },
      slots: customSlots,
      subjectTitles: { subj_braille: "Braille", subj_bureautique: "Bureautique" },
      trainees: [{ id: "t1", fullName: "Jean Dupont" }],
      attendances: [
        // Monday 2026-11-02: morning slot absent (3h), afternoon slot not yet recorded
        { traineeId: "t1", slotId: "slot_morning", date: "2026-11-02", status: "absent", arrivalTime: null },
        // Monday 2026-11-09: day-level medical justification ("general") excuses both morning and afternoon (6h)
        {
          traineeId: "t1",
          slotId: "general",
          date: "2026-11-09",
          status: "excused",
          arrivalTime: null,
          excuseReason: "Arrêt maladie",
        },
      ],
      holidays: [],
      today: "2026-11-09",
    });

    const jean = multiSlotReport.trainees[0];
    // Only slot_morning on 2026-11-02 is absent (3h), NOT slot_afternoon!
    expect(jean.absentHours).toBe(3);
    expect(jean.absentSessions).toBe(1);
    // Both slots on 2026-11-09 are excused via day-level justification (3h + 3h = 6h)
    expect(jean.excusedHours).toBe(6);
    expect(jean.excusedSessions).toBe(2);
    // slot_afternoon on 2026-11-02 remains unrecorded (1 session)
    expect(jean.unrecordedSessions).toBe(1);
  });
});
