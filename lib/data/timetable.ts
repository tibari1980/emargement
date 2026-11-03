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
let lastSlotsFetchAt = 0;
let inFlightSlotsPromise: Promise<TimetableSlot[]> | null = null;

export function invalidateSlotsCache(): void {
  lastSlotsFetchAt = 0;
  inFlightSlotsPromise = null;
}

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

/**
 * Deduplicates slots on the same weekly schedule (formationId + weekday + startTime + endTime).
 * Prevents identical double slots from being displayed or processed.
 */
export function deduplicateSlotsList(list: TimetableSlot[]): TimetableSlot[] {
  const seen = new Map<string, TimetableSlot>();
  for (const slot of list) {
    const key = `${slot.formationId}_${slot.weekday}_${slot.startTime}_${slot.endTime}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, slot);
    } else {
      // Prioritize the slot with open validity (validTo === null)
      if (!slot.validTo && existing.validTo) {
        seen.set(key, slot);
      }
    }
  }
  return Array.from(seen.values());
}

function filterSlots(
  all: TimetableSlot[],
  filter: { formationId?: string; trainerId?: string } = {},
): TimetableSlot[] {
  const filtered = all.filter((s) => {
    if (filter.formationId && s.formationId !== filter.formationId) return false;
    if (filter.trainerId && s.trainerId !== filter.trainerId) return false;
    return true;
  });
  return sortSlots(deduplicateSlotsList(filtered));
}

/**
 * Returns slots synchronously (0ms) from in-memory or localStorage cache.
 */
export function getInitialSlots(filter: { formationId?: string; trainerId?: string } = {}): TimetableSlot[] {
  const localMap = loadPersistedSlots();
  return filterSlots(Array.from(localMap.values()), filter);
}

/** Slots of a formation, of a trainer, or every slot. */
export async function listSlots(filter: { formationId?: string; trainerId?: string } = {}): Promise<TimetableSlot[]> {
  const localMap = loadPersistedSlots();
  if (Date.now() - lastSlotsFetchAt < 60_000 && localMap.size > 0) {
    return filterSlots(Array.from(localMap.values()), filter);
  }

  if (!inFlightSlotsPromise) {
    inFlightSlotsPromise = (async () => {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 900));
        const snap = await Promise.race([getDocs(slots()), timeout]);
        const list = sortSlots(snap.docs.map((d) => withId<TimetableSlot>(d)));
        lastSlotsFetchAt = Date.now();
        if (list.length > 0) {
          list.forEach((s) => {
            localMap.set(s.id, s);
            localSlotsMap.set(s.id, s);
          });
          savePersistedSlots(localMap);
        }
      } catch (err) {
        console.warn("listSlots failed or timetableSlots empty:", err);
        lastSlotsFetchAt = Date.now();
      }
      return Array.from(localMap.values());
    })().finally(() => {
      inFlightSlotsPromise = null;
    });
  }

  const all = await inFlightSlotsPromise;
  return filterSlots(all, filter);
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

/**
 * Creates multiple timetable slots in a single audited batch operation.
 */
export async function createSlotsBatch(
  actor: Actor,
  slotsList: SlotInput[],
  summary: string,
): Promise<string[]> {
  if (!slotsList.length) return [];
  const localMap = loadPersistedSlots();
  const createdIds: string[] = [];
  const entriesToSet: { ref: any; data: SlotInput }[] = [];

  for (const s of slotsList) {
    const ref = doc(slots());
    const newSlot: TimetableSlot = { id: ref.id, ...s };
    localMap.set(ref.id, newSlot);
    localSlotsMap.set(ref.id, newSlot);
    createdIds.push(ref.id);
    entriesToSet.push({ ref, data: s });
  }
  savePersistedSlots(localMap);

  await auditedBatch(
    actor,
    {
      action: "timetable.batch_create",
      entityType: "timetableSlot",
      entityId: createdIds[0] || "batch",
      summary,
    },
    (batch, lastAuditId) => {
      for (const entry of entriesToSet) {
        batch.set(entry.ref, { ...entry.data, lastAuditId });
      }
    },
  );

  return createdIds;
}

/**
 * Duplicates a single slot to multiple other weekdays in one operation.
 */
export async function duplicateSlotToDays(
  actor: Actor,
  baseSlot: SlotInput,
  additionalDays: number[],
  label: string,
): Promise<string[]> {
  const uniqueDays = [...new Set(additionalDays)].filter((d) => d !== baseSlot.weekday && d >= 1 && d <= 5);
  if (!uniqueDays.length) return [];

  const slotsToCreate: SlotInput[] = uniqueDays.map((weekday) => ({
    ...baseSlot,
    weekday: weekday as any,
  }));

  const daysLabel = uniqueDays.map((d) => WEEKDAY_LABELS[d as keyof typeof WEEKDAY_LABELS]).join(", ");
  const summary = `Duplication du créneau ${baseSlot.startTime}–${baseSlot.endTime} vers ${daysLabel} : ${label}`;

  return createSlotsBatch(actor, slotsToCreate, summary);
}

/**
 * Duplicates every slot of a source formation towards a target formation.
 */
export async function duplicateWeekToFormation(
  actor: Actor,
  sourceSlots: TimetableSlot[],
  targetFormationId: string,
  options: {
    targetFormationTitle?: string;
    validFrom?: string;
    validTo?: string | null;
  } = {},
): Promise<number> {
  if (!sourceSlots.length) return 0;

  const slotsToCreate: SlotInput[] = sourceSlots.map((s) => ({
    formationId: targetFormationId,
    subjectId: s.subjectId,
    trainerId: s.trainerId,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || "",
    validFrom: options.validFrom || s.validFrom,
    validTo: options.validTo !== undefined ? options.validTo : s.validTo,
  }));

  const targetName = options.targetFormationTitle || targetFormationId;
  const summary = `Duplication de la semaine type (${slotsToCreate.length} créneaux) vers la formation ${targetName}`;

  const created = await createSlotsBatch(actor, slotsToCreate, summary);
  return created.length;
}

/**
 * Updates the validity period (validFrom and optionally validTo) for all slots of a formation.
 * For example: apply to the entire current month (sets validFrom to the 1st of current month).
 */
export async function applyWeekValidityPeriod(
  actor: Actor,
  formationId: string,
  validFrom: string,
  validTo: string | null = null,
  options: { formationTitle?: string } = {},
): Promise<number> {
  const localMap = loadPersistedSlots();
  const formationSlots = Array.from(localMap.values()).filter((s) => s.formationId === formationId);
  if (!formationSlots.length) return 0;

  for (const s of formationSlots) {
    const updated: TimetableSlot = { ...s, validFrom, validTo };
    localMap.set(s.id, updated);
    localSlotsMap.set(s.id, updated);
  }
  savePersistedSlots(localMap);

  await auditedBatch(
    actor,
    {
      action: "timetable.batch_validity_update",
      entityType: "timetableSlot",
      entityId: formationId,
      summary: `Application de la validité (${validFrom} à ${validTo ?? "permanent"}) sur ${formationSlots.length} créneau(x) de ${options.formationTitle || formationId}`,
    },
    (batch, lastAuditId) => {
      for (const s of formationSlots) {
        batch.update(doc(slots(), s.id), { validFrom, validTo, lastAuditId });
      }
    },
  );

  invalidateSlotsCache();
  return formationSlots.length;
}

/**
 * Clones/applies an existing week structure to a specific month or date range.
 * Perfect for monthly module planning!
 */
export async function cloneWeekForPeriod(
  actor: Actor,
  sourceSlots: TimetableSlot[],
  validFrom: string,
  validTo: string,
  options: { formationTitle?: string } = {},
): Promise<number> {
  if (!sourceSlots.length) return 0;

  const slotsToCreate: SlotInput[] = sourceSlots.map((s) => ({
    formationId: s.formationId,
    subjectId: s.subjectId,
    trainerId: s.trainerId,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || "",
    validFrom,
    validTo,
  }));

  const name = options.formationTitle || "formation";
  const summary = `Clonage de l'emploi du temps (${slotsToCreate.length} créneaux) du ${validFrom} au ${validTo} pour ${name}`;

  const created = await createSlotsBatch(actor, slotsToCreate, summary);
  return created.length;
}

/**
 * Generates the official CFRP 35h standard weekly grid (09:00–12:30 & 13:30–17:00, Mon–Fri).
 */
export async function generateStandardWeekSlots(
  actor: Actor,
  formationId: string,
  defaultSubjectId: string,
  defaultTrainerId: string,
  options: {
    formationTitle?: string;
    validFrom?: string;
    validTo?: string | null;
    room?: string;
    morningStart?: string;
    morningEnd?: string;
    afternoonStart?: string;
    afternoonEnd?: string;
  } = {},
): Promise<number> {
  const weekdays = [1, 2, 3, 4, 5] as const;
  const slotsToCreate: SlotInput[] = [];

  const morningStart = options.morningStart || "09:00";
  const morningEnd = options.morningEnd || "12:30";
  const afternoonStart = options.afternoonStart || "13:30";
  const afternoonEnd = options.afternoonEnd || "17:00";

  for (const weekday of weekdays) {
    // Matin : entrée et sortie personnalisées
    slotsToCreate.push({
      formationId,
      subjectId: defaultSubjectId,
      trainerId: defaultTrainerId,
      weekday,
      startTime: morningStart,
      endTime: morningEnd,
      room: options.room || "",
      validFrom: options.validFrom || new Date().toISOString().slice(0, 10),
      validTo: options.validTo ?? null,
    });
    // Après-midi : entrée et sortie personnalisées
    slotsToCreate.push({
      formationId,
      subjectId: defaultSubjectId,
      trainerId: defaultTrainerId,
      weekday,
      startTime: afternoonStart,
      endTime: afternoonEnd,
      room: options.room || "",
      validFrom: options.validFrom || new Date().toISOString().slice(0, 10),
      validTo: options.validTo ?? null,
    });
  }

  const name = options.formationTitle || formationId;
  const summary = `Génération de la grille hebdomadaire (${morningStart}–${morningEnd} et ${afternoonStart}–${afternoonEnd}) pour ${name}`;

  const created = await createSlotsBatch(actor, slotsToCreate, summary);
  return created.length;
}

/**
 * Detects and purges duplicate timetable slots in Firestore and local storage.
 */
export async function cleanupDuplicateSlots(
  actor: Actor,
  formationId?: string,
): Promise<number> {
  const localMap = loadPersistedSlots();
  const allRaw = Array.from(localMap.values()).filter((s) => !formationId || s.formationId === formationId);
  const seenKeys = new Set<string>();
  const duplicateSlotsToDelete: TimetableSlot[] = [];

  const sorted = sortSlots([...allRaw]);
  for (const s of sorted) {
    const key = `${s.formationId}_${s.weekday}_${s.startTime}_${s.endTime}`;
    if (seenKeys.has(key)) {
      duplicateSlotsToDelete.push(s);
    } else {
      seenKeys.add(key);
    }
  }

  if (!duplicateSlotsToDelete.length) return 0;

  for (const dup of duplicateSlotsToDelete) {
    localMap.delete(dup.id);
    localSlotsMap.delete(dup.id);
  }
  savePersistedSlots(localMap);

  for (const dup of duplicateSlotsToDelete) {
    try {
      await auditedBatch(
        actor,
        {
          action: "timetable.delete_duplicate",
          entityType: "timetableSlot",
          entityId: dup.id,
          summary: `Purge du doublon horaire ${describe(dup)} (${dup.id})`,
        },
        (batch) => batch.delete(doc(slots(), dup.id)),
        { entryId: `del_dup_${dup.id}` },
      );
    } catch (err) {
      console.warn("Failed to delete remote duplicate slot:", dup.id, err);
    }
  }

  invalidateSlotsCache();
  return duplicateSlotsToDelete.length;
}
