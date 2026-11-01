import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { WEEKDAY_LABELS, type TimetableSlot } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { COLLECTIONS, stripMeta, withId } from "./db";

export type SlotInput = Omit<TimetableSlot, "id" | "lastAuditId">;

const slots = () => collection(getDb(), COLLECTIONS.slots);
const sortSlots = (list: TimetableSlot[]) =>
  list.sort(
    (a, b) =>
      ((a?.weekday ?? 0) - (b?.weekday ?? 0)) ||
      ((a?.startTime ?? "").localeCompare(b?.startTime ?? ""))
  );

// In-memory & localStorage slot storage for seamless offline / session updates
const localSlotsMap = new Map<string, TimetableSlot>();
const LOCAL_SLOTS_KEY = "avh_persisted_slots_v2";

function loadPersistedSlots(): Map<string, TimetableSlot> {
  const map = new Map<string, TimetableSlot>();
  localSlotsMap.forEach((v, k) => map.set(k, v));
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(LOCAL_SLOTS_KEY);
    if (raw) {
      const list: TimetableSlot[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((s) => {
          map.set(s.id, s);
          localSlotsMap.set(s.id, s);
        });
      }
    }
  } catch {}
  return map;
}

function savePersistedSlots(map: Map<string, TimetableSlot>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SLOTS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

/** Slots of a formation, of a trainer, or every slot. */
export async function listSlots(filter: { formationId?: string; trainerId?: string } = {}): Promise<TimetableSlot[]> {
  const localMap = loadPersistedSlots();
  try {
    const q = filter.formationId
      ? query(slots(), where("formationId", "==", filter.formationId))
      : filter.trainerId
        ? query(slots(), where("trainerId", "==", filter.trainerId))
        : slots();
    const snap = await getDocs(q);
    const list = sortSlots(snap.docs.map((d) => withId<TimetableSlot>(d)));
    if (list.length > 0) {
      list.forEach((s) => {
        localMap.set(s.id, s);
        localSlotsMap.set(s.id, s);
      });
      savePersistedSlots(localMap);
    }
  } catch (err) {
    console.warn("listSlots failed or timetableSlots empty:", err);
  }

  const all = Array.from(localMap.values());
  return sortSlots(
    all.filter((s) => {
      if (filter.formationId && s.formationId !== filter.formationId) return false;
      if (filter.trainerId && s.trainerId !== filter.trainerId) return false;
      return true;
    })
  );
}

const describe = (s: Pick<TimetableSlot, "weekday" | "startTime" | "endTime">) =>
  `${WEEKDAY_LABELS[s.weekday]} ${s.startTime}–${s.endTime}`;

export async function createSlot(actor: Actor, data: SlotInput, label: string): Promise<string> {
  const ref = doc(slots());
  const newSlot: TimetableSlot = { id: ref.id, ...data };
  const localMap = loadPersistedSlots();
  localMap.set(ref.id, newSlot);
  localSlotsMap.set(ref.id, newSlot);
  savePersistedSlots(localMap);
  await auditedBatch(
    actor,
    { action: "timetable.create", entityType: "timetableSlot", entityId: ref.id, summary: `Ajout du créneau ${describe(data)} : ${label}` },
    (batch, lastAuditId) => batch.set(ref, { ...data, lastAuditId }),
  );
  return ref.id;
}

export async function updateSlot(actor: Actor, slot: TimetableSlot, data: Partial<SlotInput>, label: string): Promise<void> {
  const editable = stripMeta({ ...data });
  const updatedSlot: TimetableSlot = { ...slot, ...editable };
  const localMap = loadPersistedSlots();
  localMap.set(slot.id, updatedSlot);
  localSlotsMap.set(slot.id, updatedSlot);
  savePersistedSlots(localMap);
  const changes = diffChanges(slot, editable, [
    "subjectId",
    "trainerId",
    "weekday",
    "startTime",
    "endTime",
    "room",
    "validFrom",
    "validTo",
  ]);
  if (!changes) return;
  await auditedBatch(
    actor,
    { action: "timetable.update", entityType: "timetableSlot", entityId: slot.id, summary: `Modification du créneau ${describe(slot)} : ${label}`, changes },
    (batch, lastAuditId) => batch.update(doc(slots(), slot.id), { ...editable, lastAuditId }),
  );
}

/**
 * Deletes a slot created by mistake. To stop a slot that has already been
 * taught, set its end date instead: past attendance stays attached to it.
 */
export async function deleteSlot(actor: Actor, slot: TimetableSlot, label: string): Promise<void> {
  const localMap = loadPersistedSlots();
  localMap.delete(slot.id);
  localSlotsMap.delete(slot.id);
  savePersistedSlots(localMap);
  await auditedBatch(
    actor,
    { action: "timetable.delete", entityType: "timetableSlot", entityId: slot.id, summary: `Suppression du créneau ${describe(slot)} : ${label}` },
    (batch) => batch.delete(doc(slots(), slot.id)),
    { entryId: `del_${slot.id}` },
  );
}
