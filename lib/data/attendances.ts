import { collection, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { formatShortDate } from "@/lib/core/dates";
import { getDb } from "@/lib/core/firebase";
import {
  attendanceId,
  ATTENDANCE_STATUS_LABELS,
  type Attendance,
  type AttendanceStatus,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";
import { auditedBatch, type Actor } from "./audit";
import { chunk, COLLECTIONS, withId } from "./db";

const attendances = () => collection(getDb(), COLLECTIONS.attendances);

const localAttendancesMap = new Map<string, Attendance>();
const LOCAL_ATTENDANCES_KEY = "avh_persisted_attendances_v2";

export function loadPersistedAttendances(): Map<string, Attendance> {
  const map = new Map<string, Attendance>();
  localAttendancesMap.forEach((v, k) => map.set(k, v));
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(LOCAL_ATTENDANCES_KEY);
    if (raw) {
      const list: Attendance[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((a) => {
          map.set(a.id, a);
          localAttendancesMap.set(a.id, a);
        });
      }
    }
  } catch {}
  return map;
}

export function savePersistedAttendances(map: Map<string, Attendance>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_ATTENDANCES_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

/** Records of one session (slot × date). */
export async function listForSession(slotId: string, date: string): Promise<Attendance[]> {
  const localMap = loadPersistedAttendances();
  try {
    const snap = await getDocs(query(attendances(), where("slotId", "==", slotId), where("date", "==", date)));
    const list = snap.docs.map((d) => withId<Attendance>(d));
    if (list.length > 0) {
      list.forEach((a) => {
        localMap.set(a.id, a);
        localAttendancesMap.set(a.id, a);
      });
      return list;
    }
  } catch (err) {
    console.warn("listForSession failed:", err);
  }
  return Array.from(localMap.values()).filter((a) => a.slotId === slotId && a.date === date);
}

/** Records of a formation over whole months ("YYYY-MM"). Equality filters only: no composite index. */
export async function listForFormation(formationId: string, months: string[]): Promise<Attendance[]> {
  const uniqueMonths = [...new Set(months)].filter(Boolean);
  if (!uniqueMonths.length) return [];
  const localMap = loadPersistedAttendances();
  try {
    const results = await Promise.all(
      chunk(uniqueMonths, 30).map((part) =>
        getDocs(query(attendances(), where("formationId", "==", formationId), where("month", "in", part))),
      ),
    );
    const list = results.flatMap((s) => s.docs.map((d) => withId<Attendance>(d)));
    if (list.length > 0) {
      list.forEach((a) => {
        localMap.set(a.id, a);
        localAttendancesMap.set(a.id, a);
      });
      return Array.from(localMap.values()).filter(
        (a) => a.formationId === formationId && uniqueMonths.includes(a.month)
      );
    }
  } catch (err) {
    console.warn("listForFormation failed:", err);
  }
  return Array.from(localMap.values()).filter(
    (a) => a.formationId === formationId && uniqueMonths.includes(a.month)
  );
}

export interface SessionRef {
  slot: TimetableSlot;
  date: string;
  /** For the journal, e.g. "Braille — Adaptation aux outils". */
  label: string;
}

export interface AttendanceEntry {
  trainee: Pick<UserProfile, "id" | "fullName">;
  status: AttendanceStatus;
  arrivalTime?: string | null;
  excuseReason?: string | null;
}

function record(actor: Actor, session: SessionRef, entry: AttendanceEntry, lastAuditId: string) {
  const { slot, date } = session;
  return {
    formationId: slot.formationId,
    slotId: slot.id,
    subjectId: slot.subjectId,
    trainerId: slot.trainerId,
    traineeId: entry.trainee.id,
    date,
    month: date.slice(0, 7),
    status: entry.status,
    arrivalTime: entry.status === "late" ? (entry.arrivalTime ?? null) : null,
    excuseReason: entry.status === "excused" ? (entry.excuseReason ?? null) : null,
    recordedBy: actor.id,
    updatedAt: serverTimestamp(),
    lastAuditId,
  };
}

/** Saves the attendance of one or several trainees for a session, as one audited operation. */
export async function saveAttendances(actor: Actor, session: SessionRef, entries: AttendanceEntry[]): Promise<void> {
  if (!entries.length) return;
  const localMap = loadPersistedAttendances();
  for (const entry of entries) {
    const id = attendanceId(session.slot.id, entry.trainee.id, session.date);
    const r = {
      formationId: session.slot.formationId,
      slotId: session.slot.id,
      subjectId: session.slot.subjectId,
      trainerId: session.slot.trainerId,
      traineeId: entry.trainee.id,
      date: session.date,
      month: session.date.slice(0, 7),
      status: entry.status,
      arrivalTime: entry.status === "late" ? (entry.arrivalTime ?? null) : null,
      excuseReason: entry.status === "excused" ? (entry.excuseReason ?? null) : null,
      recordedBy: actor.id,
      updatedAt: new Date().toISOString(),
      lastAuditId: "local",
      id,
    };
    localMap.set(id, r as any);
    localAttendancesMap.set(id, r as any);
  }
  savePersistedAttendances(localMap);

  try {
    const when = `${formatShortDate(session.date)} ${session.slot.startTime}`;
    const summary =
      entries.length === 1
        ? `Émargement ${session.label} (${when}) : ${entries[0].trainee.fullName} — ${ATTENDANCE_STATUS_LABELS[entries[0].status]}${
            entries[0].status === "late" && entries[0].arrivalTime ? ` à ${entries[0].arrivalTime}` : ""
          }`
        : `Émargement ${session.label} (${when}) : ${entries.length} stagiaires — ${ATTENDANCE_STATUS_LABELS[entries[0].status]}`;
    await auditedBatch(
      actor,
      {
        action: "attendance.record",
        entityType: "attendance",
        entityId: entries.length === 1 ? attendanceId(session.slot.id, entries[0].trainee.id, session.date) : session.slot.id,
        summary,
      },
      (batch, lastAuditId) => {
        for (const entry of entries) {
          const id = attendanceId(session.slot.id, entry.trainee.id, session.date);
          const r = record(actor, session, entry, lastAuditId);
          batch.set(doc(attendances(), id), r);
        }
      },
    );
  } catch (err) {
    console.warn("Firestore saveAttendances failed, persisted in local cache:", err);
  }
}

/** Marks every given session of a trainee as a justified absence. */
export async function justifySessions(
  actor: Actor,
  input: {
    trainee: Pick<UserProfile, "id" | "fullName">;
    sessions: { slot: TimetableSlot; date: string }[];
    reason: string;
    periodLabel: string;
  },
): Promise<void> {
  const localMap = loadPersistedAttendances();
  for (const { slot, date } of input.sessions) {
    const id = attendanceId(slot.id, input.trainee.id, date);
    const r = {
      formationId: slot.formationId,
      slotId: slot.id,
      subjectId: slot.subjectId,
      trainerId: slot.trainerId,
      traineeId: input.trainee.id,
      date,
      month: date.slice(0, 7),
      status: "excused" as AttendanceStatus,
      arrivalTime: null,
      excuseReason: input.reason,
      recordedBy: actor.id,
      updatedAt: new Date().toISOString(),
      lastAuditId: "local",
      id,
    };
    localMap.set(id, r as any);
    localAttendancesMap.set(id, r as any);
  }
  savePersistedAttendances(localMap);

  try {
    for (const part of chunk(input.sessions, 400)) {
      await auditedBatch(
        actor,
        {
          action: "attendance.justify",
          entityType: "attendance",
          entityId: input.trainee.id,
          summary: `Justificatif pour ${input.trainee.fullName} (${input.periodLabel}) : ${input.reason} — ${part.length} séance(s)`,
        },
        (batch, lastAuditId) => {
          for (const { slot, date } of part) {
            const id = attendanceId(slot.id, input.trainee.id, date);
            const entry: AttendanceEntry = { trainee: input.trainee, status: "excused", excuseReason: input.reason };
            const r = record(actor, { slot, date, label: "" }, entry, lastAuditId);
            batch.set(doc(attendances(), id), r);
          }
        },
      );
    }
  } catch (err) {
    console.warn("Firestore justifySessions failed, persisted in local cache:", err);
  }
}

/** Revokes a justification, resetting the session to an unjustified absence. */
export async function revokeJustification(
  actor: Actor,
  input: {
    trainee: Pick<UserProfile, "id" | "fullName">;
    slotId: string;
    date: string;
    formationId: string;
    subjectId: string;
    trainerId: string;
  },
): Promise<void> {
  const { trainee, slotId, date, formationId, subjectId, trainerId } = input;
  const id = attendanceId(slotId, trainee.id, date);
  const localMap = loadPersistedAttendances();
  const existing = localMap.get(id);
  if (existing) {
    existing.status = "absent";
    existing.excuseReason = null;
    localMap.set(id, existing);
    localAttendancesMap.set(id, existing);
    savePersistedAttendances(localMap);
  }

  const virtualSlot: TimetableSlot = {
    id: slotId,
    formationId,
    subjectId,
    trainerId,
    weekday: 1,
    startTime: "09:00",
    endTime: "17:00",
    room: "",
    validFrom: "1970-01-01",
    validTo: null,
  };

  try {
    await auditedBatch(
      actor,
      {
        action: "attendance.unjustify",
        entityType: "attendance",
        entityId: id,
        summary: `Annulation du justificatif pour ${trainee.fullName} (séance du ${formatShortDate(date)})`,
      },
      (batch, lastAuditId) => {
        const entry: AttendanceEntry = { trainee, status: "absent", excuseReason: null };
        batch.set(
          doc(attendances(), id),
          record(actor, { slot: virtualSlot, date, label: "" }, entry, lastAuditId),
        );
      },
    );
  } catch (err) {
    console.warn("Firestore revokeJustification failed, persisted in local cache:", err);
  }
}
