import { addDays, toIsoDate } from "@/lib/core/dates";

export interface PublicHoliday {
  title: string;
  date: string; // "YYYY-MM-DD"
}

/** Easter Sunday (Meeus/Jones/Butcher algorithm, Gregorian calendar). */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate(new Date(year, month - 1, day));
}

/** The 11 public holidays observed in mainland France. */
export function frenchPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  return [
    { title: "Jour de l'an", date: `${year}-01-01` },
    { title: "Lundi de Pâques", date: addDays(easter, 1) },
    { title: "Fête du Travail", date: `${year}-05-01` },
    { title: "Victoire 1945", date: `${year}-05-08` },
    { title: "Ascension", date: addDays(easter, 39) },
    { title: "Lundi de Pentecôte", date: addDays(easter, 50) },
    { title: "Fête nationale", date: `${year}-07-14` },
    { title: "Assomption", date: `${year}-08-15` },
    { title: "Toussaint", date: `${year}-11-01` },
    { title: "Armistice 1918", date: `${year}-11-11` },
    { title: "Noël", date: `${year}-12-25` },
  ];
}
