import { collection, getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { AuditEntityType, AuditLog } from "@/lib/domain/types";
import { chunk, COLLECTIONS, withId } from "./db";

export function getDemoAuditLogs(): AuditLog[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const makeTimestamp = (hoursAgo: number) =>
    ({
      toDate: () => new Date(now.getTime() - hoursAgo * 3600 * 1000),
    }) as any;

  return [
    {
      id: "audit-1",
      day: today,
      at: makeTimestamp(0.5),
      actorId: "demo-trainer",
      actorName: "Thomas Formateur",
      actorRole: "trainer",
      action: "attendance.record",
      entityType: "attendance",
      entityId: "slot-morning-1",
      summary: "Émargement Bureautique adaptée (JAWS/NVDA) : 6 stagiaires — Présent",
      changes: null,
    },
    {
      id: "audit-2",
      day: today,
      at: makeTimestamp(2),
      actorId: "demo-secretary",
      actorName: "Sophie Secrétaire",
      actorRole: "secretary",
      action: "attendance.justify",
      entityType: "attendance",
      entityId: "t3",
      summary: "Justificatif pour Karim Benali : Arrêt maladie délivré par médecin traitant — 1 séance(s)",
      changes: null,
    },
    {
      id: "audit-3",
      day: today,
      at: makeTimestamp(3),
      actorId: "demo-lead",
      actorName: "Paul Responsable",
      actorRole: "pedagogical_lead",
      action: "report.export",
      entityType: "formation",
      entityId: "form-tip-1",
      summary: "Export certifié du Bordereau de déclaration ASP (Excel/PDF)",
      changes: null,
    },
    {
      id: "audit-4",
      day: today,
      at: makeTimestamp(5),
      actorId: "demo-admin",
      actorName: "Alice Administratrice",
      actorRole: "admin",
      action: "user.update",
      entityType: "user",
      entityId: "demo-trainer",
      summary: "Mise à jour du profil de Thomas Formateur (Salle A104)",
      changes: { room: { from: "Salle B201", to: "Salle A104" } },
    },
  ];
}

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
    const logs = results.flatMap((s) => s.docs.map((d) => withId<AuditLog>(d))).sort((a, b) => time(b) - time(a));
    if (logs.length > 0) return logs;
  } catch (err) {
    console.warn("listAuditLogs failed:", err);
  }
  const all = getDemoAuditLogs();
  return all.filter((l) => {
    if (filter.actorId && l.actorId !== filter.actorId) return false;
    if (filter.entityType && l.entityType !== filter.entityType) return false;
    return true;
  });
}
