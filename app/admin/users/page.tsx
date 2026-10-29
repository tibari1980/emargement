"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { accountErrorMessage, createStaffAccount, deleteUserProfile } from "@/lib/accounts";
import { listUsers, updateUserProfile } from "@/lib/firestore";
import { rolesFor } from "@/lib/navigation";
import {
  ROLES,
  ROLE_LABELS,
  SECTORS,
  SECTOR_LABELS,
  STAFF_ROLES,
  type Role,
  type Sector,
  type UserProfile,
} from "@/lib/types";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Créez les comptes du personnel et attribuez les rôles. Les stagiaires sont ajoutés par import de fichier et n'ont pas de compte de connexion."
      />
      <RoleGuard roles={rolesFor("/admin/users")}>{(profile) => <UserManager currentUserId={profile.id} />}</RoleGuard>
    </>
  );
}

function UserManager({ currentUserId }: { currentUserId: string }) {
  const announce = useAnnounce();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [filter, setFilter] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async () => setUsers(await listUsers()), []);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setError("Impossible de charger les utilisateurs."));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!users) return <Loading />;

  const visible = filter ? users.filter((u) => u.role === filter) : users;

  return (
    <div className="flex flex-col gap-8">
      <CreateUserForm
        onCreated={async (name) => {
          await reload();
          announce(`Compte de ${name} créé.`);
        }}
      />

      <section aria-labelledby="users-heading" className="flex flex-col gap-4">
        <h2 id="users-heading" ref={tableHeading} tabIndex={-1} className="text-xl font-bold outline-none">
          Comptes existants
        </h2>
        <div className="max-w-xs">
          <SelectField label="Filtrer par rôle" value={filter} onChange={(e) => setFilter(e.target.value as Role | "")}>
            <option value="">Tous les rôles ({users.length})</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} ({users.filter((u) => u.role === r).length})
              </option>
            ))}
          </SelectField>
        </div>
        <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Liste des utilisateurs, {visible.length} résultats</caption>
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="p-3">Nom</th>
                <th scope="col" className="p-3">Email</th>
                <th scope="col" className="p-3">Rôle et secteur</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUserId}
                  onChanged={async (message) => {
                    await reload();
                    announce(message);
                  }}
                  onDeleted={async () => {
                    await reload();
                    announce(`Compte de ${u.fullName} supprimé.`);
                    tableHeading.current?.focus();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
  onDeleted,
}: {
  user: UserProfile;
  isSelf: boolean;
  onChanged: (message: string) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const announce = useAnnounce();
  const [role, setRole] = useState<Role>(user.role);
  const [sector, setSector] = useState<Sector | "">(user.sector ?? "");
  const dirty = role !== user.role || sector !== (user.sector ?? "");
  // A trainee has no login: turning one into staff requires creating a real account.
  const roleOptions = user.role === "trainee" ? (["trainee"] as Role[]) : STAFF_ROLES;

  const save = async () => {
    try {
      await updateUserProfile(user.id, { role, sector: sector || null });
      await onChanged(`${user.fullName} : rôle ${ROLE_LABELS[role]} enregistré.`);
    } catch {
      announce(`Échec de la modification de ${user.fullName}.`, "assertive");
    }
  };

  return (
    <tr className="border-t-2 border-gray-200 align-top">
      <th scope="row" className="p-3 font-semibold">
        {user.fullName}
        {isSelf && <span className="font-normal"> (vous)</span>}
      </th>
      <td className="p-3 break-all">{user.email || "—"}</td>
      <td className="p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField
            label={`Rôle de ${user.fullName}`}
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          <SelectField label={`Secteur de ${user.fullName}`} value={sector} onChange={(e) => setSector(e.target.value as Sector | "")}>
            <option value="">Aucun</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </SelectField>
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!dirty} aria-label={`Enregistrer les modifications de ${user.fullName}`}>
            Enregistrer
          </Button>
          {!isSelf && (
            <ConfirmDialog
              triggerLabel="Supprimer"
              triggerAccessibleLabel={`Supprimer le compte de ${user.fullName}`}
              title="Supprimer ce compte ?"
              description={`Le profil de ${user.fullName} sera supprimé : la personne ne pourra plus accéder à l'application. Les émargements déjà enregistrés sont conservés.`}
              confirmLabel="Supprimer le compte"
              onConfirm={async () => {
                try {
                  await deleteUserProfile(user.id);
                  await onDeleted();
                } catch (e) {
                  announce(`Échec de la suppression : ${accountErrorMessage(e)}`, "assertive");
                }
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (name: string) => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("trainer");
  const [sector, setSector] = useState<Sector | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Le nom et l'email sont obligatoires.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe provisoire doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      await createStaffAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        sector: sector || null,
      });
      await onCreated(fullName.trim());
      setFullName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="create-user-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
      <h2 id="create-user-heading" className="mb-4 text-xl font-bold">
        Créer un compte du personnel
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="off" />
          <TextField label="Adresse email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          <TextField
            label="Mot de passe provisoire"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="8 caractères minimum. La personne pourra le changer avec « Mot de passe oublié »."
            autoComplete="new-password"
            required
          />
          <SelectField label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Secteur" value={sector} onChange={(e) => setSector(e.target.value as Sector | "")}>
            <option value="">Aucun</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Création…" : "Créer le compte"}
          </Button>
        </div>
      </form>
    </section>
  );
}
