import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { FORMATION_CATALOG } from "@/lib/domain/catalog";
import type { ParsedTrainee } from "@/lib/domain/csvParser";
import type { Formation, UserProfile } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byTitle, chunk, COLLECTIONS, stripMeta, withId } from "./db";
import { listUsers } from "./users";

export type FormationInput = Omit<Formation, "id" | "lastAuditId">;

const formationRef = (id: string) => doc(getDb(), COLLECTIONS.formations, id);
const EDITABLE: (keyof Omit<FormationInput, "traineeIds">)[] = [
  "title",
  "category",
  "description",
  "duration",
  "certification",
  "pedagogicalLeadId",
  "active",
  "yearLevel",
  "totalYears",
  "shortCode",
  "academicYear",
];

/**
 * Official reference durations for CFRP Valentin Haüy formations.
 * Used for display fallback and automated database persistence.
 */
export function getOfficialDuration(title: string): string {
  if (!title) return "10,5 mois — 1 400 heures";
  const t = title.toLowerCase().trim();

  // Promotions par année
  if (t.includes("tip 1") || (t.includes("1ère année") && t.includes("proximité"))) {
    return "1ère année (sur 2 ans — 21 mois / 2 800 h)";
  }
  if (t.includes("tip 2") || (t.includes("2ème année") && t.includes("proximité"))) {
    return "2ème année (sur 2 ans — 21 mois / 2 800 h dont 490 h de stage)";
  }
  if (t.includes("caga 1") || (t.includes("1ère année") && t.includes("gestion administrative"))) {
    return "1ère année (sur 2 ans — 21 mois / 2 800 h)";
  }
  if (t.includes("caga 2") || (t.includes("2ème année") && t.includes("gestion administrative"))) {
    return "2ème année (sur 2 ans — 21 mois / 2 800 h dont 455 h de stage)";
  }
  if (t.includes("k1") || (t.includes("1ère année") && t.includes("kiné"))) {
    return "1ère année K1 (cursus 4 ans — 1 400 h)";
  }
  if (t.includes("k2") || (t.includes("2ème année") && t.includes("kiné"))) {
    return "2ème année K2 (cursus 4 ans — 1 400 h)";
  }
  if (t.includes("k3") || (t.includes("3ème année") && t.includes("kiné"))) {
    return "3ème année K3 (cursus 4 ans — 1 400 h)";
  }
  if (t.includes("k4") || (t.includes("4ème année") && t.includes("kiné"))) {
    return "4ème année K4 (cursus 4 ans — 1 400 h)";
  }

  // Filières globales / Titres génériques officiels du centre
  if (t.includes("kiné") || t.includes("kinésithérapeute")) {
    return "4 à 5 ans — 1 400 h/an (total 6 720 h dont 1 610 h de stage)";
  }
  if (t.includes("cycle")) {
    return "10,5 mois — 1 400 heures dont 315 heures de stage";
  }
  if (t.includes("massage") || t.includes("bien-être")) {
    return "10,5 mois — 1 400 heures dont 280 heures de stage";
  }
  if (t.includes("informatique de proximité") || t.includes("tap")) {
    return "21 mois — 2 800 heures dont 490 heures de stage";
  }
  if (t.includes("gestion administrative") || t.includes("accueil")) {
    return "21 mois — 2 800 heures dont 455 heures de stage";
  }
  if (t.includes("préparatoire informatique") || t.includes("prépa info")) {
    return "10,5 mois — 1 400 heures";
  }
  if (t.includes("scientifique") || t.includes("prépa kiné")) {
    return "10,5 mois — 1 400 heures";
  }
  if (t.includes("adaptation")) {
    return "10,5 mois — 1 400 heures";
  }
  if (t.includes("tremplin")) {
    return "5 mois — 665 heures";
  }
  if (t.includes("journalière") || t.includes("avj")) {
    return "Modules individualisés (35 h à 140 h)";
  }
  if (t.includes("braille")) {
    return "Ateliers continus (35 h à 140 h)";
  }
  if (t.includes("locomotion")) {
    return "Séances individuelles (35 h à 105 h)";
  }
  if (t.includes("outils adaptés")) {
    return "Ateliers techniques (35 h à 140 h)";
  }
  if (t.includes("bureautique")) {
    return "Modules pratiques (70 h à 210 h)";
  }
  if (t.includes("déficience visuelle")) {
    return "Module de sensibilisation (35 h)";
  }

  return "10,5 mois — 1 400 heures";
}

/**
 * Automatically repairs and persists missing durations for all formations in Firestore.
 */
export async function repairFormationDurations(actor: Actor): Promise<{ updatedCount: number }> {
  const db = getDb();
  const snap = await getDocs(collection(db, COLLECTIONS.formations));
  let updatedCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const duration = data.duration;
    if (!duration || String(duration).trim() === "" || String(duration).trim() === "—") {
      const official = getOfficialDuration(data.title ?? "");
      const f = withId<Formation>(docSnap);
      await updateFormation(actor, f, { duration: official });
      updatedCount++;
    }
  }

  try {
    const coursesSnap = await getDocs(collection(db, "courses"));
    for (const docSnap of coursesSnap.docs) {
      const data = docSnap.data();
      const duration = data.duration;
      if (!duration || String(duration).trim() === "" || String(duration).trim() === "—") {
        const official = getOfficialDuration(data.title ?? "");
        const f = withId<Formation>(docSnap);
        await updateFormation(actor, f, { duration: official });
        updatedCount++;
      }
    }
  } catch {}

  return { updatedCount };
}

/**
 * Normalizes a training title by removing accents, symbols and collapsing whitespace.
 */
export function normalizeCatalogText(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip all accents (e.g. é -> e)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")     // replace punctuation with spaces
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim();
}

/**
 * Returns a canonical key for a training title so duplicates and variations
 * (e.g. "Préparatoire informatique" vs "Préparatoire informatique (1 an)")
 * map to the same unique key.
 */
export function getCanonicalKey(title: string): string {
  const norm = normalizeCatalogText(title);

  // Informatique préparatoire
  if (
    (norm.includes("preparatoire") && norm.includes("info")) ||
    norm.includes("prepa info") ||
    (norm.includes("mise a niveau") && norm.includes("info"))
  ) {
    return "prepa-info";
  }

  // TIP promotions par année
  if (norm.includes("tip 1") || (norm.includes("1") && norm.includes("proximite"))) {
    return "tip-1";
  }
  if (norm.includes("tip 2") || (norm.includes("2") && norm.includes("proximite"))) {
    return "tip-2";
  }
  if (norm.includes("proximite") || norm.includes("tap") || norm.includes("dwwm")) {
    return "tip-generic";
  }

  // Kinésithérapie
  if (
    norm.includes("scientifique") ||
    norm.includes("prepa kine") ||
    (norm.includes("preparatoire") && norm.includes("kine"))
  ) {
    return "prepa-kine";
  }
  if (norm.includes("k1") || (norm.includes("1") && norm.includes("kine"))) {
    return "kine-1";
  }
  if (norm.includes("k2") || (norm.includes("2") && norm.includes("kine"))) {
    return "kine-2";
  }
  if (norm.includes("k3") || (norm.includes("3") && norm.includes("kine"))) {
    return "kine-3";
  }
  if (norm.includes("k4") || (norm.includes("4") && norm.includes("kine"))) {
    return "kine-4";
  }
  if (norm.includes("kine") || norm.includes("kinesitherap")) {
    return "kine-generic";
  }

  // Tertiaire / Secrétariat
  if (
    norm.includes("caga 1") ||
    (norm.includes("1") && (norm.includes("accueil") || norm.includes("gestion administrative")))
  ) {
    return "caga-1";
  }
  if (
    norm.includes("caga 2") ||
    (norm.includes("2") && (norm.includes("accueil") || norm.includes("gestion administrative")))
  ) {
    return "caga-2";
  }
  if (norm.includes("caga") || norm.includes("accueil") || norm.includes("gestion administrative")) {
    return "caga-generic";
  }

  // Autres métiers
  if (norm.includes("cycle")) return "cycles";
  if (norm.includes("massage") || norm.includes("bien etre")) return "bien-etre";

  // Autonomie & adaptation
  if (norm.includes("adaptation")) return "adaptation";
  if (norm.includes("tremplin")) return "tremplin";

  // Modules transversaux
  if (norm.includes("journaliere") || norm.includes("avj")) return "avj";
  if (norm.includes("braille")) return "braille";
  if (norm.includes("locomotion")) return "locomotion";
  if (norm.includes("outils adaptes") || norm.includes("technologies d assistance")) return "outils-adaptes";
  if (norm.includes("bureautique")) return "bureautique";
  if (norm.includes("deficience visuelle") || norm.includes("sensi dv")) return "sensi-dv";

  return norm;
}

/**
 * Deduplicates a list of formations to prevent duplicate listings
 * (e.g. "Préparatoire informatique" and "Préparatoire informatique (1 an)").
 * Keeps the most specific/detailed active record or the one with enrolled trainees.
 */
export function deduplicateFormationsList(formations: Formation[]): Formation[] {
  const seenCanonical = new Map<string, Formation>();

  for (const f of formations) {
    if (f.active === false) continue;
    const key = getCanonicalKey(f.title);
    const existing = seenCanonical.get(key);

    if (!existing) {
      seenCanonical.set(key, f);
    } else {
      const existingTrainees = existing.traineeIds?.length ?? 0;
      const currentTrainees = f.traineeIds?.length ?? 0;
      if (currentTrainees > existingTrainees) {
        seenCanonical.set(key, f);
      } else if (currentTrainees === existingTrainees) {
        const existingScore =
          (existing.shortCode ? 2 : 0) +
          (existing.yearLevel ? 2 : 0) +
          (existing.title.includes("(") ? 1 : 0);
        const currentScore =
          (f.shortCode ? 2 : 0) +
          (f.yearLevel ? 2 : 0) +
          (f.title.includes("(") ? 1 : 0);
        if (currentScore > existingScore) {
          seenCanonical.set(key, f);
        }
      }
    }
  }

  // Filter out obsolete generic titles if specific promotions (1ère/2ème année) are present
  const res = Array.from(seenCanonical.values());
  const hasTipYear = res.some((f) => getCanonicalKey(f.title) === "tip-1" || getCanonicalKey(f.title) === "tip-2");
  const hasKineYear = res.some((f) => ["kine-1", "kine-2", "kine-3", "kine-4"].includes(getCanonicalKey(f.title)));
  const hasCagaYear = res.some((f) => getCanonicalKey(f.title) === "caga-1" || getCanonicalKey(f.title) === "caga-2");

  const filtered = res.filter((f) => {
    const k = getCanonicalKey(f.title);
    if (k === "tip-generic" && hasTipYear && (!f.traineeIds || f.traineeIds.length === 0)) return false;
    if (k === "kine-generic" && hasKineYear && (!f.traineeIds || f.traineeIds.length === 0)) return false;
    if (k === "caga-generic" && hasCagaYear && (!f.traineeIds || f.traineeIds.length === 0)) return false;
    return true;
  });

  return filtered.sort(byTitle);
}

let cachedFormationsList: Formation[] | null = null;
let lastFormationsFetch = 0;

export function invalidateFormationsCache(): void {
  cachedFormationsList = null;
}

export async function listFormations(force = false): Promise<Formation[]> {
  if (!force && cachedFormationsList && Date.now() - lastFormationsFetch < 15_000) {
    return cachedFormationsList;
  }

  try {
    const snap = await getDocs(collection(getDb(), COLLECTIONS.formations));
    const list = snap.docs
      .map((d) => {
        const f = withId<Formation>(d);
        const duration =
          f.duration && f.duration.trim() !== "" && f.duration.trim() !== "—"
            ? f.duration
            : getOfficialDuration(f.title);
        return { ...f, duration };
      })
      .sort(byTitle);
    if (list.length > 0) {
      const deduped = deduplicateFormationsList(list);
      cachedFormationsList = deduped;
      lastFormationsFetch = Date.now();
      return deduped;
    }
  } catch (err) {
    console.warn("listFormations: could not read 'formations', checking 'courses':", err);
  }

  try {
    const legacySnap = await getDocs(collection(getDb(), "courses"));
    const list = legacySnap.docs
      .map((d) => {
        const f = withId<Formation>(d);
        const duration =
          f.duration && f.duration.trim() !== "" && f.duration.trim() !== "—"
            ? f.duration
            : getOfficialDuration(f.title);
        return { ...f, duration };
      })
      .sort(byTitle);
    const deduped = deduplicateFormationsList(list);
    cachedFormationsList = deduped;
    lastFormationsFetch = Date.now();
    return deduped;
  } catch (err) {
    console.warn("listFormations: fallback to courses also failed or empty:", err);
    return [];
  }
}

export async function createFormation(actor: Actor, data: FormationInput): Promise<string> {
  const ref = doc(collection(getDb(), COLLECTIONS.formations));
  await auditedBatch(
    actor,
    { action: "formation.create", entityType: "formation", entityId: ref.id, summary: `Création de la formation « ${data.title} »` },
    (batch, lastAuditId) => batch.set(ref, { ...data, lastAuditId }),
  );
  invalidateFormationsCache();
  return ref.id;
}

/** Updates the descriptive fields (enrolment is handled separately). */
export async function updateFormation(actor: Actor, formation: Formation, data: Partial<FormationInput>): Promise<void> {
  const { traineeIds: _ignored, ...editable } = stripMeta({ ...data });
  void _ignored;
  const changes = diffChanges<Formation>(formation, editable, EDITABLE);
  if (!changes) return;
  const verb = "active" in changes ? (editable.active ? "Réactivation" : "Archivage") : "Modification";
  await auditedBatch(
    actor,
    { action: "formation.update", entityType: "formation", entityId: formation.id, summary: `${verb} de la formation « ${formation.title} »`, changes },
    (batch, lastAuditId) => batch.update(formationRef(formation.id), { ...editable, lastAuditId }),
  );
  invalidateFormationsCache();
}

/**
 * Synchronizes the real multi-year catalog (1ère année, 2ème année, Kiné K1-K4...)
 * with the Firestore database. Creates missing formations and cleanly archives
 * old generic titles with 0 trainees.
 */
export async function syncCatalogFormations(actor: Actor): Promise<{ created: number; updated: number }> {
  const current = await listFormations();
  const byTitle = new Map(current.map((f) => [f.title.toLowerCase().trim(), f]));
  let created = 0;
  let updated = 0;

  for (const item of FORMATION_CATALOG) {
    const existing = byTitle.get(item.title.toLowerCase().trim());
    if (!existing) {
      await createFormation(actor, {
        title: item.title,
        category: item.category,
        description: item.description,
        duration: item.duration,
        certification: item.certification,
        pedagogicalLeadId: "",
        traineeIds: [],
        active: true,
        yearLevel: item.yearLevel ?? null,
        totalYears: item.totalYears ?? null,
        shortCode: item.shortCode ?? "",
        academicYear: "2025-2026",
      });
      created++;
    } else {
      const patch: Partial<FormationInput> = {};
      if (item.yearLevel && existing.yearLevel !== item.yearLevel) patch.yearLevel = item.yearLevel;
      if (item.totalYears && existing.totalYears !== item.totalYears) patch.totalYears = item.totalYears;
      if (item.shortCode && existing.shortCode !== item.shortCode) patch.shortCode = item.shortCode;
      if (item.duration && existing.duration !== item.duration) patch.duration = item.duration;
      if (item.certification && existing.certification !== item.certification) patch.certification = item.certification;
      if (Object.keys(patch).length > 0) {
        await updateFormation(actor, existing, patch);
        updated++;
      }
    }
  }

  // Deactivate old generic entries (e.g. without year specification) when they have 0 trainees
  const obsoleteTitles = [
    "technicien informatique de proximité",
    "de masseur(euse) kinésithérapeute",
    "de masseur kinésithérapeute",
    "chargé(e) d'accueil et de gestion administrative",
    "technicien d'assistance informatique (tap)",
    "préparatoire informatique",
    "mise à niveau scientifique",
    "adaptation aux outils et à l'autonomie",
    "mécanicien(ne) cycles",
    "praticien(ne) en massages de bien-être",
  ];
  for (const f of current) {
    const normalized = f.title.toLowerCase().trim();
    if (obsoleteTitles.includes(normalized) && (!f.traineeIds || f.traineeIds.length === 0) && f.active !== false) {
      await updateFormation(actor, f, { active: false });
      updated++;
    }
  }

  return { created, updated };
}

/**
 * Permanently cleans up any redundant/duplicate formation records in Firestore database.
 * Deactivates duplicate documents and merges traineeIds if needed so that no two records
 * represent the same promotion (e.g. "Préparatoire informatique" vs "Préparatoire informatique (1 an)").
 */
export async function cleanDuplicateFormationsInDb(actor: Actor): Promise<{ cleanedCount: number }> {
  const db = getDb();
  let cleanedCount = 0;
  const collectionsToCheck = [COLLECTIONS.formations, "courses"];

  for (const colName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, colName));
      const byKey = new Map<string, { docSnap: any; data: any }[]>();

      for (const d of snap.docs) {
        const data = d.data();
        if (data.active === false) continue;
        const key = getCanonicalKey(data.title ?? "");
        const list = byKey.get(key) ?? [];
        list.push({ docSnap: d, data });
        byKey.set(key, list);
      }

      for (const [_, items] of byKey.entries()) {
        if (items.length <= 1) continue;

        // Rank items: highest enrolled trainees first, then highest metadata score
        items.sort((a, b) => {
          const aTrainees = a.data.traineeIds?.length ?? 0;
          const bTrainees = b.data.traineeIds?.length ?? 0;
          if (bTrainees !== aTrainees) return bTrainees - aTrainees;

          const aScore =
            (a.data.shortCode ? 2 : 0) +
            (a.data.yearLevel ? 2 : 0) +
            (String(a.data.title).includes("(") ? 1 : 0);
          const bScore =
            (b.data.shortCode ? 2 : 0) +
            (b.data.yearLevel ? 2 : 0) +
            (String(b.data.title).includes("(") ? 1 : 0);
          return bScore - aScore;
        });

        const best = items[0];
        const duplicates = items.slice(1);

        for (const dup of duplicates) {
          const f = withId<Formation>(dup.docSnap);
          // If the duplicate had trainees and best is in the same collection, merge them
          if (dup.data.traineeIds?.length && best.docSnap.id !== dup.docSnap.id) {
            try {
              const bestF = withId<Formation>(best.docSnap);
              const combined = Array.from(new Set([...(best.data.traineeIds ?? []), ...dup.data.traineeIds]));
              await updateFormation(actor, bestF, { traineeIds: combined } as any);
            } catch {}
          }
          await updateFormation(actor, f, { active: false });
          cleanedCount++;
        }
      }

      // Also clean obsolete generic titles when specific year promotions exist
      const hasTip = byKey.has("tip-1") || byKey.has("tip-2");
      const hasKine = byKey.has("kine-1");
      const hasCaga = byKey.has("caga-1");

      for (const [key, items] of byKey.entries()) {
        if (
          (key === "tip-generic" && hasTip) ||
          (key === "kine-generic" && hasKine) ||
          (key === "caga-generic" && hasCaga)
        ) {
          for (const item of items) {
            const trainees = item.data.traineeIds?.length ?? 0;
            if (trainees === 0 && item.data.active !== false) {
              const f = withId<Formation>(item.docSnap);
              await updateFormation(actor, f, { active: false });
              cleanedCount++;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`cleanDuplicateFormationsInDb error checking ${colName}:`, err);
    }
  }

  if (cleanedCount > 0) {
    invalidateFormationsCache();
  }

  return { cleanedCount };
}

export interface FormationGroup {
  group: string;
  items: Formation[];
}

/**
 * Groups formations logically by sector / educational branch
 * (Informatique, Kinésithérapie, Tertiaire, Autonomie, Modules).
 * Automatically deduplicates the items so no duplicate promotion appears.
 */
export function groupFormations(formations: Formation[]): FormationGroup[] {
  // Always deduplicate first so no duplicate promotion is ever presented in UI groups
  const deduped = deduplicateFormationsList(formations);

  const groups: Record<string, Formation[]> = {
    "Filière Informatique (Numérique)": [],
    "Filière Masso-Kinésithérapie (IFMK — 5 ans)": [],
    "Filière Tertiaire & Administrative (sur 2 ans)": [],
    "Autres Formations Professionnelles (1 an)": [],
    "Dispositifs d'Adaptation & Autonomie": [],
    "Modules transversaux & Ateliers": [],
    "Autres formations": [],
  };

  for (const f of deduped) {
    if (f.active === false) continue;
    const title = f.title.toLowerCase();
    if (
      title.includes("informatique") ||
      title.includes("tip") ||
      title.includes("dwwm") ||
      title.includes("numérique")
    ) {
      groups["Filière Informatique (Numérique)"].push(f);
    } else if (
      title.includes("kiné") ||
      title.includes("k1") ||
      title.includes("k2") ||
      title.includes("k3") ||
      title.includes("k4") ||
      title.includes("scientifique")
    ) {
      groups["Filière Masso-Kinésithérapie (IFMK — 5 ans)"].push(f);
    } else if (
      title.includes("accueil") ||
      title.includes("gestion administrative") ||
      title.includes("caga") ||
      title.includes("secrétariat")
    ) {
      groups["Filière Tertiaire & Administrative (sur 2 ans)"].push(f);
    } else if (
      title.includes("cycles") ||
      title.includes("massages") ||
      title.includes("bien-être")
    ) {
      groups["Autres Formations Professionnelles (1 an)"].push(f);
    } else if (
      title.includes("adaptation") ||
      title.includes("tremplin")
    ) {
      groups["Dispositifs d'Adaptation & Autonomie"].push(f);
    } else if (
      f.category === "module" ||
      title.includes("journalière") ||
      title.includes("braille") ||
      title.includes("locomotion") ||
      title.includes("bureautique")
    ) {
      groups["Modules transversaux & Ateliers"].push(f);
    } else {
      groups["Autres formations"].push(f);
    }
  }

  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([group, items]) => ({ group, items }));
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
  invalidateFormationsCache();
}

/** Resets all trainees of a formation back to empty (0 trainees). */
export async function clearFormationTrainees(actor: Actor, formation: Formation): Promise<void> {
  await auditedBatch(
    actor,
    {
      action: "formation.unenrollAll",
      entityType: "formation",
      entityId: formation.id,
      summary: `Réinitialisation de tous les stagiaires de la formation « ${formation.title} »`,
    },
    (batch, lastAuditId) => batch.update(formationRef(formation.id), { traineeIds: [], lastAuditId }),
  );
  invalidateFormationsCache();
}

/**
 * Purges all fictitious / test trainees from all formations and removes trainee accounts.
 * Safe: only affects role === "trainee" and resets formation.traineeIds. Staff accounts are preserved.
 */
export async function purgeAllTrainees(actor: Actor): Promise<{ formationsReset: number; traineesDeleted: number }> {
  let formationsReset = 0;

  // 1. Reset formations in COLLECTIONS.formations
  const formationsSnap = await getDocs(collection(getDb(), COLLECTIONS.formations));
  for (const fDoc of formationsSnap.docs) {
    const data = fDoc.data();
    if (data.traineeIds && data.traineeIds.length > 0) {
      await auditedBatch(
        actor,
        {
          action: "formation.purgeTrainees",
          entityType: "formation",
          entityId: fDoc.id,
          summary: `Purge des stagiaires de « ${data.title ?? fDoc.id} »`,
        },
        (batch, lastAuditId) => batch.update(fDoc.ref, { traineeIds: [], lastAuditId }),
      );
      formationsReset++;
    }
  }

  // 2. Also check legacy "courses" collection
  try {
    const coursesSnap = await getDocs(collection(getDb(), "courses"));
    for (const cDoc of coursesSnap.docs) {
      const data = cDoc.data();
      if (data.traineeIds && data.traineeIds.length > 0) {
        await auditedBatch(
          actor,
          {
            action: "formation.purgeTrainees",
            entityType: "formation",
            entityId: cDoc.id,
            summary: `Purge des stagiaires de « ${data.title ?? cDoc.id} »`,
          },
          (batch, lastAuditId) => batch.update(cDoc.ref, { traineeIds: [], lastAuditId }),
        );
        formationsReset++;
      }
    }
  } catch {}

  // 3. Remove all dummy trainees from users collection (role === "trainee" only)
  const usersSnap = await getDocs(query(collection(getDb(), COLLECTIONS.users), where("role", "==", "trainee")));
  let traineesDeleted = 0;
  for (const uDoc of usersSnap.docs) {
    await auditedBatch(
      actor,
      {
        action: "user.purgeTrainee",
        entityType: "user",
        entityId: uDoc.id,
        summary: `Suppression du stagiaire de test « ${uDoc.data().fullName ?? uDoc.id} »`,
      },
      (batch) => batch.delete(uDoc.ref),
      { entryId: `del_${uDoc.id}` },
    );
    traineesDeleted++;
  }

  invalidateFormationsCache();
  return { formationsReset, traineesDeleted };
}

/**
 * Registers trainees from an import file into a formation. Trainees already
 * known (same email, or same name when no email) are reused, not duplicated.
 * If replaceExisting is true, replaces existing enrolled trainees with the new list.
 */
export async function importTrainees(
  actor: Actor,
  formation: Formation,
  trainees: ParsedTrainee[],
  options?: { replaceExisting?: boolean },
): Promise<{ created: number; reused: number }> {
  const replaceExisting = Boolean(options?.replaceExisting);
  const existing = await listUsers("trainee");
  const byEmail = new Map(existing.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));
  const byFullName = new Map(existing.map((u) => [u.fullName.toLowerCase(), u.id]));
  let created = 0;
  let reused = 0;

  // One audit entry per batch, shared by every document of the batch.
  const groups = chunk(trainees, 200);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
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
    const isFirst = groupIndex === 0;

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
        if (replaceExisting && isFirst) {
          batch.update(formationRef(formation.id), { traineeIds: ids, lastAuditId });
        } else {
          batch.update(formationRef(formation.id), { traineeIds: arrayUnion(...ids), lastAuditId });
        }
      },
    );
  }
  invalidateFormationsCache();
  return { created, reused };
}
