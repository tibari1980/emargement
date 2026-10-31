import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

/** Firestore collection names. */
export const COLLECTIONS = {
  users: "users",
  formations: "formations",
  subjects: "subjects",
  slots: "timetableSlots",
  holidays: "holidays",
  attendances: "attendances",
  sessionOverrides: "sessionOverrides",
  notifications: "notifications",
  auditLogs: "auditLogs",
  settings: "settings",
} as const;

export const withId = <T>(snap: QueryDocumentSnapshot<DocumentData>) => ({ id: snap.id, ...snap.data() }) as T;

export const byName = (a: { fullName?: string }, b: { fullName?: string }) =>
  (a?.fullName ?? "").localeCompare(b?.fullName ?? "", "fr");

export const byTitle = (a: { title?: string }, b: { title?: string }) =>
  (a?.title ?? "").localeCompare(b?.title ?? "", "fr");

/** Firestore limits "in" filters (30 values) and batches (500 writes): work in chunks. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Removes the id and audit fields before writing a document. */
export function stripMeta<T extends object>(data: T): Omit<T, "id" | "lastAuditId"> {
  const copy = { ...data } as T & { id?: string; lastAuditId?: string };
  delete copy.id;
  delete copy.lastAuditId;
  return copy;
}
