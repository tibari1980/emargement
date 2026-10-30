import { collection, getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { AuditEntityType, AuditLog } from "@/lib/domain/types";
import { chunk, COLLECTIONS, withId } from "./db";

/**
 * Journal entries of the given days, optionally for one user and one kind
 * of entity, newest first. Equality filters only: no composite index needed.
 */
export async function listAuditLogs(filter: {
  days: string[];
  actorId?: string;
  entityType?: AuditEntityType;
}): Promise<AuditLog[]> {
  if (!filter.days || filter.days.length === 0) return [];
  try {
    const extra: QueryConstraint[] = [];
    if (filter.actorId) extra.push(where("actorId", "==", filter.actorId));
    if (filter.entityType) extra.push(where("entityType", "==", filter.entityType));

    const results = await Promise.all(
      chunk(filter.days, 30).map((days) =>
        getDocs(query(collection(getDb(), COLLECTIONS.auditLogs), where("day", "in", days), ...extra)),
      ),
    );
    const time = (log: AuditLog) => log.at?.toDate().getTime() ?? 0;
    return results.flatMap((s) => s.docs.map((d) => withId<AuditLog>(d))).sort((a, b) => time(b) - time(a));
  } catch (err) {
    console.warn("listAuditLogs failed:", err);
    return [];
  }
}
