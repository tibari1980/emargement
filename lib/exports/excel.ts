import ExcelJS from "exceljs";
import { formatHours, formatMonth, formatShortDate } from "@/lib/core/dates";
import type { MonthlyReport } from "@/lib/domain/hoursCalculator";
import { sanitizeForSpreadsheet } from "@/lib/security/sanitize";
import { getAvhLogoPngBuffer } from "./brandHeader";

/** Monthly attendance workbook for HR, internal reporting, and ASP teletransmission. */
export async function buildExcelReport(report: MonthlyReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CFRP Valentin Haüy — Émargement";
  workbook.created = new Date();

  const title = sanitizeForSpreadsheet(report.formationTitle ?? report.courseTitle ?? "Formation");

  /* =========================================================================
   * FEUILLE 1 : Récapitulatif Général d'Assiduité ASP
   * ========================================================================= */
  const sheet = workbook.addWorksheet("Récapitulatif", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

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
    "Heures dispensées (centre)",
    report.exemptedHours ?? 0,
    "Heures nettes exigibles",
    report.netTheoreticalHours ?? report.theoreticalHours,
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

  try {
    const logoId = workbook.addImage({
      buffer: getAvhLogoPngBuffer() as any,
      extension: "png",
    });
    sheet.addImage(logoId, {
      tl: { col: 11.1, row: 0.1 },
      ext: { width: 64, height: 64 },
    });
  } catch {}

  for (const t of report.trainees) {
    sheet.addRow([
      sanitizeForSpreadsheet(t.fullName),
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
      "Jours fériés légaux et fermetures exclus (0 heure comptée)",
      report.closedDays
        .map((d) => (report.holidayTitles?.[d] ? `${formatShortDate(d)} (${report.holidayTitles[d]})` : formatShortDate(d)))
        .join(", "),
    ]);
  }

  /* =========================================================================
   * FEUILLE 2 : Bordereau Déclaration ASP (Rémunération des Stagiaires - RSFP)
   * ========================================================================= */
  const aspSheet = workbook.addWorksheet("Bordereau_ASP_Rémunération", {
    views: [{ state: "frozen", ySplit: 8 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  aspSheet.addRow(["CFRP Valentin Haüy — Bordereau d'Assiduité pour Télétransmission ASP"]).font = {
    bold: true,
    size: 14,
    color: { argb: "FF0D2E5C" },
  };
  aspSheet.addRow(["Cadre Réglementaire", "Rémunération des Stagiaires de la Formation Professionnelle (RSFP) — ASP"]);
  aspSheet.addRow(["Formation", title]);
  aspSheet.addRow(["Mois de Déclaration", formatMonth(report.month)]);
  aspSheet.addRow([
    "Jours ouvrés réels",
    `${report.workingDays.length} jours (Samedi/Dimanche et 11 jours fériés légaux strictement exclus)`,
  ]);
  aspSheet.addRow([
    "Heures contractuelles nettes",
    `${formatHours(report.netTheoreticalHours ?? report.theoreticalHours)} par stagiaire`,
    "Heures dispensées organisme",
    `${formatHours(report.exemptedHours ?? 0)} (cours annulés non imputables aux stagiaires)`,
  ]);
  aspSheet.addRow([]);

  const aspHeader = aspSheet.addRow([
    "Stagiaire (Nom & Prénom)",
    "Identifiant Stagiaire",
    "Heures prévues (h)",
    "Heures réalisées (h)",
    "Abs. injustifiées (h)",
    "Retards (min)",
    "Retards (h)",
    "TOTAL À DÉDUIRE ASP (h)",
    "Abs. justifiées (h)",
    "Motifs justifiés déclarés",
    "Heures dispensées centre (h)",
    "Taux d'assiduité",
    "Statut Déclaration ASP",
  ]);
  aspHeader.font = { bold: true };
  aspHeader.alignment = { wrapText: true, vertical: "middle" };
  aspHeader.eachCell((cell, colNumber) => {
    // Highlight the ASP deduction column in alert orange/yellow
    if (colNumber === 8) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE2DD" } };
      cell.font = { bold: true, color: { argb: "FF900C3F" } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF1F5" } };
    }
  });

  for (const t of report.trainees) {
    const reasonsList = Object.entries(t.excuseReasonsSummary ?? {})
      .map(([reason, data]) => `${reason} (${formatHours(data.hours)})`)
      .join(", ") || (t.excusedHours > 0 ? "Justifié" : "—");

    const lateHours = Math.round((t.lateMinutes / 60) * 100) / 100;
    const statusLabel =
      t.aspStatus === "compliant"
        ? "Conforme (0 retenue)"
        : t.aspStatus === "warning_unrecorded"
          ? `Attention : ${t.unrecordedSessions} séance(s) non saisie(s)`
          : `Retenue de ${formatHours(t.aspDeductibleHours)} à appliquer`;

    aspSheet.addRow([
      sanitizeForSpreadsheet(t.fullName),
      t.traineeId,
      t.netTheoreticalHours ?? t.theoreticalHours,
      t.aspRealizedHours ?? t.effectivePresenceHours,
      t.absentHours,
      t.lateMinutes,
      lateHours,
      t.aspDeductibleHours,
      t.aspExcusedHours ?? t.excusedHours,
      reasonsList,
      t.exemptedHours ?? 0,
      t.attendanceRate,
      statusLabel,
    ]);
  }

  const aspTotal = aspSheet.addRow([
    "TOTAL PROMOTION",
    null,
    report.totals.netTheoreticalHours ?? report.totals.theoreticalHours,
    report.totals.effectivePresenceHours,
    report.totals.absentHours,
    report.totals.lateMinutes,
    Math.round((report.totals.lateMinutes / 60) * 100) / 100,
    report.totals.aspDeductibleHours ?? (report.totals.absentHours + Math.round((report.totals.lateMinutes / 60) * 100) / 100),
    report.totals.excusedHours,
    null,
    report.totals.exemptedHours ?? 0,
    null,
    `${report.aspTotals?.traineesWithDeductionsCount ?? 0} stagiaire(s) avec retenue`,
  ]);
  aspTotal.font = { bold: true };

  aspSheet.getColumn(1).width = 30;
  aspSheet.getColumn(2).width = 16;
  aspSheet.getColumn(3).width = 16;
  aspSheet.getColumn(4).width = 16;
  aspSheet.getColumn(5).width = 16;
  aspSheet.getColumn(6).width = 14;
  aspSheet.getColumn(7).width = 14;
  aspSheet.getColumn(8).width = 20;
  aspSheet.getColumn(9).width = 16;
  aspSheet.getColumn(10).width = 32;
  aspSheet.getColumn(11).width = 18;
  aspSheet.getColumn(12).width = 14;
  aspSheet.getColumn(13).width = 28;

  for (const c of [3, 4, 5, 7, 8, 9, 11]) aspSheet.getColumn(c).numFmt = "0.00";
  aspSheet.getColumn(12).numFmt = "0.0%";

  aspSheet.addRow([]);
  aspSheet.addRow([
    "Attestation légale :",
    "Bordereau certifié conforme par la direction du CFRP Valentin Haüy pour la transmission mensuelle à l'ASP. Les samedis, dimanches, jours fériés légaux et séances annulées par l'organisme ne constituent aucune retenue financière pour le stagiaire.",
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
