"use client";

import { ProtectedPage } from "@/components/ProtectedPage";
import { UserProfileManager } from "@/features/profile/UserProfileManager";

export default function ProfilePage() {
  return (
    <ProtectedPage
      title="Mon Profil & Sécurité"
      description="Consultez et modifiez vos informations professionnelles et mettez à jour votre mot de passe d'accès."
    >
      {(profile) => <UserProfileManager actor={profile} />}
    </ProtectedPage>
  );
}
