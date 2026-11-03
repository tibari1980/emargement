import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getDb, getFirebaseAuth } from "@/lib/core/firebase";
import { ROLE_LABELS, type AuditChange, type Role, type UserProfile } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byName, chunk, COLLECTIONS, stripMeta, withId } from "./db";

const users = () => collection(getDb(), COLLECTIONS.users);

export const isActive = (u: Pick<UserProfile, "active">) => u.active !== false;

export const DEMO_USERS: UserProfile[] = [
  {
    id: "p5iCAyUimmhjjY4Hq8QAHpDxiYJ2",
    fullName: "Alice Administratrice",
    email: "admin@avh-test.fr",
    role: "admin",
    active: true,
  },
  {
    id: "fXNdnYUP7EQ4ajZVKoGSq3cwtgA2",
    fullName: "Sophie Secrétaire",
    email: "secretariat@avh-test.fr",
    role: "secretary",
    active: true,
  },
  {
    id: "tdbL2rH5LTTHagluHiXbzvCcGjk2",
    fullName: "Paul Responsable",
    email: "responsable@avh-test.fr",
    role: "pedagogical_lead",
    active: true,
  },
  {
    id: "L5ZcFkR961OBv4VjVyXurZuhOcM2",
    fullName: "Thomas Formateur",
    email: "formateur@avh-test.fr",
    role: "trainer",
    active: true,
  },
];

/**
 * 8 Stagiaires inscrits dans le dispositif d'autonomie « Adaptation aux outils et à l'autonomie (1 an) »
 * du CFRP Valentin Haüy. Permet le suivi d'émargement et la saisie de justificatifs d'absence.
 */
export const ADAPTATION_TRAINEES: UserProfile[] = [
  { id: "adapt-t1", fullName: "Marc Lefebvre", email: "marc.lefebvre@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t2", fullName: "Émilie Roussel", email: "emilie.roussel@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t3", fullName: "Julien Mercier", email: "julien.mercier@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t4", fullName: "Nadia Belkacem", email: "nadia.belkacem@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t5", fullName: "Antoine Gauthier", email: "antoine.gauthier@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t6", fullName: "Claire Fontaine", email: "claire.fontaine@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t7", fullName: "Youssef Mansouri", email: "youssef.mansouri@avh-asso.fr", role: "trainee", active: true },
  { id: "adapt-t8", fullName: "Hélène Marchand", email: "helene.marchand@avh-asso.fr", role: "trainee", active: true },
];

const LOCAL_USERS_KEY = "avh_persisted_users_v2";
const memoryUserCache = new Map<string, UserProfile>();
const staffCache = new Map<string, { at: number; list: UserProfile[] }>();

export function invalidateUsersCache(): void {
  staffCache.clear();
}

export function getLocalUsersMap(): Map<string, UserProfile> {
  const map = new Map<string, UserProfile>();
  DEMO_USERS.forEach((u) => map.set(u.id, u));
  ADAPTATION_TRAINEES.forEach((u) => map.set(u.id, u));
  memoryUserCache.forEach((u, id) => map.set(id, u));
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      if (raw) {
        const parsed: UserProfile[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => {
            map.set(u.id, u);
            memoryUserCache.set(u.id, u);
          });
        }
      }
    } catch {}
  }
  return map;
}

export function saveLocalUser(user: UserProfile): void {
  memoryUserCache.set(user.id, user);
  staffCache.clear();
  if (typeof window === "undefined") return;
  try {
    const map = getLocalUsersMap();
    map.set(user.id, user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

export function saveLocalUsers(newUsers: UserProfile[]): void {
  newUsers.forEach((u) => memoryUserCache.set(u.id, u));
  staffCache.clear();
  if (typeof window === "undefined") return;
  try {
    const map = getLocalUsersMap();
    newUsers.forEach((u) => map.set(u.id, u));
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as UserProfile;
  } catch (err) {
    console.warn("getUserProfile failed:", err);
  }
  const localMap = getLocalUsersMap();
  return localMap.get(uid) ?? null;
}

export async function listUsers(role?: Role): Promise<UserProfile[]> {
  const localMap = getLocalUsersMap();
  try {
    const snap = await getDocs(role ? query(users(), where("role", "==", role)) : users());
    const res = snap.docs.map((d) => withId<UserProfile>(d)).sort(byName);
    if (res.length > 0) {
      saveLocalUsers(res);
      return res;
    }
  } catch (err) {
    console.warn("listUsers failed, using demo users:", err);
  }
  const all = Array.from(localMap.values());
  return (role ? all.filter((u) => u.role === role) : all).sort(byName);
}

/** Synchronous (0ms) staff lookup for instant initial render. */
export function getInitialStaff(roles: Role[]): UserProfile[] {
  const key = [...roles].sort().join(",");
  const cached = staffCache.get(key);
  if (cached) return cached.list;
  const localMap = getLocalUsersMap();
  const list = Array.from(localMap.values()).filter((u) => roles.includes(u.role) && isActive(u)).sort(byName);
  return list.length > 0 ? list : DEMO_USERS.filter((u) => roles.includes(u.role) && u.active).sort(byName);
}

/** Active staff members holding one of the roles (e.g. every trainer). */
export async function listStaff(roles: Role[]): Promise<UserProfile[]> {
  const key = [...roles].sort().join(",");
  const cached = staffCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) {
    return cached.list;
  }
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
    const snap = await Promise.race([getDocs(query(users(), where("role", "in", roles))), timeout]);
    const res = snap.docs.map((d) => withId<UserProfile>(d)).filter(isActive).sort(byName);
    if (res.length > 0) {
      saveLocalUsers(res);
      staffCache.set(key, { at: Date.now(), list: res });
      return res;
    }
  } catch (err) {
    console.warn("listStaff failed, using demo staff:", err);
  }
  const fallback = getInitialStaff(roles);
  const isRealData = fallback.some((u) => !DEMO_USERS.some((d) => d.id === u.id));
  if (isRealData) {
    staffCache.set(key, { at: Date.now(), list: fallback });
  }
  return fallback;
}

/** Synchronous (0ms) lookup of users by IDs from local/memory cache. */
export function getUsersByIdsSync(ids: string[]): UserProfile[] {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const localMap = getLocalUsersMap();
  return unique
    .map((id) => localMap.get(id))
    .filter((u): u is UserProfile => Boolean(u))
    .sort(byName);
}

export async function listUsersByIds(ids: string[]): Promise<UserProfile[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const localMap = getLocalUsersMap();

  // Fast path: if every requested ID is already known in localMap/memoryUserCache, return immediately
  const missingIds = unique.filter((id) => !localMap.has(id));
  if (missingIds.length === 0) {
    return unique
      .map((id) => localMap.get(id)!)
      .sort(byName);
  }

  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
    const results = await Promise.race([
      Promise.all(
        chunk(missingIds, 30).map((part) => getDocs(query(users(), where(documentId(), "in", part)))),
      ),
      timeout,
    ]);
    const fromDb = results.flatMap((s) => s.docs.map((d) => withId<UserProfile>(d)));
    if (fromDb.length > 0) {
      saveLocalUsers(fromDb);
    }
  } catch (err) {
    console.warn("listUsersByIds failed, using cached trainees:", err);
  }
  return unique
    .map((id) => localMap.get(id))
    .filter((u): u is UserProfile => Boolean(u))
    .sort(byName);
}

export async function updateUser(
  actor: Actor,
  user: UserProfile,
  changes: Partial<Pick<UserProfile, "fullName" | "role">>,
): Promise<void> {
  const diff = diffChanges(user, changes, ["fullName", "role"]);
  if (!diff) return;
  const what = changes.role && changes.role !== user.role ? ` : rôle ${ROLE_LABELS[changes.role]}` : "";
  await auditedBatch(
    actor,
    { action: "user.update", entityType: "user", entityId: user.id, summary: `Modification de ${user.fullName}${what}`, changes: diff },
    (batch, lastAuditId) => batch.update(doc(getDb(), COLLECTIONS.users, user.id), { ...changes, lastAuditId }),
  );
}

export async function setUserActive(actor: Actor, user: UserProfile, active: boolean): Promise<void> {
  await auditedBatch(
    actor,
    {
      action: active ? "user.activate" : "user.deactivate",
      entityType: "user",
      entityId: user.id,
      summary: `${active ? "Réactivation" : "Désactivation"} du compte de ${user.fullName}`,
      changes: { active: { from: isActive(user), to: active } },
    },
    (batch, lastAuditId) => batch.update(doc(getDb(), COLLECTIONS.users, user.id), { active, lastAuditId }),
  );
}

/**
 * Real-time dynamic Firestore subscription to users collection.
 * Supports optional role or active filtering to reduce Firestore read costs.
 */
export function subscribeUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe;
export function subscribeUsers(
  options: { role?: Role | ""; active?: boolean } | undefined,
  onData: (users: UserProfile[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe;
export function subscribeUsers(
  optionsOrOnData?:
    | { role?: Role | ""; active?: boolean }
    | ((users: UserProfile[]) => void),
  onDataOrOnError?: ((users: UserProfile[]) => void) | ((err: unknown) => void),
  maybeOnError?: (err: unknown) => void,
): Unsubscribe {
  let options: { role?: Role | ""; active?: boolean } | undefined;
  let onData: (users: UserProfile[]) => void;
  let onError: ((err: unknown) => void) | undefined;

  if (typeof optionsOrOnData === "function") {
    onData = optionsOrOnData;
    onError = onDataOrOnError as ((err: unknown) => void) | undefined;
  } else {
    options = optionsOrOnData;
    onData = (onDataOrOnError as (users: UserProfile[]) => void) || (() => {});
    onError = maybeOnError;
  }

  let q = query(users());
  if (options?.role) {
    q = query(users(), where("role", "==", options.role));
  } else if (options?.active !== undefined) {
    q = query(users(), where("active", "==", options.active));
  }

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => withId<UserProfile>(d)).sort(byName);
      if (list.length > 0) {
        onData(list);
      } else {
        const fallback = options?.role ? DEMO_USERS.filter((u) => u.role === options.role) : DEMO_USERS;
        onData(fallback);
      }
    },
    (err) => {
      console.warn("subscribeUsers failed, using demo fallback:", err);
      const fallback = options?.role ? DEMO_USERS.filter((u) => u.role === options.role) : DEMO_USERS;
      onData(fallback);
      onError?.(err);
    },
  );
}

/** Sends an official Firebase password reset email to the given address. */
export async function sendUserPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
}

/**
 * Permanently deletes a user account from Firestore.
 * Cleans up references in formations (traineeIds) and timetable slots (trainerId).
 * Safe-guarded against self-deletion.
 */
export async function deleteUser(actor: Actor, targetUser: UserProfile): Promise<void> {
  if (actor.id === targetUser.id) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  const db = getDb();

  // 1. Si le profil est un stagiaire, retrait propre de toutes ses formations
  if (targetUser.role === "trainee") {
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.formations), where("traineeIds", "array-contains", targetUser.id))
      );
      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          traineeIds: arrayRemove(targetUser.id),
        });
      }
    } catch (e) {
      console.warn("deleteUser: impossible de retirer le stagiaire des formations:", e);
    }
  }

  // 2. Si le profil est un formateur, nettoyage de ses créneaux de cours et matières
  if (targetUser.role === "trainer") {
    try {
      const slotsSnap = await getDocs(
        query(collection(db, COLLECTIONS.slots), where("trainerId", "==", targetUser.id))
      );
      for (const d of slotsSnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (e) {
      console.warn("deleteUser: impossible de supprimer les créneaux du formateur:", e);
    }

    try {
      const subjectsSnap = await getDocs(
        query(collection(db, COLLECTIONS.subjects), where("trainerIds", "array-contains", targetUser.id))
      );
      for (const d of subjectsSnap.docs) {
        await updateDoc(d.ref, {
          trainerIds: arrayRemove(targetUser.id),
        });
      }
    } catch (e) {
      console.warn("deleteUser: impossible de dissocier le formateur des matières:", e);
    }
  }

  // 3. Suppression définitive du document utilisateur avec journal d'audit
  await auditedBatch(
    actor,
    {
      action: "user.delete",
      entityType: "user",
      entityId: targetUser.id,
      summary: `Suppression définitive du compte de ${targetUser.fullName} (${ROLE_LABELS[targetUser.role]})`,
    },
    (batch) => batch.delete(doc(db, COLLECTIONS.users, targetUser.id)),
    { entryId: `del_user_${targetUser.id}` }
  );
}

/**
 * Updates the authenticated user's own professional profile.
 */
export async function updateOwnProfile(
  actor: Actor,
  changes: Partial<Pick<UserProfile, "fullName" | "phone" | "specialty" | "room">>,
): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== actor.id) {
    throw new Error("Action non autorisée.");
  }

  if (changes.fullName && changes.fullName.trim() !== "") {
    await updateProfile(user, { displayName: changes.fullName.trim() }).catch(() => {});
  }

  const editable = stripMeta({ ...changes });
  const auditChanges = Object.entries(editable).reduce<Record<string, AuditChange>>((acc, [k, v]) => {
    acc[k] = { from: null, to: v };
    return acc;
  }, {});

  await auditedBatch(
    actor,
    {
      action: "user.update",
      entityType: "user",
      entityId: actor.id,
      summary: `Mise à jour des informations professionnelles de ${actor.fullName}`,
      changes: auditChanges,
    },
    (batch, lastAuditId) =>
      batch.update(doc(getDb(), COLLECTIONS.users, actor.id), {
        ...editable,
        lastAuditId,
      }),
  );
}
