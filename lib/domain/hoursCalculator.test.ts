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
  it("counts Monday to Friday only", () => {
    // November 2026: 30 days, starts on a Sunday → 21 weekdays.
    expect(workingDaysOfMonth("2026-11", []).workingDays).toHaveLength(21);
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
});
