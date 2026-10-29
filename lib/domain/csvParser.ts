// Parsing of trainee batch files (.csv / .xlsx) uploaded by the secretary.
//
// Expected columns (header row, any order, case and accents ignored):
//   - "Nom" and "Prénom", or a single "Nom complet" column
//   - "Email" (optional)

export interface ParsedTrainee {
  /** 1-based line number in the source file, for error messages. */
  line: number;
  fullName: string;
  email: string | null;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface TraineeParseResult {
  trainees: ParsedTrainee[];
  errors: ParseIssue[];
}

type Cell = unknown;

const HEADER_ALIASES = {
  fullName: ["nomcomplet", "nometprenom", "nomprenom", "prenomnom", "fullname", "stagiaire"],
  lastName: ["nom", "nomdefamille", "lastname", "surname"],
  firstName: ["prenom", "firstname"],
  email: ["email", "mail", "courriel", "adressemail", "adresseemail", "emailaddress"],
} as const;

type Column = keyof typeof HEADER_ALIASES;

export function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellToString(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, " ").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turns raw spreadsheet rows (first row = headers) into trainees. */
export function rowsToTrainees(rows: Cell[][]): TraineeParseResult {
  const errors: ParseIssue[] = [];
  const trainees: ParsedTrainee[] = [];

  const headerIndex = rows.findIndex((r) => r.some((c) => cellToString(c) !== ""));
  if (headerIndex === -1) {
    return { trainees, errors: [{ line: 1, message: "Le fichier est vide." }] };
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const columns: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(HEADER_ALIASES) as Column[]) {
    const index = headers.findIndex((h) =>
      (HEADER_ALIASES[column] as readonly string[]).includes(h),
    );
    if (index !== -1) columns[column] = index;
  }

  const hasNames =
    columns.fullName !== undefined || columns.lastName !== undefined;
  if (!hasNames) {
    return {
      trainees,
      errors: [
        {
          line: headerIndex + 1,
          message:
            "Colonnes introuvables : la première ligne doit contenir « Nom » et « Prénom », ou « Nom complet ».",
        },
      ],
    };
  }

  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const get = (column: Column) =>
      columns[column] === undefined ? "" : cellToString(row[columns[column]]);

    if (row.every((c) => cellToString(c) === "")) continue;

    const fullName =
      get("fullName") ||
      [get("firstName"), get("lastName")].filter(Boolean).join(" ");
    const email = get("email").toLowerCase() || null;

    if (!fullName) {
      errors.push({ line, message: "Nom du stagiaire manquant." });
      continue;
    }
    if (email && !EMAIL_RE.test(email)) {
      errors.push({ line, message: `Adresse email invalide : « ${email} ».` });
      continue;
    }
    const key = email ?? fullName.toLowerCase();
    if (seen.has(key)) {
      errors.push({ line, message: `Doublon dans le fichier : « ${fullName} ».` });
      continue;
    }
    seen.add(key);
    trainees.push({ line, fullName, email });
  }

  if (trainees.length === 0 && errors.length === 0) {
    errors.push({ line: headerIndex + 2, message: "Aucun stagiaire trouvé sous la ligne d'en-tête." });
  }
  return { trainees, errors };
}

/** Browser-side entry point: reads a File chosen in an <input type="file">. */
export async function parseTraineeFile(file: File): Promise<TraineeParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = (await readSheet(file)) as Cell[][];
    return rowsToTrainees(rows);
  }

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
      skipEmptyLines: false,
    });
    return rowsToTrainees(parsed.data);
  }

  return {
    trainees: [],
    errors: [{ line: 0, message: "Format non pris en charge : utilisez un fichier .csv ou .xlsx." }],
  };
}
