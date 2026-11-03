import type { Attendance, AttendanceStatus, TimetableSlot, UserProfile } from "@/lib/domain/types";
import type { Actor } from "@/lib/data/audit";

export type PendingSyncStatus = "pending" | "syncing" | "failed";

export interface PendingAttendanceRecord {
  /** Deterministic identifier `${slotId}_${traineeId}_${date}` */
  id: string;
  slotId: string;
  formationId: string;
  subjectId: string;
  trainerId: string;
  traineeId: string;
  traineeFullName: string;
  date: string;
  month: string;
  status: AttendanceStatus;
  arrivalTime: string | null;
  excuseReason: string | null;
  note?: string | null;
  noteUpdatedAt?: string | null;
  recordedBy: string;
  recordedByRole: string;
  recordedByName: string;
  /** ISO timestamp recorded on client device when the click occurred */
  clientTimestamp: string;
  /** Anonymized device / session token to audit source */
  deviceSignature: string;
  /** For the audit journal */
  sessionLabel: string;
  slotStartTime: string;
  slotEndTime: string;
  syncStatus: PendingSyncStatus;
  attempts: number;
  lastError?: string;
}

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

