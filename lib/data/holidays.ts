import { collection, doc, getDocs } from "firebase/firestore";
import { formatShortDate } from "@/lib/core/dates";
import { getDb } from "@/lib/core/firebase";
import type { Holiday } from "@/lib/domain/types";
import { auditedBatch, type Actor } from "./audit";
import { COLLECTIONS, withId } from "./db";

export type HolidayInput = Omit<Holiday, "id" | "lastAuditId">;

const holidays = () => collection(getDb(), COLLECTIONS.holidays);

export function getDemoHolidays(): Holiday[] {
  const y = new Date().getFullYear();
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const easterPlus = (n: number) => iso(new Date(y, month - 1, day + n));

  const list = [
    { title: "Jour de l'an", date: `${y}-01-01` },
    { title: "Lundi de Pâques", date: easterPlus(1) },
    { title: "Fête du Travail", date: `${y}-05-01` },
    { title: "Victoire 1945", date: `${y}-05-08` },
    { title: "Ascension", date: easterPlus(39) },
    { title: "Lundi de Pentecôte", date: easterPlus(50) },
    { title: "Fête nationale", date: `${y}-07-14` },
    { title: "Assomption", date: `${y}-08-15` },
    { title: "Toussaint", date: `${y}-11-01` },
    { title: "Armistice 1918", date: `${y}-11-11` },
    { title: "Noël", date: `${y}-12-25` },
  ];

  return list.map((item, idx) => ({
    id: `hol-${idx + 1}`,
    title: item.title,
    startDate: item.date,
    endDate: item.date,
    type: "holiday",
  }));
}

let cachedHolidays: Holiday[] | null = null;
let lastHolidaysFetch = 0;

export function getInitialHolidays(): Holiday[] {
  return cachedHolidays ?? getDemoHolidays();
}

export async function listHolidays(force = false): Promise<Holiday[]> {
  if (!force && cachedHolidays && Date.now() - lastHolidaysFetch < 60_000) {
    return cachedHolidays;
  }
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 800));
    const snap = await Promise.race([getDocs(holidays()), timeout]);
    const list = snap.docs
      .map((d) => withId<Holiday>(d))
      .sort((a, b) => (a?.startDate ?? "").localeCompare(b?.startDate ?? ""));
    lastHolidaysFetch = Date.now();
    if (list.length > 0) {
      cachedHolidays = list;
      return list;
    }
  } catch (err) {
    console.warn("listHolidays failed or empty:", err);
    lastHolidaysFetch = Date.now();
  }
  const fallback = getDemoHolidays();
  cachedHolidays = fallback;
  return fallback;
}

export async function addHolidays(actor: Actor, list: HolidayInput[]): Promise<void> {
  lastHolidaysFetch = 0;
  const summary =
    list.length === 1
      ? `Ajout au calendrier : ${list[0].title} (${formatShortDate(list[0].startDate)}${list[0].endDate !== list[0].startDate ? ` au ${formatShortDate(list[0].endDate)}` : ""})`
      : `Ajout de ${list.length} jours de fermeture au calendrier`;
  await auditedBatch(actor, { action: "holiday.create", entityType: "holiday", entityId: "batch", summary }, (batch, lastAuditId) => {
    for (const h of list) batch.set(doc(holidays()), { ...h, lastAuditId });
  });
}

export async function deleteHoliday(actor: Actor, holiday: Holiday): Promise<void> {
  lastHolidaysFetch = 0;
  await auditedBatch(
    actor,
    { action: "holiday.delete", entityType: "holiday", entityId: holiday.id, summary: `Suppression du calendrier : ${holiday.title}` },
    (batch) => batch.delete(doc(holidays(), holiday.id)),
    { entryId: `del_${holiday.id}` },
  );
}
