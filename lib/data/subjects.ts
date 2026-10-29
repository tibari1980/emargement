import { collection, doc, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { Subject } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byTitle, COLLECTIONS, stripMeta, withId } from "./db";

export type SubjectInput = Omit<Subject, "id" | "lastAuditId">;

export async function listSubjects(): Promise<Subject[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.subjects));
  return snap.docs.map((d) => withId<Subject>(d)).sort(byTitle);
}

export async function createSubject(actor: Actor, data: SubjectInput): Promise<string> {
  const ref = doc(collection(getDb(), COLLECTIONS.subjects));
  await auditedBatch(
    actor,
    { action: "subject.create", entityType: "subject", entityId: ref.id, summary: `Création de la matière « ${data.title} »` },
    (batch, lastAuditId) => batch.set(ref, { ...data, lastAuditId }),
  );
  return ref.id;
}

export async function updateSubject(actor: Actor, subject: Subject, data: Partial<SubjectInput>): Promise<void> {
  const editable = stripMeta({ ...data });
  const changes = diffChanges(subject, editable, ["title", "description", "trainerIds", "active"]);
  if (!changes) return;
  const verb = "active" in changes ? (editable.active ? "Réactivation" : "Archivage") : "Modification";
  await auditedBatch(
    actor,
    { action: "subject.update", entityType: "subject", entityId: subject.id, summary: `${verb} de la matière « ${subject.title} »`, changes },
    (batch, lastAuditId) => batch.update(doc(getDb(), COLLECTIONS.subjects, subject.id), { ...editable, lastAuditId }),
  );
}
