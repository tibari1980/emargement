"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FirebaseNotConfigured } from "@/components/ProtectedPage";
import { Loading } from "@/components/ui/Alert";
import { homeFor } from "@/lib/core/navigation";

/** Role-based redirector: sends each user to their own workspace. */
export default function HomePage() {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!configured || loading) return;
    if (!user) router.replace("/login");
    else if (profile) router.replace(homeFor(profile.role));
    else router.replace("/acces-refuse");
  }, [configured, loading, user, profile, router]);

  if (!configured) return <FirebaseNotConfigured />;
  return <Loading label="Redirection vers votre espace…" />;
}
