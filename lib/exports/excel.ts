import ExcelJS from "exceljs";
import { formatMonth, formatShortDate } from "@/lib/core/dates";
import type { MonthlyReport } from "@/lib/domain/hoursCalculator";

/** Monthly attendance workbook for HR / internal reporting. */
export async function buildExcelReport(report: MonthlyReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CFRP Valentin Haüy — Émargement";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Récapitulatif", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const title = report.formationTitle ?? report.courseTitle ?? "Formation";

  sheet.addRow(["CFRP Valentin Haüy — Relevé mensuel de présence"]).font = { bold: true, size: 14 };
  sheet.addRow(["Formation", title]);
  sheet.addRow(["Mois", formatMonth(report.month)]);
  if (report.defaultStartTime && report.defaultEndTime) {
    sheet.addRow([
      "Horaires",
      `${report.defaultStartTime} - ${report.defaultEndTime}${report.dailyHours ? ` (${report.dailyHours} h/jour)` : ""}`,
    ]);
  } else {
    sheet.addRow(["Séances", report.sessionCount ?? report.workingDays.length]);
  }
  sheet.addRow([
    "Jours ouvrés",
    report.workingDays.length,
    "Heures théoriques",
    report.theoreticalHours,
  ]);
  sheet.addRow([]);

  const header = sheet.addRow([
    "Stagiaire",
    "Heures théoriques",
    "Présence effective (h)",
    "Jours présents",
    "Retards (nombre)",
    "Retards (minutes)",
    "Absences non justifiées (jours)",
    "Absences non justifiées (h)",
    "Absences justifiées (jours)",
    "Absences justifiées (h)",
    "Total absences (h)",
    "Taux de présence",
    "Jours non saisis",
  ]);
  header.font = { bold: true };
  header.alignment = { wrapText: true, vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  for (const t of report.trainees) {
    sheet.addRow([
      t.fullName,
      t.theoreticalHours,
      t.effectivePresenceHours,
      t.presentDays ?? "",
      t.lateCount,
      t.lateMinutes,
      t.absentDays ?? t.absentSessions,
      t.absentHours,
      t.excusedDays ?? t.excusedSessions,
      t.excusedHours,
      t.totalAbsenceHours,
      t.attendanceRate,
      t.unrecordedDays ?? t.unrecordedSessions,
    ]);
  }

  const total = sheet.addRow([
    "Total",
    report.totals.theoreticalHours,
    report.totals.effectivePresenceHours,
    null,
    null,
    report.totals.lateMinutes,
    null,
    report.totals.absentHours,
    null,
    report.totals.excusedHours,
    report.totals.totalAbsenceHours,
  ]);
  total.font = { bold: true };

  sheet.getColumn(1).width = 32;
  for (let c = 2; c <= 13; c++) sheet.getColumn(c).width = 15;
  for (const c of [2, 3, 8, 10, 11]) sheet.getColumn(c).numFmt = "0.00";
  sheet.getColumn(12).numFmt = "0.0%";

  if (report.closedDays.length) {
    sheet.addRow([]);
    sheet.addRow([
      "Jours de fermeture exclus",
      report.closedDays.map(formatShortDate).join(", "),
    ]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
