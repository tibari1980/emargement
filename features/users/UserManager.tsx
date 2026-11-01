"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Search,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PasswordField, SelectField, TextField } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { authFetch, downloadBlob, fileNameFromResponse } from "@/lib/core/apiClient";
import { accountErrorMessage, createStaffAccount } from "@/lib/data/accounts";
import type { Actor } from "@/lib/data/audit";
import {
  deleteUser,
  isActive,
  listUsers,
  sendUserPasswordReset,
  setUserActive,
  subscribeUsers,
  updateUser,
} from "@/lib/data/users";
import { ROLES, ROLE_LABELS, STAFF_ROLES, type Role, type UserProfile } from "@/lib/domain/types";
import { usersExportFileName, type UsersExportPayload } from "@/lib/exports/usersExport";

export function UserManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [filter, setFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  // Pagination state (10 users per page by default)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Targeted Firestore subscription (filters by role on server side to minimize Firestore reads)
  useEffect(() => {
    let isSubscribed = true;
    const unsubscribe = subscribeUsers(
      filter ? { role: filter } : undefined,
      (list: UserProfile[]) => {
        if (isSubscribed) {
          setUsers(list);
          setError(null);
        }
      },
      (err) => {
        console.warn("UserManager: live subscription error, falling back to one-time fetch", err);
        listUsers(filter || undefined)
          .then((res) => {
            if (isSubscribed) {
              setUsers(res);
              setError(null);
            }
          })
          .catch(() => {
            if (isSubscribed) setUsers([]);
          });
      },
    );
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [filter]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!users) return <Loading label="Chargement des utilisateurs en temps réel…" />;

  const reload = async () => {
    try {
      const fresh = await listUsers(filter || undefined);
      setUsers(fresh);
    } catch {
      // Ignored: real-time listener will eventually sync
    }
  };

  const visible = users.filter((u) => {
    if (filter && u.role !== filter) return false;
    const active = isActive(u);
    if (statusFilter === "active" && !active) return false;
    if (statusFilter === "inactive" && active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
  });

  // Calculate paginated slice
  const totalItems = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedUsers = visible.slice(startIndex, startIndex + pageSize);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await reload();
      announce(success);
    } catch (e) {
      announce(`Échec : ${accountErrorMessage(e)}`, "assertive");
    }
  };

  const handlePasswordReset = async (u: UserProfile) => {
    if (!u.email) return;
    try {
      await sendUserPasswordReset(u.email);
      announce(`Email de réinitialisation envoyé à ${u.email}.`);
    } catch (e) {
      announce(`Échec d'envoi du lien de réinitialisation : ${accountErrorMessage(e)}`, "assertive");
    }
  };

  const canDelete = actor.role === "admin" || actor.role === "pedagogical_lead";

  const handleDeleteUser = async (u: UserProfile) => {
    await run(
      () => deleteUser(actor, u),
      `Compte de ${u.fullName} (${ROLE_LABELS[u.role]}) définitivement supprimé.`,
    );
  };

  const handleExportUsers = async (format: "pdf" | "excel") => {
    if (exporting) return;
    setExporting(format);
    try {
      const filterParts: string[] = [];
      if (filter) filterParts.push(ROLE_LABELS[filter]);
      if (statusFilter === "active") filterParts.push("Actifs uniquement");
      if (statusFilter === "inactive") filterParts.push("Désactivés uniquement");
      const payload: UsersExportPayload = {
        filterLabel: filterParts.length > 0 ? filterParts.join(" — ") : "Tous les rôles",
        users: visible.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          active: isActive(u),
        })),
      };
      const endpoint = format === "pdf" ? "/api/export-users-pdf" : "/api/export-users-excel";
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const response = await authFetch(endpoint, { payload });
      const fallbackName = usersExportFileName(payload, ext);
      downloadBlob(await response.blob(), fileNameFromResponse(response, fallbackName));
      announce(
        `Liste des utilisateurs (${visible.length} comptes) téléchargée au format ${format === "pdf" ? "PDF" : "Excel"}.`,
      );
    } catch {
      announce(
        `Le téléchargement de la liste des utilisateurs au format ${format === "pdf" ? "PDF" : "Excel"} a échoué.`,
        "assertive",
      );
    } finally {
      setExporting(null);
    }
  };

  const exportButtons = (
    <div
      role="group"
      aria-label="Télécharger la liste des utilisateurs"
      className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto"
    >
      <button
        type="button"
        onClick={() => handleExportUsers("pdf")}
        disabled={exporting !== null || visible.length === 0}
        aria-label={`Télécharger la liste des ${visible.length} utilisateurs au format PDF`}
        className={`inline-flex w-full sm:w-auto justify-center min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
      >
        <FileText className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
        <span>{exporting === "pdf" ? "Génération PDF…" : "Télécharger PDF"}</span>
        <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => handleExportUsers("excel")}
        disabled={exporting !== null || visible.length === 0}
        aria-label={`Télécharger la liste des ${visible.length} utilisateurs au format Excel (.xlsx)`}
        className={`inline-flex w-full sm:w-auto justify-center min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-xs sm:text-sm font-bold text-primary shadow-xs hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer ${focusRing}`}
      >
        <FileSpreadsheet className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
        <span>{exporting === "excel" ? "Génération Excel…" : "Télécharger Excel"}</span>
        <Download className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Formulaire de création de compte du personnel + Export direct en haut de page */}
      <CreateUserForm
        actor={actor}
        headerActions={exportButtons}
        onCreated={async (name) => {
          await reload();
          announce(`Compte de ${name} créé avec succès.`);
        }}
      />

      {/* Raccourci vers l'import de stagiaires avec modèles */}
      <div className="rounded-2xl border border-secondary/20 bg-surface-container-low p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <Info className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span className="text-on-surface">
            Vous souhaitez ajouter des stagiaires ? Ils sont inscrits par lot de fichiers (<strong>.xlsx</strong> ou <strong>.csv</strong>) avec modèles téléchargeables.
          </span>
        </div>
        <Link
          href="/secretary/import"
          className="inline-flex items-center gap-1.5 font-bold text-secondary hover:underline cursor-pointer ml-auto"
        >
          <span>Accéder à l&apos;import de stagiaires</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {/* Section des comptes existants avec filtres dynamiques */}
      <section aria-labelledby="users-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="users-heading" className="text-xl font-bold text-primary flex items-center gap-2">
            <Shield className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            <span>Comptes existants</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
              {visible.length} / {users.length}
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            {(filter || statusFilter !== "all" || search) && (
              <button
                type="button"
                onClick={() => {
                  setFilter("");
                  setStatusFilter("all");
                  setSearch("");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Réinitialiser les filtres
              </button>
            )}
            {exportButtons}
          </div>
        </div>

        {/* Filtres : Rôle, Statut, Recherche */}
        <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
          <SelectField
            label="Filtrer par rôle"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Role | "");
              setPage(1);
            }}
          >
            <option value="">Tous les rôles ({users.length})</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} ({users.filter((u) => u.role === r).length})
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Statut du compte"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | "active" | "inactive");
              setPage(1);
            }}
          >
            <option value="all">Tous les statuts ({users.length})</option>
            <option value="active">Actifs ({users.filter(isActive).length})</option>
            <option value="inactive">Désactivés ({users.filter((u) => !isActive(u)).length})</option>
          </SelectField>

          <TextField
            label="Rechercher"
            placeholder="Nom ou email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            hint={search ? `${visible.length} résultat(s)` : undefined}
          />
        </div>

        {/* Vue bureau (Tableau paginé) */}
        <div
          tabIndex={0}
          role="region"
          aria-label={`Tableau des utilisateurs, ${visible.length} comptes`}
          className="hidden md:block overflow-x-auto rounded-2xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
        >
          <table className="w-full border-collapse text-left text-sm min-w-[720px]">
            <caption className="sr-only">Liste des utilisateurs, {visible.length} résultats</caption>
            <thead className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
              <tr>
                <th scope="col" className="p-3 sm:p-4">Utilisateur</th>
                <th scope="col" className="p-3 sm:p-4">Email</th>
                <th scope="col" className="p-3 sm:p-4">Rôle</th>
                <th scope="col" className="p-3 sm:p-4">Statut</th>
                <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant font-medium">
                    Nous n&apos;avons trouvé aucun compte correspondant à vos critères de recherche. Prenez un instant pour vérifier la saisie ou réinitialiser les filtres.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === actor.id}
                    canDelete={canDelete}
                    onRoleChange={(role) =>
                      run(
                        () => updateUser(actor, u, { role }),
                        `${u.fullName} : rôle ${ROLE_LABELS[role]} enregistré.`,
                      )
                    }
                    onToggleActive={() =>
                      run(
                        () => setUserActive(actor, u, !isActive(u)),
                        `Compte de ${u.fullName} ${isActive(u) ? "désactivé" : "réactivé"}.`,
                      )
                    }
                    onPasswordReset={() => handlePasswordReset(u)}
                    onDelete={() => handleDeleteUser(u)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Vue mobile & tablette (< 768px) en cartes accessibles */}
        <div className="md:hidden flex flex-col gap-3">
          {paginatedUsers.length === 0 ? (
            <div className="p-6 rounded-xl border border-border-subtle bg-surface-container-lowest text-center text-on-surface-variant text-sm font-medium">
              Nous n&apos;avons trouvé aucun compte correspondant à vos critères de recherche. Prenez un instant pour vérifier la saisie ou réinitialiser les filtres.
            </div>
          ) : (
            paginatedUsers.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                isSelf={u.id === actor.id}
                canDelete={canDelete}
                onRoleChange={(role) =>
                  run(
                    () => updateUser(actor, u, { role }),
                    `${u.fullName} : rôle ${ROLE_LABELS[role]} enregistré.`,
                  )
                }
                onToggleActive={() =>
                  run(
                    () => setUserActive(actor, u, !isActive(u)),
                    `Compte de ${u.fullName} ${isActive(u) ? "désactivé" : "réactivé"}.`,
                  )
                }
                onPasswordReset={() => handlePasswordReset(u)}
                onDelete={() => handleDeleteUser(u)}
              />
            ))
          )}
        </div>

        {/* Contrôles de pagination accessibles */}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemName="utilisateurs"
          ariaLabel="Pagination des utilisateurs"
        />
      </section>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  canDelete,
  onRoleChange,
  onToggleActive,
  onPasswordReset,
  onDelete,
}: {
  user: UserProfile;
  isSelf: boolean;
  canDelete: boolean;
  onRoleChange: (role: Role) => Promise<void>;
  onToggleActive: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [savingRole, setSavingRole] = useState(false);
  const active = isActive(user);
  const roleOptions = user.role === "trainee" ? (["trainee"] as Role[]) : STAFF_ROLES;

  const initials = user.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSaveRole = async () => {
    setSavingRole(true);
    try {
      await onRoleChange(role);
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <tr className={`align-middle hover:bg-surface-container-low transition-colors ${active ? "" : "text-outline opacity-70"}`}>
      <th scope="row" className="p-3 sm:p-4 font-normal">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-primary font-bold text-xs shadow-xs"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <span className="font-bold text-on-surface text-sm block">
              {user.fullName}
              {isSelf && <span className="font-bold text-xs text-secondary ml-1.5">(vous)</span>}
            </span>
          </div>
        </div>
      </th>
      <td className="break-all p-3 sm:p-4 text-on-surface-variant font-medium text-xs sm:text-sm">
        {user.email || "—"}
      </td>
      <td className="p-3 sm:p-4 min-w-[200px]">
        <div className="flex items-center gap-2">
          <SelectField
            label={`Rôle de ${user.fullName}`}
            value={role}
            disabled={isSelf || user.role === "trainee"}
            onChange={(e) => setRole(e.target.value as Role)}
            className="!min-h-9 text-xs sm:text-sm"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          {role !== user.role && (
            <Button
              onClick={handleSaveRole}
              disabled={savingRole}
              className="!min-h-9 !px-2.5 text-xs rounded-xl shrink-0"
              aria-label={`Enregistrer le rôle ${ROLE_LABELS[role]} pour ${user.fullName}`}
            >
              {savingRole ? "..." : "Valider"}
            </Button>
          )}
        </div>
      </td>
      <td className="p-3 sm:p-4">
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-present-bg px-2.5 py-1 text-xs font-bold text-status-present">
            <span className="h-1.5 w-1.5 rounded-full bg-status-present" aria-hidden="true" />
            Actif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-1 text-xs font-bold text-outline">
            <span className="h-1.5 w-1.5 rounded-full bg-outline" aria-hidden="true" />
            Désactivé
          </span>
        )}
      </td>
      <td className="p-3 sm:p-4 text-right">
        <div className="flex flex-wrap gap-2 justify-end">
          {user.email && user.role !== "trainee" && (
            <ConfirmDialog
              triggerLabel="Réinitialiser MDP"
              triggerAccessibleLabel={`Envoyer un email de réinitialisation de mot de passe à ${user.fullName}`}
              triggerVariant="secondary"
              title={`Réinitialiser le mot de passe de ${user.fullName} ?`}
              description={`Un lien sécurisé et bienveillant de réinitialisation sera adressé par email à ${user.email}. La personne pourra choisir son nouveau mot de passe en toute autonomie.`}
              confirmLabel="Envoyer l'email"
              onConfirm={onPasswordReset}
            />
          )}
          {!isSelf &&
            (active ? (
              <ConfirmDialog
                triggerLabel="Désactiver"
                triggerAccessibleLabel={`Désactiver le compte de ${user.fullName}`}
                triggerVariant="secondary"
                title="Désactiver temporairement ce compte ?"
                description={`Souhaitez-vous suspendre l'accès de ${user.fullName} ? Rassurez-vous : l'ensemble de son historique et de ses données restent préservés, et son compte peut être réactivé en un clic à tout moment.`}
                confirmLabel="Désactiver le compte"
                onConfirm={onToggleActive}
              />
            ) : (
              <Button
                variant="secondary"
                className="!min-h-9 !px-3 text-xs rounded-xl"
                onClick={onToggleActive}
                aria-label={`Réactiver le compte de ${user.fullName}`}
              >
                Réactiver
              </Button>
            ))}
          {canDelete && !isSelf && (
            <ConfirmDialog
              triggerLabel="Supprimer"
              triggerAccessibleLabel={`Supprimer le compte de ${user.fullName}`}
              triggerVariant="danger"
              title={`Confirmer la suppression du compte de ${user.fullName} ?`}
              description={`Cette action supprimera le compte de ${user.fullName} (${ROLE_LABELS[user.role]}). Si vous souhaitez simplement suspendre son accès tout en conservant son historique d'émargement, nous vous recommandons plutôt de désactiver le compte.`}
              confirmLabel="Supprimer le compte"
              onConfirm={onDelete}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function UserCard({
  user,
  isSelf,
  canDelete,
  onRoleChange,
  onToggleActive,
  onPasswordReset,
  onDelete,
}: {
  user: UserProfile;
  isSelf: boolean;
  canDelete: boolean;
  onRoleChange: (role: Role) => Promise<void>;
  onToggleActive: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [savingRole, setSavingRole] = useState(false);
  const active = isActive(user);
  const roleOptions = user.role === "trainee" ? (["trainee"] as Role[]) : STAFF_ROLES;

  const initials = user.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSaveRole = async () => {
    setSavingRole(true);
    try {
      await onRoleChange(role);
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs flex flex-col gap-3 ${active ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-primary font-bold text-sm"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <div className="font-bold text-on-surface text-base">
              {user.fullName}
              {isSelf && <span className="font-bold text-xs text-secondary ml-1.5">(vous)</span>}
            </div>
            <div className="text-xs text-on-surface-variant font-medium break-all">
              {user.email || "Aucun email"}
            </div>
          </div>
        </div>
        <div>
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-present-bg px-2.5 py-1 text-xs font-bold text-status-present">
              <span className="h-1.5 w-1.5 rounded-full bg-status-present" aria-hidden="true" />
              Actif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-1 text-xs font-bold text-outline">
              <span className="h-1.5 w-1.5 rounded-full bg-outline" aria-hidden="true" />
              Désactivé
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
        <div className="flex-1">
          <SelectField
            label={`Rôle de ${user.fullName}`}
            value={role}
            disabled={isSelf || user.role === "trainee"}
            onChange={(e) => setRole(e.target.value as Role)}
            className="!min-h-11 text-sm"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
        </div>
        {role !== user.role && (
          <Button
            onClick={handleSaveRole}
            disabled={savingRole}
            className="!min-h-11 !px-4 text-xs font-bold rounded-xl shrink-0 mt-6"
            aria-label={`Enregistrer le rôle pour ${user.fullName}`}
          >
            {savingRole ? "..." : "Valider"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 justify-end border-t border-border-subtle">
        {user.email && user.role !== "trainee" && (
          <ConfirmDialog
            triggerLabel="Réinitialiser MDP"
            triggerAccessibleLabel={`Envoyer un email de réinitialisation de mot de passe à ${user.fullName}`}
            triggerVariant="secondary"
            title={`Réinitialiser le mot de passe de ${user.fullName} ?`}
            description={`Un lien sécurisé et bienveillant de réinitialisation sera adressé par email à ${user.email}. La personne pourra choisir son nouveau mot de passe en toute simplicité.`}
            confirmLabel="Envoyer l'email"
            onConfirm={onPasswordReset}
          />
        )}
        {!isSelf &&
          (active ? (
            <ConfirmDialog
              triggerLabel="Désactiver"
              triggerAccessibleLabel={`Désactiver le compte de ${user.fullName}`}
              triggerVariant="secondary"
              title="Désactiver temporairement ce compte ?"
              description={`Souhaitez-vous suspendre l'accès de ${user.fullName} ? Rassurez-vous : son historique et ses données restent préservés, et son compte peut être réactivé en un clic à tout moment.`}
              confirmLabel="Désactiver le compte"
              onConfirm={onToggleActive}
            />
          ) : (
            <Button
              variant="secondary"
              className="!min-h-11 !px-4 text-xs font-bold rounded-xl"
              onClick={onToggleActive}
              aria-label={`Réactiver le compte de ${user.fullName}`}
            >
              Réactiver
            </Button>
          ))}
        {canDelete && !isSelf && (
          <ConfirmDialog
            triggerLabel="Supprimer"
            triggerAccessibleLabel={`Supprimer le compte de ${user.fullName}`}
            triggerVariant="danger"
            title={`Confirmer la suppression du compte de ${user.fullName} ?`}
            description={`Cette action supprimera le compte de ${user.fullName} (${ROLE_LABELS[user.role]}). Si vous souhaitez simplement suspendre son accès tout en conservant son historique d'émargement, nous vous recommandons plutôt de désactiver le compte.`}
            confirmLabel="Supprimer le compte"
            onConfirm={onDelete}
          />
        )}
      </div>
    </div>
  );
}

function CreateUserForm({
  actor,
  headerActions,
  onCreated,
}: {
  actor: Actor;
  headerActions?: React.ReactNode;
  onCreated: (name: string) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("secretary");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fullName.trim() || !email.trim()) return setError("Le nom et l'email sont obligatoires.");
    if (password.length < 8) return setError("Le mot de passe provisoire doit contenir au moins 8 caractères.");
    setBusy(true);
    try {
      await createStaffAccount(actor, { fullName: fullName.trim(), email: email.trim(), password, role });
      setSuccess(`Le compte de ${fullName.trim()} (${ROLE_LABELS[role]}) a été créé avec succès.`);
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
    <section
      aria-labelledby="create-user-heading"
      className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs"
    >
      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
        <h2 id="create-user-heading" className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Créer un compte du personnel</span>
        </h2>
        {headerActions}
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        {success && (
          <Alert tone="info">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-present shrink-0" aria-hidden="true" />
              <span>{success}</span>
            </div>
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Nom complet"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="off"
            placeholder="Ex : Dupont Marie"
          />
          <TextField
            label="Adresse email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="nom@exemple.fr"
          />
          {/* PasswordField avec l'œil de visibilité intégré */}
          <PasswordField
            label="Mot de passe provisoire"
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
        <div className="pt-2">
          <Button type="submit" disabled={busy} className="min-h-11">
            {busy ? "Création en cours…" : "Créer le compte"}
          </Button>
        </div>
      </form>
    </section>
  );
}
