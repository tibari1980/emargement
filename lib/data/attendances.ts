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

/** Records of one session (slot × date). */
export async function listForSession(slotId: string, date: string): Promise<Attendance[]> {
  try {
    const snap = await getDocs(query(attendances(), where("slotId", "==", slotId), where("date", "==", date)));
    return snap.docs.map((d) => withId<Attendance>(d));
  } catch (err) {
    console.warn("listForSession failed:", err);
    return [];
  }
}

/** Records of a formation over whole months ("YYYY-MM"). Equality filters only: no composite index. */
export async function listForFormation(formationId: string, months: string[]): Promise<Attendance[]> {
  const uniqueMonths = [...new Set(months)].filter(Boolean);
  if (!uniqueMonths.length) return [];
  try {
    const results = await Promise.all(
      chunk(uniqueMonths, 30).map((part) =>
        getDocs(query(attendances(), where("formationId", "==", formationId), where("month", "in", part))),
      ),
    );
    return results.flatMap((s) => s.docs.map((d) => withId<Attendance>(d)));
  } catch (err) {
    console.warn("listForFormation failed:", err);
    return [];
  }
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
        batch.set(doc(attendances(), attendanceId(session.slot.id, entry.trainee.id, session.date)), record(actor, session, entry, lastAuditId));
      }
    },
  );
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
          const entry: AttendanceEntry = { trainee: input.trainee, status: "excused", excuseReason: input.reason };
          batch.set(
            doc(attendances(), attendanceId(slot.id, input.trainee.id, date)),
            record(actor, { slot, date, label: "" }, entry, lastAuditId),
          );
        }
      },
    );
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

  await auditedBatch(
    actor,
    {
      action: "attendance.unjustify",
      entityType: "attendance",
      entityId: attendanceId(slotId, trainee.id, date),
      summary: `Annulation du justificatif pour ${trainee.fullName} (séance du ${formatShortDate(date)})`,
    },
    (batch, lastAuditId) => {
      const entry: AttendanceEntry = { trainee, status: "absent", excuseReason: null };
      batch.set(
        doc(attendances(), attendanceId(slotId, trainee.id, date)),
        record(actor, { slot: virtualSlot, date, label: "" }, entry, lastAuditId),
      );
    },
  );
}
