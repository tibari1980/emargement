"use client";

import { useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import type { Actor } from "@/lib/data/audit";
import { createSubject, deleteSubject, updateSubject, type SubjectInput } from "@/lib/data/subjects";
import { isActive } from "@/lib/data/users";
import { SUBJECT_CATALOG } from "@/lib/domain/catalog";
import type { Subject, UserProfile } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";

const EMPTY: SubjectInput = { title: "", description: "", trainerIds: [], active: true };

export function SubjectManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error, reload } = useReferenceData();
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);

  // Pagination state (10 subjects per page by default)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups) return <Loading />;

  const canDelete = actor.role === "admin" || actor.role === "pedagogical_lead";
  const trainers = data.staff.filter((u) => u.role === "trainer" && isActive(u));
  const visible = data.subjects.filter((s) => {
    if (!showArchived && s.active === false) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
  });

  const totalItems = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedSubjects = visible.slice(startIndex, startIndex + pageSize);
  const missing = SUBJECT_CATALOG.filter((c) => !data.subjects.some((s) => s.title === c.title));

  const closeEditor = () => {
    setEditing(null);
    setTimeout(() => listHeading.current?.focus(), 0);
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await reload();
      announce(success);
      return true;
    } catch {
      announce("L'opération a échoué. Vérifiez vos droits et votre connexion.", "assertive");
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <SubjectForm
          subject={editing === "new" ? null : editing}
          trainers={trainers}
          onSubmit={async (input) => {
            const ok =
              editing === "new"
                ? await run(() => createSubject(actor, input), `Matière ${input.title} créée.`)
                : await run(() => updateSubject(actor, editing, input), `Matière ${input.title} enregistrée.`);
            if (ok) closeEditor();
          }}
          onCancel={closeEditor}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setEditing("new")}>Nouvelle matière</Button>
          {missing.length > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                run(async () => {
                  for (const c of missing) await createSubject(actor, { ...EMPTY, ...c });
                }, `${missing.length} matières courantes créées.`)
              }
            >
              Créer les {missing.length} matières courantes du CFRP
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-3">
        <h2 id="subjects-heading" ref={listHeading} tabIndex={-1} className="text-xl font-bold outline-none">
          {visible.length} matière{visible.length > 1 ? "s" : ""}
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-full max-w-sm">
            <TextField
              label="Rechercher une matière"
              placeholder="Intitulé ou description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              hint={search ? `${visible.length} matière(s) correspondante(s)` : undefined}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-900"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setPage(1);
              }}
            />
            Afficher les matières archivées
          </label>
        </div>
        {visible.length === 0 ? (
          <Alert tone="info">Aucune matière pour le moment.</Alert>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label="Tableau de la liste des matières"
              className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
            >
              <table className="w-full border-collapse text-left text-sm min-w-[550px]">
                <caption className="sr-only">Liste des matières</caption>
                <thead className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
                  <tr>
                    <th scope="col" className="p-3 sm:p-4">Matière</th>
                    <th scope="col" className="p-3 sm:p-4">Formateurs habilités</th>
                    <th scope="col" className="p-3 sm:p-4">Statut</th>
                    <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {paginatedSubjects.map((s) => (
                    <tr key={s.id} className="align-top hover:bg-surface-container-low transition-colors">
                      <th scope="row" className="p-3 sm:p-4 font-normal">
                        <span className="font-bold text-on-surface text-base block">{s.title}</span>
                        {s.description && <span className="block text-xs text-on-surface-variant mt-0.5">{s.description}</span>}
                      </th>
                      <td className="p-3 sm:p-4 text-on-surface-variant font-medium">
                        {s.trainerIds?.length ? s.trainerIds.map(lookups.personName).join(", ") : "Tous les formateurs"}
                      </td>
                      <td className="p-3 sm:p-4">
                        {s.active === false ? (
                          <span className="inline-flex rounded bg-status-late-bg px-2 py-0.5 text-xs font-bold text-status-late">
                            Archivée
                          </span>
                        ) : (
                          <span className="inline-flex rounded bg-status-present-bg px-2 py-0.5 text-xs font-bold text-status-present">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button variant="secondary" className="!min-h-9 !px-3 text-xs rounded-xl" onClick={() => setEditing(s)} aria-label={`Modifier ${s.title}`}>
                            Modifier
                          </Button>
                          <Button
                            variant="secondary"
                            className="!min-h-9 !px-3 text-xs rounded-xl"
                            aria-label={`${s.active === false ? "Réactiver" : "Archiver"} ${s.title}`}
                            onClick={() =>
                              run(
                                () => updateSubject(actor, s, { active: s.active === false }),
                                `Matière ${s.title} ${s.active === false ? "réactivée" : "archivée"}.`,
                              )
                            }
                          >
                            {s.active === false ? "Réactiver" : "Archiver"}
                          </Button>
                          {canDelete && (
                            <ConfirmDialog
                              triggerLabel="Supprimer"
                              triggerAccessibleLabel={`Supprimer définitivement la matière ${s.title}`}
                              triggerVariant="danger"
                              title={`Supprimer définitivement « ${s.title} » ?`}
                              description={`Attention : Cette action est irréversible. La matière « ${s.title} » sera définitivement supprimée de l'établissement ainsi que ses créneaux associés dans les emplois du temps.`}
                              confirmLabel="Supprimer définitivement"
                              onConfirm={async () => {
                                await run(
                                  () => deleteSubject(actor, s),
                                  `Matière « ${s.title} » définitivement supprimée.`,
                                );
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
              pageSizeOptions={[10, 25, 50]}
              itemName="matières"
              ariaLabel="Pagination des matières"
            />
          </>
        )}
      </section>
    </div>
  );
}

function SubjectForm({
  subject,
  trainers,
  onSubmit,
  onCancel,
}: {
  subject: Subject | null;
  trainers: UserProfile[];
  onSubmit: (input: SubjectInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubjectInput>(subject ? { ...EMPTY, ...subject } : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("L'intitulé est obligatoire.");
    setError(null);
    setBusy(true);
    await onSubmit({ ...form, title: form.title.trim(), description: form.description.trim() });
    setBusy(false);
  };

  return (
    <section aria-labelledby="subject-form-heading" className="rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-6 shadow-sm">
      <h2 id="subject-form-heading" className="mb-4 text-2xl font-bold text-primary">
        {subject ? `Modifier « ${subject.title} »` : "Nouvelle matière"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Intitulé"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          error={error}
          autoFocus
          required
        />
        <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        <fieldset className="rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <legend className="px-1 text-sm font-bold text-primary">Formateurs habilités</legend>
          <p className="mb-2 text-xs text-on-surface-variant">Aucune case cochée : tous les formateurs peuvent enseigner la matière.</p>
          {trainers.length === 0 ? (
            <p>Aucun compte formateur. Créez-en depuis la page Utilisateurs.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {trainers.map((t) => (
                <li key={t.id}>
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={form.trainerIds.includes(t.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          trainerIds: e.target.checked ? [...form.trainerIds, t.id] : form.trainerIds.filter((id) => id !== t.id),
                        })
                      }
                    />
                    {t.fullName}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </section>
  );
}
