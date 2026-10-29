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
  const [state, setState] = useState<Pick<AuthState, "user" | "profile" | "loading">>({
    user: null,
    profile: null,
    loading: configured,
  });

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const profile = await getUserProfile(user.uid);
        setState({ user, profile, loading: false });
      } catch (error) {
        console.error(error);
        setState({ user, profile: null, loading: false });
      }
    });
  }, [configured]);

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
  };

  const refreshProfile = async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    setState({ user, profile: await getUserProfile(user.uid), loading: false });
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
