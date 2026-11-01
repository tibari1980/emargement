// Firebase client SDK (browser). Initialised lazily so that prerendering
// on the server never touches Firebase.

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

function cleanEnv(val: string | undefined): string | undefined {
  const trimmed = val?.trim().replace(/^["']|["']$/g, "");
  return trimmed || undefined;
}

const firebaseConfig = {
  apiKey: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

let auth: Auth | undefined;
let db: Firestore | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(app());
    if (useEmulators) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return auth;
}

let secondaryAuth: Auth | undefined;

/**
 * Separate, in-memory Auth instance used by administrators to create staff
 * accounts: createUserWithEmailAndPassword signs the new user in, which on
 * the main instance would sign the administrator out.
 */
export function getSecondaryAuth(): Auth {
  if (!secondaryAuth) {
    const secondary =
      getApps().find((a) => a.name === "account-creation") ??
      initializeApp(firebaseConfig, "account-creation");
    secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
    if (useEmulators) {
      connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return secondaryAuth;
}

export function getDb(): Firestore {
  if (!db) {
    if (typeof window !== "undefined") {
      try {
        db = initializeFirestore(app(), {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        db = getFirestore(app());
      }
    } else {
      db = getFirestore(app());
    }
    if (useEmulators) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}
