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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
}

export async function listUsers(role?: Role): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(role ? query(users(), where("role", "==", role)) : users());
    return snap.docs.map((d) => withId<UserProfile>(d)).sort(byName);
  } catch (err) {
    console.warn("listUsers failed:", err);
    return [];
  }
}

/** Active staff members holding one of the roles (e.g. every trainer). */
export async function listStaff(roles: Role[]): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(query(users(), where("role", "in", roles)));
    return snap.docs.map((d) => withId<UserProfile>(d)).filter(isActive).sort(byName);
  } catch (err) {
    console.warn("listStaff failed:", err);
    return [];
  }
}

export async function listUsersByIds(ids: string[]): Promise<UserProfile[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  try {
    const results = await Promise.all(
      chunk(unique, 30).map((part) => getDocs(query(users(), where(documentId(), "in", part)))),
    );
    return results.flatMap((s) => s.docs.map((d) => withId<UserProfile>(d))).sort(byName);
  } catch (err) {
    console.warn("listUsersByIds failed:", err);
    return [];
  }
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
      onData(list);
    },
    (err) => {
      console.warn("subscribeUsers failed:", err);
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
