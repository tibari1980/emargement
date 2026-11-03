import type { Attendance, AttendanceStatus } from "@/lib/domain/types";
import type { PendingAttendanceRecord } from "./types";

export interface ConflictResolutionResult {
  /** Should the pending local record overwrite the server record? */
  shouldOverwrite: boolean;
  /** Reason for the deterministic decision */
  reason: string;
  /** Final merged status to persist */
  finalStatus: AttendanceStatus;
  finalArrivalTime: string | null;
  finalExcuseReason: string | null;
}

/**
 * Deterministic Conflict Resolution Engine for ESRP / CFRP attendance records.
 * Ensures data integrity between offline client records and live server records.
 */
export function resolveAttendanceConflict(
  pending: PendingAttendanceRecord,
  serverRecord: Attendance | null | undefined,
): ConflictResolutionResult {
  // Case 1: No server record exists yet -> pending record is accepted directly
  if (!serverRecord) {
    return {
      shouldOverwrite: true,
      reason: "No prior server record exists. Initial local record accepted.",
      finalStatus: pending.status,
      finalArrivalTime: pending.arrivalTime,
      finalExcuseReason: pending.excuseReason,
    };
  }

  // Case 2: Administrative justification precedence
  // If the server record was officially excused by secretariat/lead with medical justification,
  // an offline trainer marking "absent" must NOT wipe out the verified medical justification.
  if (serverRecord.status === "excused" && pending.status === "absent") {
    return {
      shouldOverwrite: false,
      reason: "Preserved official administrative justification ('excused') over offline absent mark.",
      finalStatus: "excused",
      finalArrivalTime: null,
      finalExcuseReason: serverRecord.excuseReason,
    };
  }

  // Case 3: Physical presence confirmation
  // If the trainer physically marked the trainee as "present" in class, presence is retained.
  if (pending.status === "present" && serverRecord.status === "absent") {
    return {
      shouldOverwrite: true,
      reason: "Physical attendance confirmed by trainer during session overrides default absence.",
      finalStatus: "present",
      finalArrivalTime: null,
      finalExcuseReason: null,
    };
  }

  // Case 4: Lateness adjustment
  // If pending has a late arrival time and server is absent, accept late arrival
  if (pending.status === "late" && serverRecord.status === "absent") {
    return {
      shouldOverwrite: true,
      reason: "Trainer specified late arrival with exact time.",
      finalStatus: "late",
      finalArrivalTime: pending.arrivalTime,
      finalExcuseReason: null,
    };
  }

  // Case 5: Default deterministic rule: Pending record was intentionally submitted by authorized actor
  return {
    shouldOverwrite: true,
    reason: "Local offline record applied (authorized actor action).",
    finalStatus: pending.status,
    finalArrivalTime: pending.arrivalTime,
    finalExcuseReason: pending.excuseReason,
  };
}

