// Parsing of holiday & calendar batch files (.csv / .xlsx) uploaded by the secretary.
//
// Expected columns (header row, any order, case and accents ignored):
//   - "Intitulé" / "Titre" / "Libellé" (required)
//   - "Type" (optional, defaults to "vacation", choices: "Vacances / fermeture" ou "Jour férié")
//   - "Premier jour" / "Date de début" / "Début" / "Date" (required, YYYY-MM-DD or DD/MM/YYYY)
//   - "Dernier jour" / "Date de fin" / "Fin" (optional, defaults to premier jour if empty)

import { isValidIsoDate } from "@/lib/core/dates";
import type { HolidayType } from "./types";

export interface ParsedCalendarHoliday {
  line: number;
  title: string;
  type: HolidayType;
  startDate: string;
  endDate: string;
}

export interface CalendarParseIssue {
  line: number;
  message: string;
}

export interface CalendarParseResult {
  holidays: ParsedCalendarHoliday[];
  errors: CalendarParseIssue[];
}

type Cell = unknown;

const HEADER_ALIASES = {
  title: ["intitule", "titre", "libelle", "nom", "evenement", "designation", "fermeture", "title"],
  type: ["type", "typedefermeture", "categoriedefermeture", "nature", "holidaytype"],
  startDate: ["premierjour", "datededebut", "debut", "datedebut", "date", "startdate", "start", "du"],
  endDate: ["dernierjour", "datedefin", "fin", "datefin", "enddate", "end", "au"],
} as const;

type Column = keyof typeof HEADER_ALIASES;

export function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Parses raw cell value into YYYY-MM-DD string */
export function normalizeDateValue(value: Cell): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Direct ISO YYYY-MM-DD
  if (isValidIsoDate(str)) {
    return str;
  }

  // French format DD/MM/YYYY or DD-MM-YYYY
  const frMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, "0");
    const month = frMatch[2].padStart(2, "0");
    const year = frMatch[3];
    const iso = `${year}-${month}-${day}`;
    if (isValidIsoDate(iso)) return iso;
  }

  return null;
}

/** Normalizes holiday type from cell input (flexible French labels) */
export function normalizeHolidayType(value: Cell): HolidayType {
  const str = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (str.includes("ferie") || str === "holiday") {
    return "holiday";
  }
  return "vacation";
}

function cellToString(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return normalizeDateValue(value) ?? "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Turns raw spreadsheet rows (first row = headers) into calendar holidays. */
export function rowsToHolidays(rows: Cell[][]): CalendarParseResult {
  const errors: CalendarParseIssue[] = [];
  const holidays: ParsedCalendarHoliday[] = [];

  const headerIndex = rows.findIndex((r) => r.some((c) => cellToString(c) !== ""));
  if (headerIndex === -1) {
    return { holidays, errors: [{ line: 1, message: "Le fichier est vide." }] };
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const columns: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(HEADER_ALIASES) as Column[]) {
    const index = headers.findIndex((h) =>
      (HEADER_ALIASES[column] as readonly string[]).includes(h),
    );
    if (index !== -1) columns[column] = index;
  }

  if (columns.title === undefined) {
    return {
      holidays,
      errors: [
        {
          line: headerIndex + 1,
          message:
            "Colonne introuvable : la première ligne doit contenir une colonne « Intitulé » (ou « Titre » / « Libellé »).",
        },
      ],
    };
  }

  if (columns.startDate === undefined) {
    return {
      holidays,
      errors: [
        {
          line: headerIndex + 1,
          message:
            "Colonne introuvable : la première ligne doit contenir une colonne « Premier jour » (ou « Date de début »).",
        },
      ],
    };
  }

  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;

    // Ignore completely empty rows
    if (row.every((c) => cellToString(c) === "")) continue;

    const titleCell = columns.title !== undefined ? row[columns.title] : null;
    const typeCell = columns.type !== undefined ? row[columns.type] : null;
    const startCell = columns.startDate !== undefined ? row[columns.startDate] : null;
    const endCell = columns.endDate !== undefined ? row[columns.endDate] : null;

    const title = cellToString(titleCell);
    if (!title) {
      errors.push({ line, message: "L'intitulé de la fermeture est obligatoire." });
      continue;
    }

    const startDate = normalizeDateValue(startCell);
    if (!startDate) {
      errors.push({
        line,
        message: `Date de début invalide : « ${cellToString(startCell) || "vide"} ». Format attendu : AAAA-MM-JJ ou JJ/MM/AAAA.`,
      });
      continue;
    }

    // End date defaults to start date if empty
    const rawEnd = cellToString(endCell);
    let endDate = startDate;
    if (rawEnd) {
      const parsedEnd = normalizeDateValue(endCell);
      if (!parsedEnd) {
        errors.push({
          line,
          message: `Date de fin invalide : « ${rawEnd} ». Format attendu : AAAA-MM-JJ ou JJ/MM/AAAA.`,
        });
        continue;
      }
      endDate = parsedEnd;
    }

    if (endDate < startDate) {
      errors.push({
        line,
        message: `La date de fin (${endDate}) ne peut pas être antérieure à la date de début (${startDate}).`,
      });
      continue;
    }

    const type = normalizeHolidayType(typeCell);

    const duplicateKey = `${title.toLowerCase()}|${startDate}|${endDate}`;
    if (seen.has(duplicateKey)) {
      errors.push({
        line,
        message: `Ligne en doublon dans le fichier : « ${title} » (${startDate} au ${endDate}).`,
      });
      continue;
    }
    seen.add(duplicateKey);

    holidays.push({
      line,
      title,
      type,
      startDate,
      endDate,
    });
  }

  if (holidays.length === 0 && errors.length === 0) {
    errors.push({
      line: headerIndex + 2,
      message: "Aucune fermeture trouvée sous la ligne d'en-tête.",
    });
  }

  return { holidays, errors };
}

/** Browser-side entry point: reads a File chosen in an <input type="file">. */
export async function parseCalendarFile(file: File): Promise<CalendarParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = (await readSheet(file)) as Cell[][];
    return rowsToHolidays(rows);
  }

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
      skipEmptyLines: false,
    });
    return rowsToHolidays(parsed.data);
  }

  return {
    holidays: [],
    errors: [{ line: 0, message: "Format non pris en charge : utilisez un fichier .csv ou .xlsx." }],
  };
}
