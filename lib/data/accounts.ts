// Account management with the Firebase client SDK only (no service account).

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth, getSecondaryAuth } from "@/lib/core/firebase";
import { ROLE_LABELS, type Role } from "@/lib/domain/types";
import { auditedBatch, type Actor } from "./audit";
import { COLLECTIONS } from "./db";

export function accountErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Un compte existe déjà avec cette adresse email.";
    case "auth/invalid-email":
      return "Adresse email invalide.";
    case "auth/weak-password":
      return "Mot de passe trop faible (8 caractères minimum).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Un compte existe déjà avec cet email, mais le mot de passe ne correspond pas.";
    case "auth/operation-not-allowed":
      return "La connexion par email / mot de passe n'est pas activée dans la console Firebase.";
    case "auth/network-request-failed":
      return "Connexion réseau impossible.";
    case "permission-denied":
      return "Accès refusé par la base de données : vérifiez vos droits et que les règles Firestore du projet sont à jour.";
    default:
      return "L'opération a échoué. Réessayez ou contactez un administrateur.";
  }
}

const bootstrapRef = () => doc(getDb(), COLLECTIONS.settings, "bootstrap");

/** True once the first administrator has been created. */
export async function isAppInitialised(): Promise<boolean> {
  return (await getDoc(bootstrapRef())).exists();
}

/**
 * First-run setup: creates (or signs in) the account, then writes its admin
 * profile, the settings/bootstrap marker and the audit entry atomically.
 */
export async function createFirstAdmin(input: { fullName: string; email: string; password: string }): Promise<void> {
  const auth = getFirebaseAuth();
  let user: User;
  try {
    user = (await createUserWithEmailAndPassword(auth, input.email, input.password)).user;
  } catch (error) {
    // Retry after an interrupted setup: the account exists already.
    if (error instanceof FirebaseError && error.code === "auth/email-already-in-use") {
      user = (await signInWithEmailAndPassword(auth, input.email, input.password)).user;
    } else {
      throw error;
    }
  }
  await updateProfile(user, { displayName: input.fullName }).catch(() => {});

  const actor: Actor = { id: user.uid, fullName: input.fullName, role: "admin" };
  await auditedBatch(
    actor,
    { action: "application.install", entityType: "application", entityId: "bootstrap", summary: `Installation de l'application par ${input.fullName}` },
    (batch, lastAuditId) => {
      batch.set(doc(getDb(), COLLECTIONS.users, user.uid), {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        role: "admin",
        active: true,
        createdAt: serverTimestamp(),
        lastAuditId,
      });
      batch.set(bootstrapRef(), { adminId: user.uid, createdAt: serverTimestamp() });
    },
  );
}

/** Creates a staff member's login and profile (called by an administrator). */
export async function createStaffAccount(
  actor: Actor,
  input: { fullName: string; email: string; password: string; role: Role },
): Promise<string> {
  const secondary = getSecondaryAuth();
  const { user } = await createUserWithEmailAndPassword(secondary, input.email, input.password);
  try {
    await updateProfile(user, { displayName: input.fullName }).catch(() => {});
    // Written with the administrator's session (main app), as required by the rules.
    await auditedBatch(
      actor,
      {
        action: "user.create",
        entityType: "user",
        entityId: user.uid,
        summary: `Création du compte de ${input.fullName} (${ROLE_LABELS[input.role]})`,
      },
      (batch, lastAuditId) =>
        batch.set(doc(getDb(), COLLECTIONS.users, user.uid), {
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          role: input.role,
          active: true,
          createdAt: serverTimestamp(),
          lastAuditId,
        }),
    );
    return user.uid;
  } finally {
    await signOut(secondary);
  }
}
