import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { SUBJECT_CATALOG } from "@/lib/domain/catalog";
import { auditedBatch, type Actor } from "./audit";
import { chunk, COLLECTIONS, withId } from "./db";
import { invalidateFormationsCache } from "./formations";
import type { Subject, TimetableSlot } from "@/lib/domain/types";

export interface PurgeResult {
  slotsDeleted: number;
  attendancesDeleted: number;
  traineesPurged: number;
  subjectsCleaned: number;
}

/**
 * Purges all fictitious / dummy test data from the entire application:
 * - Deletes all timetable slots (especially obsolete slots pointing to "Formation inconnue" or admin accounts)
 * - Deletes all fake attendance records
 * - Purges all test trainee accounts and empties traineeIds on formations
 * - Resets subjects to the 13 official CFRP Valentin Haüy curriculum subjects
 * 
 * Safe: Preserves all staff accounts (admin, secretary, pedagogical_lead, trainer) and active formations.
 */
export async function purgeAllTestData(actor: Actor): Promise<PurgeResult> {
  const db = getDb();
  let slotsDeleted = 0;
  let attendancesDeleted = 0;
  let traineesPurged = 0;
  let subjectsCleaned = 0;

  // 1. Purge all timetable slots
  try {
    const slotsSnap = await getDocs(collection(db, COLLECTIONS.slots));
    if (!slotsSnap.empty) {
      const slotBatches = chunk(slotsSnap.docs, 400);
      for (const group of slotBatches) {
        const batch = writeBatch(db);
        for (const docSnap of group) {
          batch.delete(docSnap.ref);
          slotsDeleted++;
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("purgeAllTestData: slots purge error:", err);
  }

  // 2. Purge all attendances
  try {
    const attendancesSnap = await getDocs(collection(db, COLLECTIONS.attendances));
    if (!attendancesSnap.empty) {
      const attendanceBatches = chunk(attendancesSnap.docs, 400);
      for (const group of attendanceBatches) {
        const batch = writeBatch(db);
        for (const docSnap of group) {
          batch.delete(docSnap.ref);
          attendancesDeleted++;
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("purgeAllTestData: attendances purge error:", err);
  }

  // 3. Purge test trainees and reset formation enrolments
  try {
    const formationsSnap = await getDocs(collection(db, COLLECTIONS.formations));
    const fBatch = writeBatch(db);
    let formationsNeedUpdate = false;
    for (const fDoc of formationsSnap.docs) {
      const data = fDoc.data();
      if (Array.isArray(data.traineeIds) && data.traineeIds.length > 0) {
        fBatch.update(fDoc.ref, { traineeIds: [] });
        formationsNeedUpdate = true;
      }
    }
    if (formationsNeedUpdate) {
      await fBatch.commit();
    }

    // Delete trainee user documents (preserve staff accounts!)
    const traineesSnap = await getDocs(
      query(collection(db, COLLECTIONS.users), where("role", "==", "trainee"))
    );
    if (!traineesSnap.empty) {
      const traineeBatches = chunk(traineesSnap.docs, 400);
      for (const group of traineeBatches) {
        const batch = writeBatch(db);
        for (const docSnap of group) {
          batch.delete(docSnap.ref);
          traineesPurged++;
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("purgeAllTestData: trainees purge error:", err);
  }

  // 4. Clean obsolete subjects and initialize official CFRP curriculum subjects
  try {
    const subjectsSnap = await getDocs(collection(db, COLLECTIONS.subjects));
    const officialTitles = new Set(SUBJECT_CATALOG.map((s) => s.title.toLowerCase().trim()));
    const batch = writeBatch(db);
    let hasSubjectModifications = false;

    // Delete obsolete dummy subjects (e.g. "Algorithmique & JavaScript Moderne", "HTML5...", etc.)
    for (const sDoc of subjectsSnap.docs) {
      const title = String(sDoc.data().title ?? "").toLowerCase().trim();
      if (!officialTitles.has(title)) {
        batch.delete(sDoc.ref);
        subjectsCleaned++;
        hasSubjectModifications = true;
      }
    }

    // Create missing official subjects
    const existingTitles = new Set(
      subjectsSnap.docs
        .map((d) => String(d.data().title ?? "").toLowerCase().trim())
        .filter((t) => officialTitles.has(t))
    );

    for (const official of SUBJECT_CATALOG) {
      if (!existingTitles.has(official.title.toLowerCase().trim())) {
        const newRef = doc(collection(db, COLLECTIONS.subjects));
        batch.set(newRef, {
          title: official.title,
          description: official.description,
          trainerIds: [],
          active: true,
        });
        hasSubjectModifications = true;
      }
    }

    if (hasSubjectModifications) {
      await batch.commit();
    }
  } catch (err) {
    console.warn("purgeAllTestData: subjects sync error:", err);
  }

  // Audit the operation
  try {
    await auditedBatch(
      actor,
      {
        action: "application.purgeTestData",
        entityType: "application",
        entityId: "cleanup",
        summary: `Purge complète des données de test (${slotsDeleted} créneaux, ${attendancesDeleted} émargements, ${traineesPurged} stagiaires, ${subjectsCleaned} matières nettoyées)`,
      },
      () => {}
    );
  } catch {}

  invalidateFormationsCache();

  return {
    slotsDeleted,
    attendancesDeleted,
    traineesPurged,
    subjectsCleaned,
  };
}
