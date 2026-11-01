import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import {
  sessionOverrideId,
  type SessionCancellationReason,
  type SessionOverride,
  type TimetableSlot,
} from "@/lib/domain/types";
import { auditedBatch, type Actor } from "./audit";
import { COLLECTIONS, withId } from "./db";

const overridesRef = () => collection(getDb(), COLLECTIONS.sessionOverrides);

const LOCAL_OVERRIDES_KEY = "avh_persisted_session_overrides_v2";
const localOverridesMap = new Map<string, SessionOverride>();
const dateListeners = new Map<string, Set<(overrides: SessionOverride[]) => void>>();

function loadPersistedOverrides(): Map<string, SessionOverride> {
  const map = new Map<string, SessionOverride>();
  localOverridesMap.forEach((v, k) => map.set(k, v));
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
    if (raw) {
      const list: SessionOverride[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((o) => {
          map.set(o.id, o);
          localOverridesMap.set(o.id, o);
        });
      }
    }
  } catch {}
  return map;
}

function savePersistedOverrides(map: Map<string, SessionOverride>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

function notifyDateListeners(date: string): void {
  const listeners = dateListeners.get(date);
  if (!listeners || listeners.size === 0) return;
  const all = Array.from(loadPersistedOverrides().values()).filter((o) => o.date === date);
  listeners.forEach((cb) => cb(all));
}

/**
 * Retrieves the session override for a specific slot and date.
 */
export async function getSessionOverride(slotId: string, date: string): Promise<SessionOverride | null> {
  const id = sessionOverrideId(slotId, date);
  const localMap = loadPersistedOverrides();
  try {
    const snap = await getDoc(doc(getDb(), COLLECTIONS.sessionOverrides, id));
    if (snap.exists()) {
      const item = withId<SessionOverride>(snap);
      localMap.set(id, item);
      localOverridesMap.set(id, item);
      savePersistedOverrides(localMap);
      return item;
    }
  } catch {}
  return localMap.get(id) ?? null;
}

/**
 * Lists all session overrides for a given date.
 */
export async function listSessionOverridesForDate(date: string): Promise<SessionOverride[]> {
  const localMap = loadPersistedOverrides();
  try {
    const snap = await getDocs(query(overridesRef(), where("date", "==", date)));
    const list = snap.docs.map((d) => withId<SessionOverride>(d));
    if (list.length > 0) {
      list.forEach((o) => {
        localMap.set(o.id, o);
        localOverridesMap.set(o.id, o);
      });
      savePersistedOverrides(localMap);
    }
  } catch (err) {
    console.warn("listSessionOverridesForDate failed:", err);
  }
  return Array.from(localMap.values()).filter((o) => o.date === date);
}

/**
 * Lists all session overrides for a given month ("YYYY-MM").
 * Used for monthly hours calculations and ASP reports.
 */
export async function listSessionOverridesForMonth(month: string, formationId?: string): Promise<SessionOverride[]> {
  const localMap = loadPersistedOverrides();
  try {
    const constraints = [where("month", "==", month)];
    if (formationId) {
      constraints.push(where("formationId", "==", formationId));
    }
    const snap = await getDocs(query(overridesRef(), ...constraints));
    const list = snap.docs.map((d) => withId<SessionOverride>(d));
    if (list.length > 0) {
      list.forEach((o) => {
        localMap.set(o.id, o);
        localOverridesMap.set(o.id, o);
      });
      savePersistedOverrides(localMap);
    }
  } catch (err) {
    console.warn("listSessionOverridesForMonth failed:", err);
  }
  return Array.from(localMap.values()).filter(
    (o) => o.month === month && (!formationId || o.formationId === formationId),
  );
}

/**
 * Real-time dynamic subscription to session overrides for a specific date.
 */
export function subscribeSessionOverridesForDate(
  date: string,
  onData: (overrides: SessionOverride[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!dateListeners.has(date)) {
    dateListeners.set(date, new Set());
  }
  dateListeners.get(date)!.add(onData);

  // Immediately emit persisted overrides for instant UI rendering
  const initial = Array.from(loadPersistedOverrides().values()).filter((o) => o.date === date);
  onData(initial);

  let unsubFirestore: Unsubscribe = () => {};
  try {
    const q = query(overridesRef(), where("date", "==", date));
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        const localMap = loadPersistedOverrides();
        snap.docs.forEach((d) => {
          const item = withId<SessionOverride>(d);
          localMap.set(item.id, item);
          localOverridesMap.set(item.id, item);
        });
        savePersistedOverrides(localMap);
        onData(Array.from(localMap.values()).filter((o) => o.date === date));
      },
      (err) => {
        console.warn("subscribeSessionOverridesForDate error:", err);
        onData(Array.from(loadPersistedOverrides().values()).filter((o) => o.date === date));
        onError?.(err);
      },
    );
  } catch (err) {
    onError?.(err);
  }

  return () => {
    dateListeners.get(date)?.delete(onData);
    unsubFirestore();
  };
}

/**
 * Assigns a substitute trainer for a specific slot and date due to primary trainer absence.
 */
export async function setSessionSubstituteTrainer(
  actor: Actor,
  slot: TimetableSlot,
  date: string,
  substituteTrainerId: string,
  substituteTrainerName: string,
  subjectTitle?: string,
): Promise<void> {
  const id = sessionOverrideId(slot.id, date);
  const month = date.slice(0, 7);
  const summary = `Assignation d'un remplaçant (${substituteTrainerName}) pour la séance du ${date} (${slot.startTime}-${slot.endTime}${subjectTitle ? ` : ${subjectTitle}` : ""})`;

  const localMap = loadPersistedOverrides();
  const overrideObj: SessionOverride = {
    id,
    slotId: slot.id,
    date,
    month,
    formationId: slot.formationId,
    subjectId: slot.subjectId,
    originalTrainerId: slot.trainerId,
    substituteTrainerId,
    substituteTrainerName,
    isSelfStudyTP: false,
    supervisorId: null,
    supervisorName: null,
    supervisorRole: null,
    selfStudyNote: null,
    isCancelled: false,
    cancellationReason: null,
    cancellationNote: null,
    updatedBy: actor.id,
    updatedAt: new Date().toISOString(),
    lastAuditId: "local",
  };
  localMap.set(id, overrideObj);
  localOverridesMap.set(id, overrideObj);
  savePersistedOverrides(localMap);
  notifyDateListeners(date);

  await auditedBatch(
    actor,
    {
      action: "session.substitute",
      entityType: "sessionOverride",
      entityId: id,
      summary,
      changes: {
        substituteTrainerId: { from: null, to: substituteTrainerId },
        substituteTrainerName: { from: null, to: substituteTrainerName },
      },
    },
    (batch, lastAuditId) => {
      batch.set(
        doc(getDb(), COLLECTIONS.sessionOverrides, id),
        {
          slotId: slot.id,
          date,
          month,
          formationId: slot.formationId,
          subjectId: slot.subjectId,
          originalTrainerId: slot.trainerId,
          substituteTrainerId,
          substituteTrainerName,
          isCancelled: false,
          cancellationReason: null,
          cancellationNote: null,
          updatedBy: actor.id,
          updatedAt: serverTimestamp(),
          lastAuditId,
        },
        { merge: true },
      );
    },
  );
}

/**
 * Switches a session into Self-Study / Practical Work (TP / Travail libre)
 * supervised by the Secretariat or Pedagogical Lead due to primary trainer absence.
 * Trainees are present at the center working on exercises; attendance is taken directly by the supervisor.
 * Trainee presence hours are 100% validated.
 */
export async function setSessionSelfStudyTP(
  actor: Actor,
  slot: TimetableSlot,
  date: string,
  note: string = "Travaux pratiques / Travail libre encadré en autonomie",
  subjectTitle?: string,
): Promise<void> {
  const id = sessionOverrideId(slot.id, date);
  const month = date.slice(0, 7);
  const summary = `Basculement en Travaux Pratiques / Travail libre supervisé par ${actor.fullName} pour la séance du ${date} (${slot.startTime}-${slot.endTime}${subjectTitle ? ` : ${subjectTitle}` : ""}) : ${note}`;

  const localMap = loadPersistedOverrides();
  const overrideObj: SessionOverride = {
    id,
    slotId: slot.id,
    date,
    month,
    formationId: slot.formationId,
    subjectId: slot.subjectId,
    originalTrainerId: slot.trainerId,
    substituteTrainerId: null,
    substituteTrainerName: null,
    isSelfStudyTP: true,
    supervisorId: actor.id,
    supervisorName: actor.fullName,
    supervisorRole: actor.role,
    selfStudyNote: note,
    isCancelled: false,
    cancellationReason: null,
    cancellationNote: null,
    updatedBy: actor.id,
    updatedAt: new Date().toISOString(),
    lastAuditId: "local",
  };
  localMap.set(id, overrideObj);
  localOverridesMap.set(id, overrideObj);
  savePersistedOverrides(localMap);
  notifyDateListeners(date);

  await auditedBatch(
    actor,
    {
      action: "session.self_study_tp",
      entityType: "sessionOverride",
      entityId: id,
      summary,
      changes: {
        isSelfStudyTP: { from: false, to: true },
        supervisorId: { from: null, to: actor.id },
        supervisorName: { from: null, to: actor.fullName },
        supervisorRole: { from: null, to: actor.role },
        selfStudyNote: { from: null, to: note },
      },
    },
    (batch, lastAuditId) => {
      batch.set(
        doc(getDb(), COLLECTIONS.sessionOverrides, id),
        {
          slotId: slot.id,
          date,
          month,
          formationId: slot.formationId,
          subjectId: slot.subjectId,
          originalTrainerId: slot.trainerId,
          substituteTrainerId: null,
          substituteTrainerName: null,
          isSelfStudyTP: true,
          supervisorId: actor.id,
          supervisorName: actor.fullName,
          supervisorRole: actor.role,
          selfStudyNote: note,
          isCancelled: false,
          cancellationReason: null,
          cancellationNote: null,
          updatedBy: actor.id,
          updatedAt: serverTimestamp(),
          lastAuditId,
        },
        { merge: true },
      );
    },
  );
}

/**
 * Cancels a session due to trainer absence (or administrative reason).
 * Protects trainee attendance: hours are exempted and NOT counted as unexcused absences.
 */
export async function cancelSessionForTrainerAbsence(
  actor: Actor,
  slot: TimetableSlot,
  date: string,
  reason: SessionCancellationReason = "trainer_absent",
  note: string = "Absence du formateur titulaire",
  subjectTitle?: string,
): Promise<void> {
  const id = sessionOverrideId(slot.id, date);
  const month = date.slice(0, 7);
  const summary = `Annulation de la séance du ${date} (${slot.startTime}-${slot.endTime}${subjectTitle ? ` : ${subjectTitle}` : ""}) pour ${note}`;

  const localMap = loadPersistedOverrides();
  const overrideObj: SessionOverride = {
    id,
    slotId: slot.id,
    date,
    month,
    formationId: slot.formationId,
    subjectId: slot.subjectId,
    originalTrainerId: slot.trainerId,
    substituteTrainerId: null,
    substituteTrainerName: null,
    isSelfStudyTP: false,
    supervisorId: null,
    supervisorName: null,
    supervisorRole: null,
    selfStudyNote: null,
    isCancelled: true,
    cancellationReason: reason,
    cancellationNote: note,
    updatedBy: actor.id,
    updatedAt: new Date().toISOString(),
    lastAuditId: "local",
  };
  localMap.set(id, overrideObj);
  localOverridesMap.set(id, overrideObj);
  savePersistedOverrides(localMap);
  notifyDateListeners(date);

  await auditedBatch(
    actor,
    {
      action: "session.cancel",
      entityType: "sessionOverride",
      entityId: id,
      summary,
      changes: {
        isCancelled: { from: false, to: true },
        cancellationReason: { from: null, to: reason },
        cancellationNote: { from: null, to: note },
      },
    },
    (batch, lastAuditId) => {
      batch.set(
        doc(getDb(), COLLECTIONS.sessionOverrides, id),
        {
          slotId: slot.id,
          date,
          month,
          formationId: slot.formationId,
          subjectId: slot.subjectId,
          originalTrainerId: slot.trainerId,
          isCancelled: true,
          cancellationReason: reason,
          cancellationNote: note,
          updatedBy: actor.id,
          updatedAt: serverTimestamp(),
          lastAuditId,
        },
        { merge: true },
      );
    },
  );
}

/**
 * Restores a previously cancelled or substituted session to its normal schedule.
 */
export async function restoreNormalSession(
  actor: Actor,
  slot: TimetableSlot,
  date: string,
): Promise<void> {
  const id = sessionOverrideId(slot.id, date);
  const summary = `Rétablissement du créneau normal du ${date} (${slot.startTime}-${slot.endTime})`;

  const localMap = loadPersistedOverrides();
  localMap.delete(id);
  localOverridesMap.delete(id);
  savePersistedOverrides(localMap);
  notifyDateListeners(date);

  await auditedBatch(
    actor,
    {
      action: "session.restore",
      entityType: "sessionOverride",
      entityId: id,
      summary,
    },
    (batch) => {
      batch.delete(doc(getDb(), COLLECTIONS.sessionOverrides, id));
    },
  );
}
