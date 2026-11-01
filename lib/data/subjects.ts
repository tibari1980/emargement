import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { Subject } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byTitle, COLLECTIONS, stripMeta, withId } from "./db";

export type SubjectInput = Omit<Subject, "id" | "lastAuditId">;

export function getDemoSubjects(): Subject[] {
  return [
    {
      id: "sub-braille",
      title: "Braille et adaptations",
      description: "Apprentissage du braille intégral et abrégé, règles typographiques adaptées.",
      trainerIds: ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "demo-trainer"],
      active: true,
    },
    {
      id: "sub-bureau",
      title: "Bureautique adaptée (JAWS/NVDA)",
      description: "Traitement de texte, tableurs et gestion documentaire avec lecteurs d'écran.",
      trainerIds: ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "demo-trainer"],
      active: true,
    },
    {
      id: "sub-web",
      title: "Développement web accessible",
      description: "HTML sémantique, ARIA, CSS et JavaScript accessibles selon le RGAA 4.1 AAA.",
      trainerIds: ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "demo-trainer"],
      active: true,
    },
    {
      id: "sub-reseaux",
      title: "Réseaux et Télécommunications",
      description: "Architecture réseaux, adressage IPv4/IPv6, protocoles et routage.",
      trainerIds: ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "demo-trainer"],
      active: true,
    },
    {
      id: "sub-systemes",
      title: "Systèmes & Virtualisation",
      description: "Administration Linux et Windows Server, virtualisation et conteneurs.",
      trainerIds: ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "demo-trainer"],
      active: true,
    },
  ];
}

let cachedSubjects: Subject[] | null = null;
let lastSubjectsFetch = 0;

export function getInitialSubjects(): Subject[] {
  return cachedSubjects ?? getDemoSubjects();
}

export async function listSubjects(force = false): Promise<Subject[]> {
  if (!force && cachedSubjects && Date.now() - lastSubjectsFetch < 60_000) {
    return cachedSubjects;
  }
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 800));
    const snap = await Promise.race([getDocs(collection(getDb(), COLLECTIONS.subjects)), timeout]);
    const list = snap.docs.map((d) => withId<Subject>(d)).sort(byTitle);
    lastSubjectsFetch = Date.now();
    if (list.length > 0) {
      cachedSubjects = list;
      return list;
    }
  } catch (err) {
    console.warn("listSubjects failed or empty:", err);
    lastSubjectsFetch = Date.now();
  }
  const fallback = getDemoSubjects();
  cachedSubjects = fallback;
  return fallback;
}

export async function createSubject(actor: Actor, data: SubjectInput): Promise<string> {
  lastSubjectsFetch = 0;
  const ref = doc(collection(getDb(), COLLECTIONS.subjects));
  await auditedBatch(
    actor,
    { action: "subject.create", entityType: "subject", entityId: ref.id, summary: `Création de la matière « ${data.title} »` },
    (batch, lastAuditId) => batch.set(ref, { ...data, lastAuditId }),
  );
  return ref.id;
}

export async function updateSubject(actor: Actor, subject: Subject, data: Partial<SubjectInput>): Promise<void> {
  lastSubjectsFetch = 0;
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

/**
 * Permanently deletes a subject and cleans up any related timetable slots.
 */
export async function deleteSubject(actor: Actor, subject: Subject): Promise<void> {
  const db = getDb();

  // 1. Supprimer les créneaux d'emplois du temps associés à cette matière si existants
  try {
    const slotsSnap = await getDocs(
      query(collection(db, COLLECTIONS.slots), where("subjectId", "==", subject.id))
    );
    for (const d of slotsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn("deleteSubject: impossible de supprimer les créneaux rattachés:", e);
  }

  // 2. Suppression définitive du document matière avec journal d'audit
  await auditedBatch(
    actor,
    {
      action: "subject.delete",
      entityType: "subject",
      entityId: subject.id,
      summary: `Suppression définitive de la matière « ${subject.title} »`,
    },
    (batch) => batch.delete(doc(db, COLLECTIONS.subjects, subject.id)),
    { entryId: `del_subj_${subject.id}` }
  );
}
