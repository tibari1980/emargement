import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatHours, formatShortDate, todayIso } from "@/lib/core/dates";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "@/lib/domain/types";
import { sanitizeForSpreadsheet } from "@/lib/security/sanitize";

export interface TimetableExportSlot {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subjectTitle: string;
  formationTitle: string;
  trainerName: string;
  room: string;
  validFrom: string;
  validTo: string | null;
}

export interface TimetableExportPayload {
  /** "formation" when exporting a promotion's timetable, "trainer" when exporting a trainer's schedule */
  mode: "formation" | "trainer";
  /** ID of the formation or trainer */
  targetId: string;
  /** Display name of the formation or trainer */
  targetTitle: string;
  /** Optional subtitle (e.g. shortCode or role) */
  subtitle?: string;
  /** Whether the schedule uses the standard 09:00-17:00 fallback */
  isStandardFallback?: boolean;
  /** Slots to export */
  slots: TimetableExportSlot[];
}

// A4 landscape, in PDF points.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const ROW_HEIGHT = 19;

const PDF_COLUMNS = [
  { title: "Jour", width: 78 },
  { title: "Horaire", width: 82 },
  { title: "Durée", width: 52 },
  { title: "Matière / Module", width: 215 },
  { title: "Formation / Promotion", width: 155 },
  { title: "Formateur", width: 115 },
  { title: "Salle", width: 73 },
];

/** Standard PDF fonts only support WinAnsi: replace characters they cannot encode. */
function safe(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^ -~\u00a1-\u00ff\u2026\u20ac]/g, "?");
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let value = safe(text);
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -2) + "…";
  }
  return value;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function timetableExportFileName(payload: TimetableExportPayload, ext: "pdf" | "xlsx"): string {
  const prefix = payload.mode === "trainer" ? "planning-formateur" : "emploi-du-temps-formation";
  const slug = slugify(payload.targetTitle || "planning");
  return `${prefix}-${slug}-${todayIso()}.${ext}`;
}

function sortSlots(slots: TimetableExportSlot[]): TimetableExportSlot[] {
  return [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Generates an official A4 Landscape PDF for a weekly timetable (by Formation or by Trainer).
 */
export async function buildTimetablePdf(payload: TimetableExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sorted = sortSlots(payload.slots);
  const totalMinutes = sorted.reduce((acc, s) => acc + s.durationMinutes, 0);
  const subjects = [...new Set(sorted.map((s) => s.subjectTitle))];

  const docTitle =
    payload.mode === "trainer"
      ? `Planning hebdomadaire Formateur — ${payload.targetTitle}`
      : `Emploi du temps hebdomadaire — ${payload.targetTitle}`;

  pdf.setTitle(docTitle);
  pdf.setAuthor("ESRP / CFRP Valentin Haüy");
  pdf.setLanguage("fr-FR");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.05, 0.18, 0.36);
  const black = rgb(0.08, 0.08, 0.08);
  const grey = rgb(0.35, 0.35, 0.35);

  let page!: PDFPage;
  let y = 0;

  const drawFooter = (p: PDFPage) => {
    p.drawLine({
      start: { x: MARGIN, y: 32 },
      end: { x: PAGE_WIDTH - MARGIN, y: 32 },
      thickness: 0.6,
      color: rgb(0.8, 0.8, 0.8),
    });
    p.drawText(
      safe(
        `ESRP / CFRP Valentin Haüy — Édité le ${formatShortDate(todayIso())} — Application développée par Tibari Zeroual`,
      ),
      { x: MARGIN, y: 20, size: 7.5, font, color: grey },
    );
  };

  const drawTableHeader = () => {
    const headerHeight = 22;
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight + 6,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: headerHeight,
      color: navy,
    });
    let x = MARGIN + 5;
    for (const col of PDF_COLUMNS) {
      page.drawText(safe(col.title), {
        x,
        y: y - 8,
        size: 8.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += col.width;
    }
    y -= headerHeight + 4;
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;

    // Header banner
    page.drawText(
      safe("ESRP / CFRP Valentin Haüy — Plateforme d'Émargement & Suivi Pédagogique"),
      { x: MARGIN, y, size: 10, font: bold, color: navy },
    );
    y -= 18;
    page.drawText(safe(docTitle), { x: MARGIN, y, size: 14, font: bold, color: black });
    y -= 16;

    const summaryLine = `Volume hebdomadaire : ${formatHours(totalMinutes / 60)} (${sorted.length} créneau${sorted.length > 1 ? "x" : ""})${
      payload.isStandardFallback ? " — Horaire réglementaire standard (09:00 - 17:00)" : ""
    }`;
    page.drawText(safe(summaryLine), { x: MARGIN, y, size: 9.5, font: bold, color: grey });
    y -= 13;

    if (subjects.length > 0) {
      const subjLine = `Matières enseignées : ${subjects.join(", ")}`;
      page.drawText(truncate(subjLine, font, 8.5, PAGE_WIDTH - 2 * MARGIN), {
        x: MARGIN,
        y,
        size: 8.5,
        font,
        color: grey,
      });
      y -= 16;
    } else {
      y -= 6;
    }

    drawTableHeader();
    drawFooter(page);
  };

  newPage();

  if (sorted.length === 0) {
    y -= 16;
    page.drawText(
      safe("Aucun créneau hebdomadaire spécifique n'est affecté pour cette sélection."),
      { x: MARGIN + 4, y, size: 10, font, color: grey },
    );
  } else {
    let rowIndex = 0;
    for (const weekday of WEEKDAYS) {
      const daySlots = sorted.filter((s) => s.weekday === weekday);
      if (daySlots.length === 0) continue;

      for (let i = 0; i < daySlots.length; i++) {
        const s = daySlots[i];
        if (y < MARGIN + 48) {
          newPage();
        }

        if (rowIndex % 2 === 1) {
          page.drawRectangle({
            x: MARGIN,
            y: y - 13,
            width: PAGE_WIDTH - 2 * MARGIN,
            height: ROW_HEIGHT,
            color: rgb(0.96, 0.97, 0.99),
          });
        }

        const cells = [
          i === 0 ? WEEKDAY_LABELS[weekday] : "",
          `${s.startTime} - ${s.endTime}`,
          formatHours(s.durationMinutes / 60),
          s.subjectTitle,
          s.formationTitle,
          s.trainerName,
          s.room || "Plateau Pédagogique",
        ];

        let x = MARGIN + 5;
        cells.forEach((cell, idx) => {
          const isDayCol = idx === 0;
          const isTimeCol = idx === 1;
          const cellFont = isDayCol || isTimeCol ? bold : font;
          page.drawText(truncate(cell, cellFont, 8.5, PDF_COLUMNS[idx].width - 8), {
            x,
            y: y - 7,
            size: 8.5,
            font: cellFont,
            color: isDayCol ? navy : black,
          });
          x += PDF_COLUMNS[idx].width;
        });

        page.drawLine({
          start: { x: MARGIN, y: y - 13 },
          end: { x: PAGE_WIDTH - MARGIN, y: y - 13 },
          thickness: 0.4,
          color: rgb(0.86, 0.88, 0.91),
        });

        y -= ROW_HEIGHT;
        rowIndex++;
      }
    }

    // Total row
    if (y < MARGIN + 48) newPage();
    page.drawRectangle({
      x: MARGIN,
      y: y - 14,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: ROW_HEIGHT + 2,
      color: rgb(0.88, 0.92, 0.97),
    });
    page.drawText(safe("TOTAL HEBDOMADAIRE"), {
      x: MARGIN + 5,
      y: y - 7,
      size: 9,
      font: bold,
      color: navy,
    });
    page.drawText(safe(`${sorted.length} créneau(x)`), {
      x: MARGIN + 5 + PDF_COLUMNS[0].width,
      y: y - 7,
      size: 9,
      font: bold,
      color: black,
    });
    page.drawText(safe(formatHours(totalMinutes / 60)), {
      x: MARGIN + 5 + PDF_COLUMNS[0].width + PDF_COLUMNS[1].width,
      y: y - 7,
      size: 9,
      font: bold,
      color: navy,
    });
  }

  return pdf.save();
}

/**
 * Generates an official Excel (.xlsx) workbook with 2 sheets:
 * 1. Planning_Hebdomadaire (chronological schedule Monday -> Friday)
 * 2. Synthese_Hebdomadaire (breakdown by weekday and by subject)
 */
export async function buildTimetableExcel(payload: TimetableExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESRP / CFRP Valentin Haüy — Émargement";
  workbook.created = new Date();

  const sorted = sortSlots(payload.slots);
  const totalMinutes = sorted.reduce((acc, s) => acc + s.durationMinutes, 0);
  const safeTargetTitle = sanitizeForSpreadsheet(payload.targetTitle);

  /* =========================================================================
   * FEUILLE 1 : Planning Hebdomadaire Détaillé
   * ========================================================================= */
  const sheet = workbook.addWorksheet("Planning_Hebdomadaire", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const headerTitle =
    payload.mode === "trainer"
      ? `ESRP / CFRP Valentin Haüy — Planning Hebdomadaire Formateur`
      : `ESRP / CFRP Valentin Haüy — Emploi du Temps Hebdomadaire Formation`;

  sheet.addRow([headerTitle]).font = { bold: true, size: 14, color: { argb: "FF0D2E5C" } };
  sheet.addRow([
    payload.mode === "trainer" ? "Formateur" : "Formation / Promotion",
    safeTargetTitle,
  ]).font = { bold: true, size: 11 };
  sheet.addRow([
    "Volume hebdomadaire",
    formatHours(totalMinutes / 60),
    "Nombre de créneaux",
    sorted.length,
    "Date d'édition",
    formatShortDate(todayIso()),
  ]);
  if (payload.isStandardFallback) {
    sheet.addRow([
      "Régime horaire",
      "Horaire journalier réglementaire standard (Lundi au Vendredi · 09:00 – 17:00 · 7h/jour)",
    ]);
  } else {
    sheet.addRow([
      "Régime horaire",
      "Emploi du temps personnalisé par matière et par créneau",
    ]);
  }
  sheet.addRow([]);

  const tableHeader = sheet.addRow([
    "Jour",
    "Heure de début",
    "Heure de fin",
    "Horaire complet",
    "Durée (heures)",
    "Matière / Module",
    "Formation / Promotion",
    "Formateur",
    "Salle",
    "Validité",
  ]);
  tableHeader.height = 24;
  tableHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  tableHeader.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  tableHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2E5C" } };
  });

  for (const s of sorted) {
    const validity = s.validTo
      ? `Du ${formatShortDate(s.validFrom)} au ${formatShortDate(s.validTo)}`
      : "Année entière";
    const row = sheet.addRow([
      WEEKDAY_LABELS[s.weekday],
      s.startTime,
      s.endTime,
      `${s.startTime} – ${s.endTime}`,
      Number((s.durationMinutes / 60).toFixed(2)),
      sanitizeForSpreadsheet(s.subjectTitle),
      sanitizeForSpreadsheet(s.formationTitle),
      sanitizeForSpreadsheet(s.trainerName),
      sanitizeForSpreadsheet(s.room || "Plateau Pédagogique"),
      validity,
    ]);
    row.alignment = { vertical: "middle" };
  }

  const totalRow = sheet.addRow([
    "TOTAL HEBDOMADAIRE",
    "",
    "",
    `${sorted.length} créneau(x)`,
    Number((totalMinutes / 60).toFixed(2)),
    "",
    "",
    "",
    "",
    "",
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  const colWidths = [16, 15, 15, 18, 16, 36, 36, 26, 22, 24];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  sheet.getColumn(5).numFmt = "0.00";

  /* =========================================================================
   * FEUILLE 2 : Synthèse par Jour et par Matière
   * ========================================================================= */
  const summarySheet = workbook.addWorksheet("Synthese_Hebdomadaire", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  summarySheet.addRow(["Synthèse du volume horaire par jour et par matière"]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF0D2E5C" },
  };
  summarySheet.addRow([
    payload.mode === "trainer" ? "Formateur" : "Formation",
    safeTargetTitle,
  ]);
  summarySheet.addRow([]);

  const dayHeader = summarySheet.addRow(["Jour de la semaine", "Nombre de créneaux", "Volume horaire (h)", "Format horaire"]);
  dayHeader.font = { bold: true };
  dayHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  for (const weekday of WEEKDAYS) {
    const daySlots = sorted.filter((s) => s.weekday === weekday);
    const dayMins = daySlots.reduce((sum, s) => sum + s.durationMinutes, 0);
    summarySheet.addRow([
      WEEKDAY_LABELS[weekday],
      daySlots.length,
      Number((dayMins / 60).toFixed(2)),
      formatHours(dayMins / 60),
    ]);
  }

  summarySheet.addRow([]);
  const subjHeader = summarySheet.addRow(["Matière / Module", "Nombre de créneaux", "Volume horaire (h)", "Format horaire"]);
  subjHeader.font = { bold: true };
  subjHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  const bySubject = new Map<string, { count: number; minutes: number }>();
  for (const s of sorted) {
    const cur = bySubject.get(s.subjectTitle) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += s.durationMinutes;
    bySubject.set(s.subjectTitle, cur);
  }
  for (const [subj, stats] of bySubject.entries()) {
    summarySheet.addRow([
      sanitizeForSpreadsheet(subj),
      stats.count,
      Number((stats.minutes / 60).toFixed(2)),
      formatHours(stats.minutes / 60),
    ]);
  }

  summarySheet.getColumn(1).width = 38;
  summarySheet.getColumn(2).width = 20;
  summarySheet.getColumn(3).width = 20;
  summarySheet.getColumn(4).width = 20;
  summarySheet.getColumn(3).numFmt = "0.00";

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
