import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatHours, formatMonth, formatShortDate, todayIso } from "@/lib/dates";
import type { MonthlyReport } from "@/lib/hoursCalculator";

// A4 landscape, in PDF points.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 40;
const ROW_HEIGHT = 18;

const COLUMNS = [
  { title: "Stagiaire", width: 186 },
  { title: "Heures théoriques", width: 72 },
  { title: "Présence effective", width: 72 },
  { title: "Retards", width: 72 },
  { title: "Absences non justifiées", width: 80 },
  { title: "Absences justifiées", width: 72 },
  { title: "Total absences", width: 72 },
  { title: "Taux de présence", width: 66 },
  { title: "Jours non saisis", width: 60 },
];

/** Standard PDF fonts only support WinAnsi: replace characters they cannot encode. */
function safe(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^ -~\u00a1-\u00ff\u2013\u2014\u2026\u20ac]/g, "?");
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let value = safe(text);
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -2) + "…";
  }
  return value;
}

/** Official monthly attendance statement for funders (France Travail, Région, CPAM…). */
export async function buildPdfReport(report: MonthlyReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relevé de présence — ${report.courseTitle} — ${formatMonth(report.month)}`);
  pdf.setAuthor("CFRP Valentin Haüy");
  pdf.setLanguage("fr-FR");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);

  let page!: PDFPage;
  let y = 0;

  const text = (value: string, x: number, size = 9, f = font, color = black) =>
    page.drawText(safe(value), { x, y, size, font: f, color });

  const drawTableHeader = () => {
    const headerHeight = 28;
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight + 12,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: headerHeight,
      color: rgb(0.86, 0.9, 0.95),
    });
    let x = MARGIN + 4;
    for (const col of COLUMNS) {
      // Headers are drawn on two lines, words split in half.
      const words = col.title.split(" ");
      const first = words.length > 1 ? words.slice(0, Math.ceil(words.length / 2)).join(" ") : col.title;
      const second = words.length > 1 ? words.slice(Math.ceil(words.length / 2)).join(" ") : "";
      page.drawText(safe(first), { x, y, size: 8, font: bold });
      if (second) page.drawText(safe(second), { x, y: y - 10, size: 8, font: bold });
      x += col.width;
    }
    y -= headerHeight;
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    text("CFRP Valentin Haüy — Relevé mensuel de présence", MARGIN, 14, bold);
    y -= 20;
    text(`Formation : ${report.courseTitle}`, MARGIN, 10);
    text(`Mois : ${formatMonth(report.month)}`, 520, 10);
    y -= 14;
    text(
      `Horaires : ${report.defaultStartTime} - ${report.defaultEndTime} (${report.dailyHours} h/jour) — ` +
        `${report.workingDays.length} jours ouvrés — ${formatHours(report.theoreticalHours)} théoriques`,
      MARGIN,
      9,
      font,
      grey,
    );
    y -= 24;
    drawTableHeader();
  };

  newPage();

  const drawRow = (cells: string[], f: PDFFont) => {
    if (y < MARGIN + 60) newPage();
    let x = MARGIN + 4;
    cells.forEach((cell, i) => {
      const width = COLUMNS[i].width - 6;
      page.drawText(truncate(cell, f, 9, width), { x, y, size: 9, font: f });
      x += COLUMNS[i].width;
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 5 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 5 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= ROW_HEIGHT;
  };

  for (const t of report.trainees) {
    drawRow(
      [
        t.fullName,
        formatHours(t.theoreticalHours),
        formatHours(t.effectivePresenceHours),
        t.lateCount ? `${t.lateCount} (${t.lateMinutes} min)` : "0",
        formatHours(t.absentHours),
        formatHours(t.excusedHours),
        formatHours(t.totalAbsenceHours),
        `${(t.attendanceRate * 100).toFixed(1)} %`,
        String(t.unrecordedDays),
      ],
      font,
    );
  }

  drawRow(
    [
      "Total",
      formatHours(report.totals.theoreticalHours),
      formatHours(report.totals.effectivePresenceHours),
      `${report.totals.lateMinutes} min`,
      formatHours(report.totals.absentHours),
      formatHours(report.totals.excusedHours),
      formatHours(report.totals.totalAbsenceHours),
      "",
      "",
    ],
    bold,
  );

  if (report.trainees.length === 0) {
    y -= 4;
    text("Aucun stagiaire inscrit dans cette formation.", MARGIN, 10, font, grey);
    y -= ROW_HEIGHT;
  }

  if (y < MARGIN + 90) newPage();
  y -= 12;
  if (report.closedDays.length) {
    text(
      `Jours de fermeture exclus : ${report.closedDays.map(formatShortDate).join(", ")}`,
      MARGIN,
      8,
      font,
      grey,
    );
    y -= 14;
  }
  text(
    "Retards déduits à la minute. Total absences = absences non justifiées + justifiées + retards.",
    MARGIN,
    8,
    font,
    grey,
  );
  y -= 30;
  text("Signature et cachet du responsable pédagogique :", MARGIN, 10);
  text(`Édité le ${formatShortDate(todayIso())}`, 600, 10);

  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Page ${i + 1} / ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 60,
      y: MARGIN / 2,
      size: 8,
      font,
      color: grey,
    }),
  );

  return pdf.save();
}
