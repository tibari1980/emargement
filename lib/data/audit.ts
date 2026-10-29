// Audit trail. Every write of the application goes through `auditedBatch`,
// which adds an immutable journal entry to the same atomic batch.
// firestore.rules refuse any create/update whose `lastAuditId` does not point
// to an entry created in that very request by the signed-in user, and any
// delete without its "del_<id>" entry: the trail cannot be bypassed.

import { collection, doc, serverTimestamp, writeBatch, type WriteBatch } from "firebase/firestore";
import { todayIso } from "@/lib/core/dates";
import { getDb } from "@/lib/core/firebase";
import type { AuditChange, AuditEntityType, Role, UserProfile } from "@/lib/domain/types";
import { COLLECTIONS } from "./db";

/** The signed-in staff member performing an action. */
export type Actor = Pick<UserProfile, "id" | "fullName" | "role">;

export interface AuditEntry {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  changes?: Record<string, AuditChange> | null;
}

/**
 * Runs `write` in a batch together with an audit entry, then commits.
 * `write` receives the batch and the entry id to store in `lastAuditId`.
 * Use `entryId: "del_<docId>"` for deletions.
 */
export async function auditedBatch(
  actor: Actor,
  entry: AuditEntry,
  write: (batch: WriteBatch, auditId: string) => void,
  options: { entryId?: string } = {},
): Promise<string> {
  const db = getDb();
  const batch = writeBatch(db);
  const ref = options.entryId
    ? doc(db, COLLECTIONS.auditLogs, options.entryId)
    : doc(collection(db, COLLECTIONS.auditLogs));
  batch.set(ref, {
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role satisfies Role,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
    changes: entry.changes ?? null,
    at: serverTimestamp(),
    day: todayIso(),
  });
  write(batch, ref.id);
  await batch.commit();
  return ref.id;
}

/** Field-by-field differences, for the "details" column of the journal. */
export function diffChanges<T extends object>(
  before: Partial<T>,
  after: Partial<T>,
  fields: (keyof T)[],
): Record<string, AuditChange> | null {
  const changes: Record<string, AuditChange> = {};
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[String(field)] = { from, to };
  }
  return Object.keys(changes).length ? changes : null;
}
