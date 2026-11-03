import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  eachDay,
  formatDayAndMonth,
  formatHours,
  formatMonth,
  formatShortDate,
  isWeekend,
  monthBounds,
  parseIsoDate,
  todayIso,
} from "@/lib/core/dates";
import { isSlotActiveOn } from "@/lib/domain/schedule";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "@/lib/domain/types";
import { sanitizeForSpreadsheet } from "@/lib/security/sanitize";
import { drawOfficialPdfHeader, getAvhLogoPngBuffer } from "./brandHeader";

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

export interface TimetableExportHoliday {
  startDate: string;
  endDate: string;
  title: string;
  type: string;
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
  /** "week" for weekly timetable (default) or "month" for complete monthly planning */
  period?: "week" | "month";
  /** "YYYY-MM" when period === "month" (e.g. "2026-11") */
  month?: string;
  /** Holidays/closures in the period to exclude or mark */
  holidays?: TimetableExportHoliday[];
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
  const isMonth = payload.period === "month";
  const prefix = isMonth
    ? payload.mode === "trainer"
      ? "planning-mensuel-formateur"
      : "planning-mensuel-formation"
    : payload.mode === "trainer"
    ? "planning-formateur"
    : "emploi-du-temps-formation";
  const slug = slugify(payload.targetTitle || "planning");
  const suffix = isMonth ? (payload.month || todayIso().slice(0, 7)) : todayIso();
  return `${prefix}-${slug}-${suffix}.${ext}`;
}

export interface MonthlyPlanningItem {
  date: string;
  weekday: Weekday;
  dayLabel: string;
  formattedDate: string;
  isClosure: boolean;
  closureTitle?: string;
  slot?: TimetableExportSlot;
}

export interface MonthlyPlanningData {
  month: string;
  monthTitle: string;
  items: MonthlyPlanningItem[];
  totalMinutes: number;
  totalWorkingDays: number;
  totalClosedDays: number;
  totalSessions: number;
  bySubject: Map<string, { count: number; minutes: number }>;
}

export function buildMonthlySessions(payload: TimetableExportPayload): MonthlyPlanningData {
  const month = payload.month && /^\d{4}-\d{2}$/.test(payload.month) ? payload.month : todayIso().slice(0, 7);
  const bounds = monthBounds(month);
  const allDays = eachDay(bounds.start, bounds.end);

  const closures = new Map<string, string>();
  if (Array.isArray(payload.holidays)) {
    for (const h of payload.holidays) {
      if (!h.startDate || !h.endDate) continue;
      const hDays = eachDay(h.startDate, h.endDate);
      for (const d of hDays) {
        closures.set(d, h.title || "Fermeture / Jour férié");
      }
    }
  }

  const items: MonthlyPlanningItem[] = [];
  let totalMinutes = 0;
  let totalWorkingDays = 0;
  let totalClosedDays = 0;
  let totalSessions = 0;
  const bySubject = new Map<string, { count: number; minutes: number }>();

  // Determine standard fallback slots if needed
  const fallbackSlots: TimetableExportSlot[] = payload.isStandardFallback
    ? WEEKDAYS.map((weekday) => ({
        id: `fb_${weekday}_${payload.targetId}`,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
        durationMinutes: 420,
        subjectTitle: "Enseignement général & Travaux pratiques",
        formationTitle: payload.targetTitle,
        trainerName: "Équipe pédagogique ESRP / CFRP",
        room: "Plateau Pédagogique",
        validFrom: "1970-01-01",
        validTo: null,
      }))
    : [];

  const effectiveSlots = payload.slots.length > 0 ? payload.slots : fallbackSlots;

  for (const dayIso of allDays) {
    if (isWeekend(dayIso)) continue;

    const [y, m, d] = dayIso.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek < 1 || dayOfWeek > 5) continue;
    const weekday = dayOfWeek as Weekday;

    const dayLabel = WEEKDAY_LABELS[weekday];
    const formattedDate = formatShortDate(dayIso);

    if (closures.has(dayIso)) {
      totalClosedDays += 1;
      items.push({
        date: dayIso,
        weekday,
        dayLabel,
        formattedDate,
        isClosure: true,
        closureTitle: closures.get(dayIso),
      });
      continue;
    }

    totalWorkingDays += 1;
    const daySlots = effectiveSlots
      .filter((s) => isSlotActiveOn(s, dayIso))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (daySlots.length === 0) {
      items.push({
        date: dayIso,
        weekday,
        dayLabel,
        formattedDate,
        isClosure: false,
      });
    } else {
      for (const slot of daySlots) {
        items.push({
          date: dayIso,
          weekday,
          dayLabel,
          formattedDate,
          isClosure: false,
          slot,
        });
        totalMinutes += slot.durationMinutes;
        totalSessions += 1;

        const cur = bySubject.get(slot.subjectTitle) ?? { count: 0, minutes: 0 };
        cur.count += 1;
        cur.minutes += slot.durationMinutes;
        bySubject.set(slot.subjectTitle, cur);
      }
    }
  }

  return {
    month,
    monthTitle: formatMonth(month),
    items,
    totalMinutes,
    totalWorkingDays,
    totalClosedDays,
    totalSessions,
    bySubject,
  };
}

function sortSlots(slots: TimetableExportSlot[]): TimetableExportSlot[] {
  return [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.startTime.localeCompare(b.startTime);
  });
}

const MONTHLY_PDF_COLUMNS = [
  { title: "Date", width: 70 },
  { title: "Jour", width: 62 },
  { title: "Horaire", width: 80 },
  { title: "Durée", width: 48 },
  { title: "Matière / Événement", width: 210 },
  { title: "Formation / Promotion", width: 160 },
  { title: "Formateur / Salle", width: 140 },
];

export async function buildMonthlyTimetablePdf(payload: TimetableExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const data = buildMonthlySessions(payload);

  const docTitle =
    payload.mode === "trainer"
      ? `Planning Mensuel Formateur — ${payload.targetTitle} (${data.monthTitle})`
      : `Planning Mensuel Formation — ${payload.targetTitle} (${data.monthTitle})`;

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
        `ESRP / CFRP Valentin Haüy — Édité le ${formatShortDate(todayIso())} — Planning certifié — Application développée par Tibari Zeroual`,
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
    for (const col of MONTHLY_PDF_COLUMNS) {
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

    const summaryLine = `Mois : ${data.monthTitle} — Volume total : ${formatHours(data.totalMinutes / 60)} (${data.totalSessions} séance${data.totalSessions > 1 ? "s" : ""})`;
    const statsLine = `${data.totalWorkingDays} jours de formation · ${data.totalClosedDays} jour${data.totalClosedDays > 1 ? "s" : ""} férié/fermeture${payload.isStandardFallback ? " — Régime standard (09:00 - 17:00)" : ""}`;

    y = drawOfficialPdfHeader({
      page,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      margin: MARGIN,
      font,
      bold,
      docTitle,
      subtitleLines: [summaryLine, statsLine],
      badgeText: payload.mode === "trainer" ? "PLANNING MENSUEL FORMATEUR" : "PLANNING MENSUEL FORMATION",
    });

    drawTableHeader();
    drawFooter(page);
  };

  newPage();

  if (data.items.length === 0) {
    y -= 16;
    page.drawText(
      safe("Aucun jour ouvré ou créneau n'est programmé pour ce mois."),
      { x: MARGIN + 4, y, size: 10, font, color: grey },
    );
  } else {
    let rowIndex = 0;
    for (const item of data.items) {
      if (y < MARGIN + 48) {
        newPage();
      }

      if (item.isClosure) {
        page.drawRectangle({
          x: MARGIN,
          y: y - 13,
          width: PAGE_WIDTH - 2 * MARGIN,
          height: ROW_HEIGHT,
          color: rgb(0.99, 0.95, 0.88),
        });

        const cells = [
          item.formattedDate,
          item.dayLabel,
          "Fermé",
          "-",
          `Fermeture : ${item.closureTitle || "Jour férié"}`,
          payload.targetTitle,
          "Établissement fermé",
        ];

        let x = MARGIN + 5;
        cells.forEach((cell, idx) => {
          const isHighlight = idx === 0 || idx === 1 || idx === 4;
          const cellFont = isHighlight ? bold : font;
          const color = isHighlight ? rgb(0.65, 0.35, 0.05) : grey;
          page.drawText(truncate(cell, cellFont, 8.5, MONTHLY_PDF_COLUMNS[idx].width - 8), {
            x,
            y: y - 7,
            size: 8.5,
            font: cellFont,
            color,
          });
          x += MONTHLY_PDF_COLUMNS[idx].width;
        });
      } else if (item.slot) {
        const s = item.slot;
        if (rowIndex % 2 === 1) {
          page.drawRectangle({
            x: MARGIN,
            y: y - 13,
            width: PAGE_WIDTH - 2 * MARGIN,
            height: ROW_HEIGHT,
            color: rgb(0.96, 0.97, 0.99),
          });
        }

        const trainerOrRoom =
          payload.mode === "trainer"
            ? (s.room ? `Salle ${s.room}` : "Plateau Pédagogique")
            : `${s.trainerName}${s.room ? ` (${s.room})` : ""}`;

        const cells = [
          item.formattedDate,
          item.dayLabel,
          `${s.startTime} - ${s.endTime}`,
          formatHours(s.durationMinutes / 60),
          s.subjectTitle,
          s.formationTitle,
          trainerOrRoom,
        ];

        let x = MARGIN + 5;
        cells.forEach((cell, idx) => {
          const isDate = idx === 0;
          const isTime = idx === 2;
          const cellFont = isDate || isTime ? bold : font;
          page.drawText(truncate(cell, cellFont, 8.5, MONTHLY_PDF_COLUMNS[idx].width - 8), {
            x,
            y: y - 7,
            size: 8.5,
            font: cellFont,
            color: isDate ? navy : black,
          });
          x += MONTHLY_PDF_COLUMNS[idx].width;
        });
      } else {
        if (rowIndex % 2 === 1) {
          page.drawRectangle({
            x: MARGIN,
            y: y - 13,
            width: PAGE_WIDTH - 2 * MARGIN,
            height: ROW_HEIGHT,
            color: rgb(0.98, 0.98, 0.98),
          });
        }

        const cells = [
          item.formattedDate,
          item.dayLabel,
          "-",
          "0 h 00",
          "Aucun cours programmé ce jour",
          payload.targetTitle,
          "-",
        ];

        let x = MARGIN + 5;
        cells.forEach((cell, idx) => {
          const isDate = idx === 0;
          const cellFont = isDate ? bold : font;
          page.drawText(truncate(cell, cellFont, 8.5, MONTHLY_PDF_COLUMNS[idx].width - 8), {
            x,
            y: y - 7,
            size: 8.5,
            font: cellFont,
            color: isDate ? navy : grey,
          });
          x += MONTHLY_PDF_COLUMNS[idx].width;
        });
      }

      page.drawLine({
        start: { x: MARGIN, y: y - 13 },
        end: { x: PAGE_WIDTH - MARGIN, y: y - 13 },
        thickness: 0.4,
        color: rgb(0.86, 0.88, 0.91),
      });

      y -= ROW_HEIGHT;
      rowIndex++;
    }

    if (y < MARGIN + 48) newPage();
    page.drawRectangle({
      x: MARGIN,
      y: y - 14,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: ROW_HEIGHT + 2,
      color: rgb(0.88, 0.92, 0.97),
    });
    page.drawText(safe("TOTAL MENSUEL"), {
      x: MARGIN + 5,
      y: y - 7,
      size: 9,
      font: bold,
      color: navy,
    });
    page.drawText(safe(formatHours(data.totalMinutes / 60)), {
      x: MARGIN + 5 + MONTHLY_PDF_COLUMNS[0].width + MONTHLY_PDF_COLUMNS[1].width + MONTHLY_PDF_COLUMNS[2].width,
      y: y - 7,
      size: 9,
      font: bold,
      color: navy,
    });
    page.drawText(
      safe(
        `${data.totalSessions} séance${data.totalSessions > 1 ? "s" : ""} · ${data.totalWorkingDays} jours ouvrés tenus · ${data.totalClosedDays} jour${data.totalClosedDays > 1 ? "s" : ""} férié/fermé`,
      ),
      {
        x:
          MARGIN +
          5 +
          MONTHLY_PDF_COLUMNS[0].width +
          MONTHLY_PDF_COLUMNS[1].width +
          MONTHLY_PDF_COLUMNS[2].width +
          MONTHLY_PDF_COLUMNS[3].width,
        y: y - 7,
        size: 8.5,
        font: bold,
        color: black,
      },
    );
  }

  return pdf.save();
}

/**
 * Generates an official A4 Landscape PDF for a weekly timetable (by Formation or by Trainer).
 */
export async function buildTimetablePdf(payload: TimetableExportPayload): Promise<Uint8Array> {
  if (payload.period === "month") {
    return buildMonthlyTimetablePdf(payload);
  }

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

    const summaryLine = `Volume hebdomadaire : ${formatHours(totalMinutes / 60)} (${sorted.length} créneau${sorted.length > 1 ? "x" : ""})${
      payload.isStandardFallback ? " — Horaire réglementaire standard (09:00 - 17:00)" : ""
    }`;
    const subtitleLines = [summaryLine];
    if (subjects.length > 0) {
      subtitleLines.push(
        truncate(`Matières enseignées : ${subjects.join(", ")}`, font, 8.5, PAGE_WIDTH - 2 * MARGIN),
      );
    }

    y = drawOfficialPdfHeader({
      page,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      margin: MARGIN,
      font,
      bold,
      docTitle,
      subtitleLines,
      badgeText: payload.mode === "trainer" ? "PLANNING OFFICIEL FORMATEUR" : "PLANNING OFFICIEL FORMATION",
    });

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
    page.drawText(safe(formatHours(totalMinutes / 60)), {
      x: MARGIN + 5 + PDF_COLUMNS[0].width + PDF_COLUMNS[1].width,
      y: y - 7,
      size: 9,
      font: bold,
      color: navy,
    });
    page.drawText(safe(`${sorted.length} créneau${sorted.length > 1 ? "x" : ""} programmé${sorted.length > 1 ? "s" : ""}`), {
      x: MARGIN + 5 + PDF_COLUMNS[0].width + PDF_COLUMNS[1].width + PDF_COLUMNS[2].width,
      y: y - 7,
      size: 8.5,
      font: bold,
      color: black,
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
  if (payload.period === "month") {
    return buildMonthlyTimetableExcel(payload);
  }

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

  try {
    const logoId = workbook.addImage({
      buffer: getAvhLogoPngBuffer() as any,
      extension: "png",
    });
    sheet.addImage(logoId, {
      tl: { col: 6.1, row: 0.1 },
      ext: { width: 64, height: 64 },
    });
  } catch {}

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

/**
 * Generates an official Excel (.xlsx) workbook for a complete monthly schedule:
 * 1. Planning_Mensuel (day-by-day calendar with public holidays and scheduled sessions)
 * 2. Synthese_Mensuelle (summary statistics: hours, held days, closures, subject breakdown)
 */
export async function buildMonthlyTimetableExcel(payload: TimetableExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESRP / CFRP Valentin Haüy — Émargement";
  workbook.created = new Date();

  const data = buildMonthlySessions(payload);
  const safeTargetTitle = sanitizeForSpreadsheet(payload.targetTitle);

  /* =========================================================================
   * FEUILLE 1 : Planning_Mensuel
   * ========================================================================= */
  const sheet = workbook.addWorksheet("Planning_Mensuel", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const headerTitle =
    payload.mode === "trainer"
      ? `ESRP / CFRP Valentin Haüy — Planning Mensuel Formateur (${data.monthTitle})`
      : `ESRP / CFRP Valentin Haüy — Planning Mensuel Formation (${data.monthTitle})`;

  sheet.addRow([headerTitle]).font = { bold: true, size: 14, color: { argb: "FF0D2E5C" } };
  sheet.addRow([
    payload.mode === "trainer" ? "Formateur" : "Formation / Promotion",
    safeTargetTitle,
  ]).font = { bold: true, size: 11 };
  sheet.addRow([
    "Mois civil",
    data.monthTitle,
    "Volume mensuel",
    formatHours(data.totalMinutes / 60),
    "Date d'édition",
    formatShortDate(todayIso()),
  ]);
  sheet.addRow([
    "Séances programmées",
    data.totalSessions,
    "Jours de formation",
    data.totalWorkingDays,
    "Jours fériés / fermetures",
    data.totalClosedDays,
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

  try {
    const logoId = workbook.addImage({
      buffer: getAvhLogoPngBuffer() as any,
      extension: "png",
    });
    sheet.addImage(logoId, {
      tl: { col: 7.1, row: 0.1 },
      ext: { width: 64, height: 64 },
    });
  } catch {}

  const tableHeader = sheet.addRow([
    "Date",
    "Jour",
    "Statut",
    "Heure de début",
    "Heure de fin",
    "Horaire complet",
    "Durée (heures)",
    "Matière / Événement",
    "Formation / Promotion",
    "Formateur",
    "Salle",
    "Observations",
  ]);
  tableHeader.height = 24;
  tableHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  tableHeader.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  tableHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2E5C" } };
  });

  const startRowNumber = 7;
  for (const item of data.items) {
    if (item.isClosure) {
      const row = sheet.addRow([
        item.formattedDate,
        item.dayLabel,
        "Fermeture / Férié",
        "-",
        "-",
        "-",
        0,
        sanitizeForSpreadsheet(`Fermeture : ${item.closureTitle || "Jour férié"}`),
        safeTargetTitle,
        "-",
        "-",
        "Établissement fermé",
      ]);
      row.alignment = { vertical: "middle" };
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
        c.font = { color: { argb: "FF856404" }, bold: true };
      });
    } else if (item.slot) {
      const s = item.slot;
      const row = sheet.addRow([
        item.formattedDate,
        item.dayLabel,
        "Cours programmé",
        s.startTime,
        s.endTime,
        `${s.startTime} – ${s.endTime}`,
        Number((s.durationMinutes / 60).toFixed(2)),
        sanitizeForSpreadsheet(s.subjectTitle),
        sanitizeForSpreadsheet(s.formationTitle),
        sanitizeForSpreadsheet(s.trainerName),
        sanitizeForSpreadsheet(s.room || "Plateau Pédagogique"),
        "",
      ]);
      row.alignment = { vertical: "middle" };
    } else {
      const row = sheet.addRow([
        item.formattedDate,
        item.dayLabel,
        "Jour ouvré sans cours",
        "-",
        "-",
        "-",
        0,
        "Aucun cours programmé ce jour",
        safeTargetTitle,
        "-",
        "-",
        "",
      ]);
      row.alignment = { vertical: "middle" };
    }
  }

  const lastRowNumber = sheet.rowCount;
  const totalRow = sheet.addRow([
    "TOTAL MENSUEL",
    "",
    `${data.totalSessions} séance(s)`,
    "",
    "",
    formatHours(data.totalMinutes / 60),
    { formula: `SUM(G${startRowNumber}:G${lastRowNumber})` },
    `${data.totalWorkingDays} jours ouvrés tenus · ${data.totalClosedDays} fermetures`,
    "",
    "",
    "",
    "",
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  const colWidths = [14, 14, 20, 15, 15, 18, 16, 36, 34, 26, 22, 24];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  sheet.getColumn(7).numFmt = "0.00";

  /* =========================================================================
   * FEUILLE 2 : Synthese_Mensuelle
   * ========================================================================= */
  const summarySheet = workbook.addWorksheet("Synthese_Mensuelle", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  summarySheet.addRow([`Synthèse mensuelle du planning — ${data.monthTitle}`]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF0D2E5C" },
  };
  summarySheet.addRow([
    payload.mode === "trainer" ? "Formateur" : "Formation",
    safeTargetTitle,
  ]);
  summarySheet.addRow([]);

  const kpiHeader = summarySheet.addRow(["Indicateur", "Valeur", "Unité / Détail"]);
  kpiHeader.font = { bold: true };
  kpiHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  summarySheet.addRow(["Volume total du mois", Number((data.totalMinutes / 60).toFixed(2)), formatHours(data.totalMinutes / 60)]);
  summarySheet.addRow(["Nombre total de séances", data.totalSessions, "Séances de cours dispensées"]);
  summarySheet.addRow(["Jours de formation tenus", data.totalWorkingDays, "Jours ouvrés"]);
  summarySheet.addRow(["Jours fériés / fermetures", data.totalClosedDays, "Jours sans activité"]);

  summarySheet.addRow([]);
  const subjHeader = summarySheet.addRow(["Matière / Module", "Nombre de séances", "Volume horaire (h)", "Format horaire"]);
  subjHeader.font = { bold: true };
  subjHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  for (const [subj, stats] of data.bySubject.entries()) {
    summarySheet.addRow([
      sanitizeForSpreadsheet(subj),
      stats.count,
      Number((stats.minutes / 60).toFixed(2)),
      formatHours(stats.minutes / 60),
    ]);
  }

  summarySheet.getColumn(1).width = 38;
  summarySheet.getColumn(2).width = 22;
  summarySheet.getColumn(3).width = 22;
  summarySheet.getColumn(4).width = 22;
  summarySheet.getColumn(2).numFmt = "0.00";
  summarySheet.getColumn(3).numFmt = "0.00";

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
