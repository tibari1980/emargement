"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Actor } from "@/lib/data/audit";
import { isActive } from "@/lib/data/users";
import { can, type Permission } from "@/lib/domain/permissions";
import type { UserProfile } from "@/lib/domain/types";
import { useAuth } from "./AuthProvider";
import { Alert, Loading } from "./ui/Alert";
import { PageHeader } from "./ui/PageHeader";

/**
 * Page shell: title, then the content for signed-in users holding
 * `permission`. A UX guard only: data access is enforced by firestore.rules
 * and by the API routes.
 */
export function ProtectedPage({
  title,
  description,
  permission,
  children,
}: {
  title: string;
  description?: string;
  permission: Permission;
  children: (profile: UserProfile & Actor) => React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Guard permission={permission}>{children}</Guard>
    </>
  );
}

function Guard({
  permission,
  children,
}: {
  permission: Permission;
  children: (profile: UserProfile & Actor) => React.ReactNode;
}) {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/login");
  }, [configured, loading, user, router]);

  if (!configured) return <FirebaseNotConfigured />;
  if (loading || !user) return <Loading label="Vérification de votre session…" />;
  if (!profile) {
    return <Alert tone="error">Votre compte n&apos;a pas de profil dans l&apos;application. Contactez un administrateur.</Alert>;
  }
  if (!isActive(profile)) {
    return <Alert tone="error">Votre compte est désactivé. Contactez un administrateur.</Alert>;
  }
  if (!can(profile.role, permission)) {
    return <Alert tone="error">Vous n&apos;avez pas accès à cette page avec votre rôle actuel.</Alert>;
  }
  return <>{children(profile)}</>;
}

export function FirebaseNotConfigured() {
  return (
    <Alert tone="warning">
      Firebase n&apos;est pas configuré. Copiez le fichier <code>.env.example</code> en <code>.env.local</code>,
      renseignez les clés de votre projet Firebase puis redémarrez le serveur.
    </Alert>
  );
}
