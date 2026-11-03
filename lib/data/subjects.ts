import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { SUBJECT_CATALOG } from "@/lib/domain/catalog";
import type { Subject } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byTitle, COLLECTIONS, stripMeta, withId } from "./db";

export type SubjectInput = Omit<Subject, "id" | "lastAuditId">;

const LOCAL_SUBJECTS_KEY = "avh_persisted_subjects_v2";
const localSubjectsMap = new Map<string, Subject>();

export function getDemoSubjects(): Subject[] {
  const DEFAULT_TRAINERS = ["L5ZcFkR961OBv4VjVyXurZuhOcM2", "tdbL2rH5LTTHagluHiXbzvCcGjk2", "p5iCAyUimmhjjY4Hq8QAHpDxiYJ2", "demo-trainer"];
  return [
    {
      id: "sub-braille",
      title: "Braille et adaptations",
      description: "Apprentissage du braille intégral et abrégé, règles typographiques adaptées.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-bureau",
      title: "Bureautique adaptée (JAWS/NVDA)",
      description: "Traitement de texte, tableurs et gestion documentaire avec lecteurs d'écran.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-outils",
      title: "Outils adaptés",
      description: "Lecteurs d'écran (NVDA, JAWS), plage braille, téléagrandisseurs et loupes.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-locomotion",
      title: "Locomotion",
      description: "Techniques de déplacement autonome, canne blanche et repérage spatial.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-avj",
      title: "Activités de la vie journalière",
      description: "Autonomie au quotidien, gestion domestique et gestes adaptés.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-web",
      title: "Développement web accessible",
      description: "HTML sémantique, ARIA, CSS et JavaScript accessibles selon le RGAA 4.1 AAA.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-reseaux",
      title: "Réseaux et Télécommunications",
      description: "Architecture réseaux, adressage IPv4/IPv6, protocoles et routage.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-systemes",
      title: "Systèmes & Virtualisation",
      description: "Administration Linux et Windows Server, virtualisation et conteneurs.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-francais-1",
      title: "Français — Remise à niveau",
      description: "Grammaire, orthographe, expression écrite et synthèse professionnelle.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-francais-2",
      title: "Français — Techniques d'écriture avancées",
      description: "Rédaction professionnelle, argumentation et synthèse de documents.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-telephonie",
      title: "Téléphonie accessible",
      description: "Smartphones iOS et Android avec VoiceOver / TalkBack et gestuelle adaptée.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-maths",
      title: "Mathématiques & Algorithmique",
      description: "Remise à niveau scientifique, logique de programmation et calculs.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-support",
      title: "Support matériel & Téléassistance",
      description: "Diagnostic, maintenance, dépannage et accompagnement utilisateurs.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-anat",
      title: "Anatomie & Biomécanique",
      description: "Anatomie palpatoire et descriptive, physiologie du mouvement.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
    {
      id: "sub-comm",
      title: "Communication professionnelle",
      description: "Techniques de communication orale, accueil et posture professionnelle.",
      trainerIds: DEFAULT_TRAINERS,
      active: true,
    },
  ];
}

function loadPersistedSubjects(): Map<string, Subject> {
  const map = new Map<string, Subject>();
  // 1. Initialiser avec les matières officielles du centre
  getDemoSubjects().forEach((s) => map.set(s.id, s));
  localSubjectsMap.forEach((v, k) => map.set(k, v));

  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(LOCAL_SUBJECTS_KEY);
    if (raw) {
      const list: Subject[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((s) => {
          map.set(s.id, s);
          localSubjectsMap.set(s.id, s);
        });
      }
    }
  } catch {}
  return map;
}

function savePersistedSubjects(map: Map<string, Subject>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SUBJECTS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

let cachedSubjects: Subject[] | null = null;
let lastSubjectsFetch = 0;

export function getInitialSubjects(): Subject[] {
  const map = loadPersistedSubjects();
  return Array.from(map.values()).sort(byTitle);
}

export async function listSubjects(force = false): Promise<Subject[]> {
  const localMap = loadPersistedSubjects();
  if (!force && cachedSubjects && Date.now() - lastSubjectsFetch < 60_000) {
    return cachedSubjects;
  }
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 800));
    const snap = await Promise.race([getDocs(collection(getDb(), COLLECTIONS.subjects)), timeout]);
    const list = snap.docs.map((d) => withId<Subject>(d)).sort(byTitle);
    lastSubjectsFetch = Date.now();
    if (list.length > 0) {
      list.forEach((s) => {
        localMap.set(s.id, s);
        localSubjectsMap.set(s.id, s);
      });
      savePersistedSubjects(localMap);
      const combined = Array.from(localMap.values()).sort(byTitle);
      cachedSubjects = combined;
      return combined;
    }
  } catch (err) {
    console.warn("listSubjects failed or empty:", err);
    lastSubjectsFetch = Date.now();
  }
  const fallback = Array.from(localMap.values()).sort(byTitle);
  cachedSubjects = fallback;
  return fallback;
}

export async function createSubject(actor: Actor, data: SubjectInput): Promise<string> {
  lastSubjectsFetch = 0;
  const ref = doc(collection(getDb(), COLLECTIONS.subjects));
  const newSubject: Subject = { id: ref.id, ...data };
  const localMap = loadPersistedSubjects();
  localMap.set(ref.id, newSubject);
  localSubjectsMap.set(ref.id, newSubject);
  savePersistedSubjects(localMap);

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
  const updatedSubject: Subject = { ...subject, ...editable };
  const localMap = loadPersistedSubjects();
  localMap.set(subject.id, updatedSubject);
  localSubjectsMap.set(subject.id, updatedSubject);
  savePersistedSubjects(localMap);

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
  const localMap = loadPersistedSubjects();
  localMap.delete(subject.id);
  localSubjectsMap.delete(subject.id);
  savePersistedSubjects(localMap);

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
