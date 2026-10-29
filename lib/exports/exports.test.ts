import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { computeMonthlyReport } from "@/lib/hoursCalculator";
import { buildExcelReport } from "./excel";
import { buildPdfReport } from "./pdf";

const report = computeMonthlyReport({
  month: "2026-11",
  course: {
    id: "c1",
    title: "Chargé d'accueil et de gestion administrative",
    dailyHours: 7,
    defaultStartTime: "09:00",
    defaultEndTime: "17:00",
  },
  trainees: Array.from({ length: 40 }, (_, i) => ({
    id: `t${i}`,
    // Accents, a character outside WinAnsi (Ł) and a very long name.
    fullName: i === 0 ? "Łukasz Żółć-Hélène de la Fontaine-Saint-Exupéry Brontë" : `Stagiaire Numéro ${i}`,
  })),
  attendances: [
    { traineeId: "t0", date: "2026-11-03", status: "absent", arrivalTime: null },
    { traineeId: "t0", date: "2026-11-04", status: "late", arrivalTime: "09:45" },
  ],
  holidays: [{ startDate: "2026-11-11", endDate: "2026-11-11" }],
});

describe("exports", () => {
  it("builds a multi-page PDF", async () => {
    const bytes = await buildPdfReport(report);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toContain("Chargé d'accueil");
  });

  it("builds an Excel workbook with one row per trainee", async () => {
    const buffer = await buildExcelReport(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Récapitulatif")!;
    const names = sheet.getColumn(1).values.map(String);
    expect(names).toContain(report.trainees[0].fullName);
    const total = sheet.getRow(8 + report.trainees.length);
    expect(total.getCell(1).value).toBe("Total");
    expect(total.getCell(11).value).toBe(report.totals.totalAbsenceHours);
  });
});
