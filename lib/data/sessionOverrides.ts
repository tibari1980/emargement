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

/**
 * Retrieves the session override for a specific slot and date.
 */
export async function getSessionOverride(slotId: string, date: string): Promise<SessionOverride | null> {
  const id = sessionOverrideId(slotId, date);
  const snap = await getDoc(doc(getDb(), COLLECTIONS.sessionOverrides, id));
  return snap.exists() ? withId<SessionOverride>(snap) : null;
}

/**
 * Lists all session overrides for a given date.
 */
export async function listSessionOverridesForDate(date: string): Promise<SessionOverride[]> {
  try {
    const snap = await getDocs(query(overridesRef(), where("date", "==", date)));
    return snap.docs.map((d) => withId<SessionOverride>(d));
  } catch (err) {
    console.warn("listSessionOverridesForDate failed:", err);
    return [];
  }
}

/**
 * Lists all session overrides for a given month ("YYYY-MM").
 * Used for monthly hours calculations and ASP reports.
 */
export async function listSessionOverridesForMonth(month: string, formationId?: string): Promise<SessionOverride[]> {
  try {
    const constraints = [where("month", "==", month)];
    if (formationId) {
      constraints.push(where("formationId", "==", formationId));
    }
    const snap = await getDocs(query(overridesRef(), ...constraints));
    return snap.docs.map((d) => withId<SessionOverride>(d));
  } catch (err) {
    console.warn("listSessionOverridesForMonth failed:", err);
    return [];
  }
}

/**
 * Real-time dynamic subscription to session overrides for a specific date.
 */
export function subscribeSessionOverridesForDate(
  date: string,
  onData: (overrides: SessionOverride[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(overridesRef(), where("date", "==", date));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => withId<SessionOverride>(d)));
    },
    (err) => {
      console.warn("subscribeSessionOverridesForDate error:", err);
      onError?.(err);
    },
  );
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
