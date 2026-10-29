"use client";

import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { accountErrorMessage, createStaffAccount } from "@/lib/data/accounts";
import type { Actor } from "@/lib/data/audit";
import { isActive, listUsers, setUserActive, updateUser } from "@/lib/data/users";
import { ROLES, ROLE_LABELS, STAFF_ROLES, type Role, type UserProfile } from "@/lib/domain/types";

export function UserManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [filter, setFilter] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setError("Impossible de charger les utilisateurs."));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!users) return <Loading />;

  const reload = async () => setUsers(await listUsers());
  const visible = filter ? users.filter((u) => u.role === filter) : users;

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await reload();
      announce(success);
    } catch (e) {
      announce(`Échec : ${accountErrorMessage(e)}`, "assertive");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <CreateUserForm actor={actor} onCreated={async (name) => run(async () => {}, `Compte de ${name} créé.`)} />

      <section aria-labelledby="users-heading" className="flex flex-col gap-4">
        <h2 id="users-heading" className="text-xl font-bold">
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
                <th scope="col" className="p-3">Rôle</th>
                <th scope="col" className="p-3">Statut</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === actor.id}
                  onRoleChange={(role) => run(() => updateUser(actor, u, { role }), `${u.fullName} : rôle ${ROLE_LABELS[role]} enregistré.`)}
                  onToggleActive={() =>
                    run(
                      () => setUserActive(actor, u, !isActive(u)),
                      `Compte de ${u.fullName} ${isActive(u) ? "désactivé" : "réactivé"}.`,
                    )
                  }
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
  onRoleChange,
  onToggleActive,
}: {
  user: UserProfile;
  isSelf: boolean;
  onRoleChange: (role: Role) => Promise<void>;
  onToggleActive: () => Promise<void>;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const active = isActive(user);
  // A trainee has no login: turning one into staff requires creating a real account.
  const roleOptions = user.role === "trainee" ? (["trainee"] as Role[]) : STAFF_ROLES;

  return (
    <tr className={`border-t-2 border-gray-200 align-top ${active ? "" : "text-gray-600"}`}>
      <th scope="row" className="p-3 font-semibold">
        {user.fullName}
        {isSelf && <span className="font-normal"> (vous)</span>}
      </th>
      <td className="break-all p-3">{user.email || "—"}</td>
      <td className="p-3">
        <SelectField label={`Rôle de ${user.fullName}`} value={role} disabled={isSelf || user.role === "trainee"} onChange={(e) => setRole(e.target.value as Role)}>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
      </td>
      <td className="p-3">{active ? "Actif" : "Désactivé"}</td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRoleChange(role)} disabled={role === user.role} aria-label={`Enregistrer le rôle de ${user.fullName}`}>
            Enregistrer
          </Button>
          {!isSelf &&
            (active ? (
              <ConfirmDialog
                triggerLabel="Désactiver"
                triggerAccessibleLabel={`Désactiver le compte de ${user.fullName}`}
                title="Désactiver ce compte ?"
                description={`${user.fullName} ne pourra plus accéder à l'application. Son historique est conservé et le compte peut être réactivé à tout moment.`}
                confirmLabel="Désactiver"
                onConfirm={onToggleActive}
              />
            ) : (
              <Button variant="secondary" onClick={onToggleActive} aria-label={`Réactiver le compte de ${user.fullName}`}>
                Réactiver
              </Button>
            ))}
        </div>
      </td>
    </tr>
  );
}

function CreateUserForm({ actor, onCreated }: { actor: Actor; onCreated: (name: string) => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("trainer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) return setError("Le nom et l'email sont obligatoires.");
    if (password.length < 8) return setError("Le mot de passe provisoire doit contenir au moins 8 caractères.");
    setBusy(true);
    try {
      await createStaffAccount(actor, { fullName: fullName.trim(), email: email.trim(), password, role });
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
