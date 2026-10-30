"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { UserManager } from "@/features/users/UserManager";

export default function UsersPage() {
  return (
    <ProtectedPage
      title="Utilisateurs"
      description="Créez les comptes du personnel et gérez leurs rôles. Les stagiaires sont ajoutés par import de fichier et n'ont pas de compte de connexion."
      permission="users.manage"
    >
      {(profile) => <UserManager actor={profile} />}
    </ProtectedPage>
  );
}
