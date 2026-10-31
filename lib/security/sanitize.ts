/**
 * Data Sanitization & Anti-Injection Utilities.
 * Mitigates XSS, Stored HTML, and Spreadsheet Formula Injection (CWE-1236).
 */

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Sanitizes a cell value before writing to Excel or CSV.
 * Prevents CSV/Spreadsheet Formula Injection (CWE-1236) where attackers inject
 * commands like =cmd|' /C calc'!A0 or malicious hyperlink formulas.
 */
export function sanitizeForSpreadsheet<T>(value: T): T {
  if (typeof value !== "string") {
    return value;
  }

  const str = value.trim();
  if (str.length === 0) {
    return value;
  }

  // If the cell begins with an executable formula operator, prepend a single quote
  const firstChar = str.charAt(0);
  if (FORMULA_PREFIXES.includes(firstChar)) {
    return `'${str}` as unknown as T;
  }

  return str as unknown as T;
}

/**
 * Sanitizes an array of cell values or an object for spreadsheet export.
 */
export function sanitizeRow<T extends unknown[]>(row: T): T {
  return row.map((cell) => sanitizeForSpreadsheet(cell)) as T;
}

/**
 * Sanitizes a plain text user input (e.g. name, room, note, phone).
 * Strips null bytes, unprintable control characters, and leading/trailing whitespace.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  // Strip control chars except newline / tab, trim
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}
