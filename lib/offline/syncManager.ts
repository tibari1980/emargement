"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { auditedBatch, type Actor } from "@/lib/data/audit";
import { COLLECTIONS, withId } from "@/lib/data/db";
import { ATTENDANCE_STATUS_LABELS, type Attendance, type Role } from "@/lib/domain/types";
import { resolveAttendanceConflict } from "./conflictResolver";
import {
  countPendingAttendances,
  getPendingAttendances,
  removePendingAttendance,
} from "./db";
import type { OfflineSyncState, PendingAttendanceRecord } from "./types";

let syncInProgress = false;
const listeners = new Set<(state: OfflineSyncState) => void>();

let currentState: OfflineSyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null,
};

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn({ ...currentState });
    } catch {}
  });
}

export function getOfflineSyncState(): OfflineSyncState {
  return { ...currentState };
}

export function subscribeOfflineSyncState(callback: (state: OfflineSyncState) => void): () => void {
  listeners.add(callback);
  callback({ ...currentState });
  // Update count on subscription
  void countPendingAttendances().then((count) => {
    if (currentState.pendingCount !== count) {
      currentState.pendingCount = count;
      notifyListeners();
    }
  });
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Initializes network event listeners in the browser.
 */
export function initOfflineSyncManager(): void {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    currentState.isOnline = true;
    notifyListeners();
    // Auto sync when coming back online
    void syncPendingAttendances();
  };

  const handleOffline = () => {
    currentState.isOnline = false;
    notifyListeners();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Initial count check
  void countPendingAttendances().then((count) => {
    currentState.pendingCount = count;
    notifyListeners();
    if (count > 0 && navigator.onLine) {
      void syncPendingAttendances();
    }
  });
}

/**
 * Executes synchronization of all pending local attendances to Firestore.
 */
export async function syncPendingAttendances(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (syncInProgress) {
    return { synced: 0, failed: 0, remaining: currentState.pendingCount };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, remaining: currentState.pendingCount };
  }

  syncInProgress = true;
  currentState.isSyncing = true;
  currentState.lastError = null;
  notifyListeners();

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pendingList = await getPendingAttendances();
    if (!pendingList.length) {
      currentState.pendingCount = 0;
      currentState.isSyncing = false;
      syncInProgress = false;
      notifyListeners();
      return { synced: 0, failed: 0, remaining: 0 };
    }

    const db = getDb();

    // Process in batches
    for (const pending of pendingList) {
      try {
        // Read existing remote record to evaluate deterministic conflicts
        const docRef = doc(db, COLLECTIONS.attendances, pending.id);
        let existingRecord: Attendance | null = null;
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            existingRecord = withId<Attendance>(snap);
          }
        } catch {
          // If read fails (e.g. offline during process), existingRecord stays null
        }

        const conflict = resolveAttendanceConflict(pending, existingRecord);

        if (conflict.shouldOverwrite) {
          const actor: Actor = {
            id: pending.recordedBy,
            role: pending.recordedByRole as Role,
            fullName: pending.recordedByName,
          };

          const summary = `Synchronisation différée (${pending.sessionLabel}) : ${pending.traineeFullName} — ${ATTENDANCE_STATUS_LABELS[conflict.finalStatus]}${
            conflict.finalStatus === "late" && conflict.finalArrivalTime ? ` à ${conflict.finalArrivalTime}` : ""
          } [Enregistré hors-ligne le ${pending.clientTimestamp}]`;

          await auditedBatch(
            actor,
            {
              action: "attendance.record_offline_sync",
              entityType: "attendance",
              entityId: pending.id,
              summary,
            },
            (batch, lastAuditId) => {
              const payload = {
                formationId: pending.formationId,
                slotId: pending.slotId,
                subjectId: pending.subjectId,
                trainerId: pending.trainerId,
                traineeId: pending.traineeId,
                date: pending.date,
                month: pending.month,
                status: conflict.finalStatus,
                arrivalTime: conflict.finalArrivalTime,
                excuseReason: conflict.finalExcuseReason,
                recordedBy: pending.recordedBy,
                updatedAt: serverTimestamp(),
                lastAuditId,
                clientTimestamp: pending.clientTimestamp,
                deviceSignature: pending.deviceSignature,
                syncedAt: serverTimestamp(),
              };
              batch.set(docRef, payload, { merge: true });
            },
          );
        }

        // Successfully processed or resolved
        await removePendingAttendance(pending.id);
        syncedCount++;
      } catch (err: any) {
        console.warn(`Failed to sync pending record ${pending.id}:`, err);
        failedCount++;
        currentState.lastError = err?.message || "Erreur de synchronisation";
      }
    }

    currentState.lastSyncTime = new Date().toISOString();
  } catch (globalErr: any) {
    currentState.lastError = globalErr?.message || "Erreur générale de synchronisation";
  } finally {
    syncInProgress = false;
    currentState.isSyncing = false;
    const remaining = await countPendingAttendances();
    currentState.pendingCount = remaining;
    notifyListeners();
  }

  return {
    synced: syncedCount,
    failed: failedCount,
    remaining: currentState.pendingCount,
  };
}

/**
 * React hook providing reactive access to offline sync status.
 */
export function useOfflineSync(): OfflineSyncState & {
  triggerSync: () => Promise<void>;
} {
  const [state, setState] = useState<OfflineSyncState>(() => getOfflineSyncState());

  useEffect(() => {
    initOfflineSyncManager();
    return subscribeOfflineSyncState(setState);
  }, []);

  const triggerSync = async () => {
    await syncPendingAttendances();
  };

  return { ...state, triggerSync };
}

