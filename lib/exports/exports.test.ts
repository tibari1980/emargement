import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { computeMonthlyReport } from "@/lib/domain/hoursCalculator";
import { buildExcelReport } from "./excel";
import { buildPdfReport } from "./pdf";
import { buildTimetableExcel, buildTimetablePdf, timetableExportFileName } from "./timetableExport";

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

    // Verify ASP sheet exists and has proper headers
    const aspSheet = workbook.getWorksheet("Bordereau_ASP_Rémunération")!;
    expect(aspSheet).toBeDefined();
    const aspNames = aspSheet.getColumn(1).values.map(String);
    expect(aspNames).toContain(report.trainees[0].fullName);
  });

  it("builds a weekly timetable PDF and Excel workbook by formation and by trainer", async () => {
    const samplePayload = {
      mode: "formation" as const,
      targetId: "form_adapt",
      targetTitle: "Adaptation aux outils et à l'autonomie (1 an)",
      slots: [
        {
          id: "s1",
          weekday: 1 as const,
          startTime: "09:00",
          endTime: "12:30",
          durationMinutes: 210,
          subjectTitle: "Braille",
          formationTitle: "Adaptation aux outils et à l'autonomie (1 an)",
          trainerName: "Nadia Mansouri",
          room: "Salle Braille",
          validFrom: "2026-09-01",
          validTo: null,
        },
        {
          id: "s2",
          weekday: 2 as const,
          startTime: "13:30",
          endTime: "17:00",
          durationMinutes: 210,
          subjectTitle: "Outils adaptés",
          formationTitle: "Adaptation aux outils et à l'autonomie (1 an)",
          trainerName: "Karim Haddad",
          room: "Plateau Pédagogique",
          validFrom: "2026-09-01",
          validTo: null,
        },
      ],
    };

    const pdfBytes = await buildTimetablePdf(samplePayload);
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("Adaptation aux outils");

    const xlsxBuffer = await buildTimetableExcel(samplePayload);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBuffer as unknown as ArrayBuffer);
    const mainSheet = wb.getWorksheet("Planning_Hebdomadaire")!;
    expect(mainSheet).toBeDefined();
    const summarySheet = wb.getWorksheet("Synthese_Hebdomadaire")!;
    expect(summarySheet).toBeDefined();

    const fileName = timetableExportFileName(samplePayload, "pdf");
    expect(fileName).toContain("emploi-du-temps-formation-adaptation");
  });
});
