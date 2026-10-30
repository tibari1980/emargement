import {
  doc,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { COLLECTIONS } from "@/lib/data/db";
import type { Actor } from "@/lib/data/audit";
import type { Weekday } from "@/lib/domain/types";

export interface SeedResult {
  formationsCount: number;
  subjectsCount: number;
  traineesCount: number;
  slotsCount: number;
  attendancesCount: number;
}

/**
 * Initializes base educational structure of the CFRP Valentin Haüy
 * (subjects, promotions per year, timetable slots) without any fake trainees.
 * Real trainees are imported or enrolled directly by authorized staff.
 */
export async function seedDemoDataClient(actor: Actor): Promise<SeedResult> {
  const db = getDb();

  // 1. Matières fondamentales adaptées
  const sampleSubjects = [
    { id: "sub-algo-js", title: "Mathématiques & Algorithmique", description: "Logique, algorithmique, structures de contrôle et bases de programmation" },
    { id: "sub-rgaa-a11y", title: "Outils adaptés & Accessibilité", description: "Lecteurs d'écran (NVDA, JAWS), plages braille, téléagrandisseurs et raccourcis" },
    { id: "sub-sys-net", title: "Systèmes d'exploitation & Réseaux", description: "Administration Windows et Linux, routage IP, services DHCP/DNS" },
    { id: "sub-infra-tech", title: "Support matériel & Téléassistance", description: "Diagnostic, maintenance matérielle, dépannage et accompagnement utilisateurs" },
    { id: "sub-bureau-nvda", title: "Bureautique adaptée & Outils collaboratifs", description: "Suite bureautique avec synthèse vocale, tableurs et gestion documentaire" },
  ];

  for (const s of sampleSubjects) {
    const sRef = doc(db, COLLECTIONS.subjects, s.id);
    await setDoc(
      sRef,
      {
        title: s.title,
        description: s.description,
        trainerIds: actor.role === "trainer" ? [actor.id] : [],
        active: true,
      },
      { merge: true }
    );
  }

  // 2. Promotions réelles par année (aucun stagiaire fictif : traineeIds = [])
  const tip1Id = "form-tip-1-2026";
  const tip2Id = "form-tip-2-2026";
  const prepaInfoId = "form-prepa-info-2026";
  const adaptId = "form-adapt-2026";

  await setDoc(
    doc(db, COLLECTIONS.formations, tip1Id),
    {
      title: "Technicien informatique de proximité — 1ère année (TIP 1)",
      category: "professional",
      description: "1ère année : Assistance utilisateurs, configuration des équipements numériques adaptés, maintenance, réseau local et adressage IP.",
      duration: "1ère année (sur 2 ans — 21 mois / 2 800 h)",
      certification: "Titre professionnel RNCP Niveau 4 (Bac)",
      pedagogicalLeadId: actor.id,
      yearLevel: 1,
      totalYears: 2,
      shortCode: "TIP 1",
      academicYear: "2025-2026",
      active: true,
      traineeIds: [],
    },
    { merge: true }
  );

  await setDoc(
    doc(db, COLLECTIONS.formations, tip2Id),
    {
      title: "Technicien informatique de proximité — 2ème année (TIP 2)",
      category: "professional",
      description: "2ème année : Déploiement et sécurisation des infrastructures, virtualisation, serveurs, téléassistance et préparation au Titre Professionnel.",
      duration: "2ème année (sur 2 ans — 21 mois / 2 800 h dont stage 490 h)",
      certification: "Titre professionnel RNCP Niveau 4 (Bac)",
      pedagogicalLeadId: actor.id,
      yearLevel: 2,
      totalYears: 2,
      shortCode: "TIP 2",
      academicYear: "2025-2026",
      active: true,
      traineeIds: [],
    },
    { merge: true }
  );

  await setDoc(
    doc(db, COLLECTIONS.formations, prepaInfoId),
    {
      title: "Préparatoire informatique (1 an)",
      category: "preparatory",
      description: "Mise à niveau indispensable : algorithmique, logique, environnements adaptés (NVDA, JAWS, Braille, loupes) préparant à l'entrée en TIP.",
      duration: "10 mois — 1 400 heures",
      certification: "Attestation de compétences pré-qualifiantes",
      pedagogicalLeadId: actor.id,
      yearLevel: 1,
      totalYears: 1,
      shortCode: "PREPA-INFO",
      academicYear: "2025-2026",
      active: true,
      traineeIds: [],
    },
    { merge: true }
  );

  await setDoc(
    doc(db, COLLECTIONS.formations, adaptId),
    {
      title: "Adaptation aux outils et à l'autonomie (1 an)",
      category: "preparatory",
      description: "Apprentissage intensif du braille (lecture et écriture), technologies informatiques adaptées, techniques de locomotion et d'autonomie personnelle.",
      duration: "10,5 mois — 1 400 heures",
      certification: "Attestation de réadaptation professionnelle",
      pedagogicalLeadId: actor.id,
      yearLevel: 1,
      totalYears: 1,
      shortCode: "ADAPT",
      academicYear: "2025-2026",
      active: true,
      traineeIds: [],
    },
    { merge: true }
  );

  // 3. Emplois du temps hebdomadaires (partage des formateurs entre 1ère et 2ème année)
  const sampleSlots = [
    // TIP 1 (1ère année)
    { id: "slot-tip1-mon-morn", weekday: 1 as Weekday, startTime: "09:00", endTime: "12:30", subjectId: "sub-algo-js", room: "102 - Plateau Numérique", formationId: tip1Id },
    { id: "slot-tip1-mon-aft", weekday: 1 as Weekday, startTime: "13:30", endTime: "17:00", subjectId: "sub-rgaa-a11y", room: "102 - Plateau Numérique", formationId: tip1Id },
    { id: "slot-tip1-tue-morn", weekday: 2 as Weekday, startTime: "09:00", endTime: "12:30", subjectId: "sub-bureau-nvda", room: "104 - Labo Adapté", formationId: tip1Id },
    { id: "slot-tip1-wed-morn", weekday: 3 as Weekday, startTime: "09:00", endTime: "12:30", subjectId: "sub-sys-net", room: "102 - Plateau Numérique", formationId: tip1Id },

    // TIP 2 (2ème année - mêmes formateurs, créneaux complémentaires)
    { id: "slot-tip2-tue-aft", weekday: 2 as Weekday, startTime: "13:30", endTime: "17:00", subjectId: "sub-sys-net", room: "Atelier Réseau", formationId: tip2Id },
    { id: "slot-tip2-wed-aft", weekday: 3 as Weekday, startTime: "13:30", endTime: "17:00", subjectId: "sub-infra-tech", room: "Atelier Réseau", formationId: tip2Id },
    { id: "slot-tip2-thu-morn", weekday: 4 as Weekday, startTime: "09:00", endTime: "12:30", subjectId: "sub-rgaa-a11y", room: "102 - Plateau Numérique", formationId: tip2Id },
    { id: "slot-tip2-thu-aft", weekday: 4 as Weekday, startTime: "13:30", endTime: "17:00", subjectId: "sub-infra-tech", room: "Atelier Réseau", formationId: tip2Id },
  ];

  for (const s of sampleSlots) {
    const slotRef = doc(db, COLLECTIONS.slots, s.id);
    await setDoc(
      slotRef,
      {
        formationId: s.formationId,
        subjectId: s.subjectId,
        trainerId: actor.role === "trainer" ? actor.id : "",
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
      },
      { merge: true }
    );
  }

  return {
    formationsCount: 4,
    subjectsCount: sampleSubjects.length,
    traineesCount: 0,
    slotsCount: sampleSlots.length,
    attendancesCount: 0,
  };
}
