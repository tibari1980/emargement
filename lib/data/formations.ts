import { arrayRemove, arrayUnion, collection, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { ParsedTrainee } from "@/lib/domain/csvParser";
import type { Formation, UserProfile } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byTitle, chunk, COLLECTIONS, stripMeta, withId } from "./db";
import { listUsers } from "./users";

export type FormationInput = Omit<Formation, "id" | "lastAuditId">;

const formationRef = (id: string) => doc(getDb(), COLLECTIONS.formations, id);
const EDITABLE: (keyof FormationInput)[] = [
  "title",
  "category",
  "description",
  "duration",
  "certification",
  "pedagogicalLeadId",
  "active",
];

export async function listFormations(): Promise<Formation[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.formations));
  return snap.docs.map((d) => withId<Formation>(d)).sort(byTitle);
}

export async function createFormation(actor: Actor, data: FormationInput): Promise<string> {
  const ref = doc(collection(getDb(), COLLECTIONS.formations));
  await auditedBatch(
    actor,
    { action: "formation.create", entityType: "formation", entityId: ref.id, summary: `Création de la formation « ${data.title} »` },
    (batch, lastAuditId) => batch.set(ref, { ...data, lastAuditId }),
  );
  return ref.id;
}

/** Updates the descriptive fields (enrolment is handled separately). */
export async function updateFormation(actor: Actor, formation: Formation, data: Partial<FormationInput>): Promise<void> {
  const { traineeIds: _ignored, ...editable } = stripMeta({ ...data });
  void _ignored;
  const changes = diffChanges(formation, editable, EDITABLE);
  if (!changes) return;
  const verb = "active" in changes ? (editable.active ? "Réactivation" : "Archivage") : "Modification";
  await auditedBatch(
    actor,
    { action: "formation.update", entityType: "formation", entityId: formation.id, summary: `${verb} de la formation « ${formation.title} »`, changes },
    (batch, lastAuditId) => batch.update(formationRef(formation.id), { ...editable, lastAuditId }),
  );
}

export async function removeTrainee(actor: Actor, formation: Formation, trainee: UserProfile): Promise<void> {
  await auditedBatch(
    actor,
    {
      action: "formation.unenroll",
      entityType: "formation",
      entityId: formation.id,
      summary: `Retrait de ${trainee.fullName} de la formation « ${formation.title} »`,
    },
    (batch, lastAuditId) => batch.update(formationRef(formation.id), { traineeIds: arrayRemove(trainee.id), lastAuditId }),
  );
}

/**
 * Registers trainees from an import file into a formation. Trainees already
 * known (same email, or same name when no email) are reused, not duplicated.
 */
export async function importTrainees(
  actor: Actor,
  formation: Formation,
  trainees: ParsedTrainee[],
): Promise<{ created: number; reused: number }> {
  const existing = await listUsers("trainee");
  const byEmail = new Map(existing.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));
  const byFullName = new Map(existing.map((u) => [u.fullName.toLowerCase(), u.id]));
  let created = 0;
  let reused = 0;

  // One audit entry per batch, shared by every document of the batch.
  for (const group of chunk(trainees, 200)) {
    const ids: string[] = [];
    const fresh: { id: string; t: ParsedTrainee }[] = [];
    for (const t of group) {
      const known = t.email ? byEmail.get(t.email) : byFullName.get(t.fullName.toLowerCase());
      if (known) {
        ids.push(known);
        reused++;
      } else {
        const id = doc(collection(getDb(), COLLECTIONS.users)).id;
        fresh.push({ id, t });
        ids.push(id);
        created++;
      }
    }
    await auditedBatch(
      actor,
      {
        action: "formation.import",
        entityType: "formation",
        entityId: formation.id,
        summary: `Import de ${group.length} stagiaire(s) en « ${formation.title} » (${fresh.length} nouveau(x))`,
      },
      (batch, lastAuditId) => {
        for (const { id, t } of fresh) {
          batch.set(doc(getDb(), COLLECTIONS.users, id), {
            fullName: t.fullName,
            email: t.email ?? "",
            role: "trainee",
            active: true,
            createdAt: serverTimestamp(),
            lastAuditId,
          });
        }
        batch.update(formationRef(formation.id), { traineeIds: arrayUnion(...ids), lastAuditId });
      },
    );
  }
  return { created, reused };
}
