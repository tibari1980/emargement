import { collection, doc, getDocs } from "firebase/firestore";
import { formatShortDate } from "@/lib/core/dates";
import { getDb } from "@/lib/core/firebase";
import type { Holiday } from "@/lib/domain/types";
import { auditedBatch, type Actor } from "./audit";
import { COLLECTIONS, withId } from "./db";

export type HolidayInput = Omit<Holiday, "id" | "lastAuditId">;

const holidays = () => collection(getDb(), COLLECTIONS.holidays);

export async function listHolidays(): Promise<Holiday[]> {
  const snap = await getDocs(holidays());
  return snap.docs.map((d) => withId<Holiday>(d)).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function addHolidays(actor: Actor, list: HolidayInput[]): Promise<void> {
  const summary =
    list.length === 1
      ? `Ajout au calendrier : ${list[0].title} (${formatShortDate(list[0].startDate)}${list[0].endDate !== list[0].startDate ? ` au ${formatShortDate(list[0].endDate)}` : ""})`
      : `Ajout de ${list.length} jours de fermeture au calendrier`;
  await auditedBatch(actor, { action: "holiday.create", entityType: "holiday", entityId: "batch", summary }, (batch, lastAuditId) => {
    for (const h of list) batch.set(doc(holidays()), { ...h, lastAuditId });
  });
}

export async function deleteHoliday(actor: Actor, holiday: Holiday): Promise<void> {
  await auditedBatch(
    actor,
    { action: "holiday.delete", entityType: "holiday", entityId: holiday.id, summary: `Suppression du calendrier : ${holiday.title}` },
    (batch) => batch.delete(doc(holidays(), holiday.id)),
    { entryId: `del_${holiday.id}` },
  );
}
