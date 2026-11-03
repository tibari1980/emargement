// Calendar helpers working on local "YYYY-MM-DD" strings.
// Dates are never converted through UTC (toISOString) to avoid off-by-one
// errors around midnight and daylight saving time changes.

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toIsoDate(parseIsoDate(iso)) === iso;
}

/* ------------------------------------------------------------------ clock */
// The training centre runs on Paris time, whatever the device's time zone.
// The device clock can also be wrong (or deliberately changed), so it is
// corrected by an offset measured against the server (see syncServerClock).

export const APP_TIME_ZONE = "Europe/Paris";

let clockOffsetMs = 0;

/** Difference (ms) between the server clock and the device clock. */
export function setClockOffset(ms: number): void {
  clockOffsetMs = Number.isFinite(ms) ? ms : 0;
}

/** Current instant, corrected with the server offset. */
export function currentInstant(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

const parisPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Date and time of an instant in Paris: { date: "YYYY-MM-DD", time: "HH:MM", seconds: "SS" }. */
export function parisParts(instant: Date = currentInstant()): { date: string; time: string; seconds: string } {
  const p: Record<string, string> = {};
  for (const part of parisPartsFormatter.formatToParts(instant)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}`, seconds: p.second };
}

/** Today in Paris ("YYYY-MM-DD"). */
export function todayIso(): string {
  return parisParts().date;
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Inclusive list of every day between two ISO dates. */
export function eachDay(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  for (let d = startIso; d <= endIso; d = addDays(d, 1)) days.push(d);
  return days;
}

export function isWeekend(iso: string): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

/** "YYYY-MM" → first and last day of that month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
}

export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** "09:45" → 585. Returns null for malformed input. */
export function timeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Current time in Paris ("HH:MM"). */
export function nowTime(): string {
  return parisParts().time;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

/** "2026-10-29" → "jeudi 29 octobre 2026" (read naturally by screen readers). */
export function formatLongDate(iso: string): string {
  return dateFormatter.format(parseIsoDate(iso));
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonth(month: string): string {
  return monthFormatter.format(parseIsoDate(`${month}-01`));
}

/** "09:45" → "9 h 45", spoken correctly by NVDA/JAWS. */
export function formatSpokenTime(time: string): string {
  const [h, m] = time.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** 7.5 → "7 h 30". */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${pad(m)}`;
}

/** Returns the Monday ("YYYY-MM-DD") of the week containing `iso`. */
export function getWeekMonday(iso: string): string {
  const d = parseIsoDate(iso);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(iso, diff);
}

const dayMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

/** "2026-11-03" → "3 nov." */
export function formatDayAndMonth(iso: string): string {
  return dayMonthFormatter.format(parseIsoDate(iso));
}
