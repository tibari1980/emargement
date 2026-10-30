"use client";

import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/core/firebase";
import { getUserProfile } from "@/lib/data/users";
import type { UserProfile } from "@/lib/domain/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  /** Reloads the Firestore profile (e.g. right after the first-run setup). */
  refreshProfile: () => Promise<void>;
}

const SESSION_CACHE_KEY = "avh_auth_session_cache_v1";

interface CachedSession {
  uid: string;
  email: string | null;
  profile: UserProfile;
  cachedAt: number;
}

function loadCachedSession(): { user: User; profile: UserProfile } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const data: CachedSession = JSON.parse(raw);
    // Cached session valid for 7 days
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    if (data && data.uid && data.profile && Date.now() - data.cachedAt < MAX_AGE_MS) {
      const syntheticUser = {
        uid: data.uid,
        email: data.email,
      } as unknown as User;
      return { user: syntheticUser, profile: data.profile };
    }
  } catch {
    // Ignore JSON errors
  }
  return null;
}

function saveCachedSession(uid: string, email: string | null, profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    const data: CachedSession = {
      uid,
      email,
      profile,
      cachedAt: Date.now(),
    };
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private mode
  }
}

function clearCachedSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {}
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  configured: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  
  // Predictable initial state for SSR: server & client first render match 100% (eliminates hydration error)
  const [state, setState] = useState<Pick<AuthState, "user" | "profile" | "loading">>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    if (!configured) {
      setState({ user: null, profile: null, loading: false });
      return;
    }

    // Instantly restore cached session on client mount (0ms, no network delay)
    const cached = loadCachedSession();
    if (cached) {
      setState({ user: cached.user, profile: cached.profile, loading: false });
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearCachedSession();
        setState({ user: null, profile: null, loading: false });
        return;
      }

      // Revalidate in background: fetch latest profile from Firestore
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          saveCachedSession(firebaseUser.uid, firebaseUser.email, profile);
          setState({ user: firebaseUser, profile, loading: false });
        } else {
          clearCachedSession();
          setState({ user: firebaseUser, profile: null, loading: false });
        }
      } catch (error) {
        console.error("Erreur lors de la synchronisation du profil Firestore:", error);
        // Keep existing profile if available to maintain uninterrupted workflow
        setState((prev) => ({
          user: firebaseUser,
          profile: prev.profile,
          loading: false,
        }));
      }
    });

    return () => unsubscribe();
  }, [configured]);

  const signOut = async () => {
    clearCachedSession();
    setState({ user: null, profile: null, loading: false });
    await firebaseSignOut(getFirebaseAuth());
  };

  const refreshProfile = async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        saveCachedSession(user.uid, user.email, profile);
        setState({ user, profile, loading: false });
      }
    } catch (e) {
      console.error("Erreur refreshProfile:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, configured, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
