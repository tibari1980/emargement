import { collection, doc, documentId, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import { ROLE_LABELS, type Role, type UserProfile } from "@/lib/domain/types";
import { auditedBatch, diffChanges, type Actor } from "./audit";
import { byName, chunk, COLLECTIONS, withId } from "./db";

const users = () => collection(getDb(), COLLECTIONS.users);

export const isActive = (u: Pick<UserProfile, "active">) => u.active !== false;

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
}

export async function listUsers(role?: Role): Promise<UserProfile[]> {
  const snap = await getDocs(role ? query(users(), where("role", "==", role)) : users());
  return snap.docs.map((d) => withId<UserProfile>(d)).sort(byName);
}

/** Active staff members holding one of the roles (e.g. every trainer). */
export async function listStaff(roles: Role[]): Promise<UserProfile[]> {
  const snap = await getDocs(query(users(), where("role", "in", roles)));
  return snap.docs.map((d) => withId<UserProfile>(d)).filter(isActive).sort(byName);
}

export async function listUsersByIds(ids: string[]): Promise<UserProfile[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const results = await Promise.all(
    chunk(unique, 30).map((part) => getDocs(query(users(), where(documentId(), "in", part)))),
  );
  return results.flatMap((s) => s.docs.map((d) => withId<UserProfile>(d))).sort(byName);
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
