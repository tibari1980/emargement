"use client";

import { useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import { createSubject, updateSubject, type SubjectInput } from "@/lib/data/subjects";
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
  const listHeading = useRef<HTMLHeadingElement>(null);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups) return <Loading />;

  const trainers = data.staff.filter((u) => u.role === "trainer" && isActive(u));
  const visible = data.subjects.filter((s) => showArchived || s.active !== false);
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
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les matières archivées
        </label>
        {visible.length === 0 ? (
          <Alert tone="info">Aucune matière pour le moment.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Liste des matières</caption>
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="p-3">Matière</th>
                  <th scope="col" className="p-3">Formateurs habilités</th>
                  <th scope="col" className="p-3">Statut</th>
                  <th scope="col" className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-t-2 border-gray-200 align-top">
                    <th scope="row" className="p-3">
                      <span className="font-semibold">{s.title}</span>
                      {s.description && <span className="block font-normal text-gray-700">{s.description}</span>}
                    </th>
                    <td className="p-3">
                      {s.trainerIds?.length ? s.trainerIds.map(lookups.personName).join(", ") : "Tous les formateurs"}
                    </td>
                    <td className="p-3">{s.active === false ? "Archivée" : "Active"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setEditing(s)} aria-label={`Modifier ${s.title}`}>
                          Modifier
                        </Button>
                        <Button
                          variant="secondary"
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <section aria-labelledby="subject-form-heading" className="rounded-lg border-2 border-blue-800 bg-white p-5">
      <h2 id="subject-form-heading" className="mb-4 text-2xl font-bold">
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
        <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <fieldset className="rounded-md border-2 border-gray-300 p-4">
          <legend className="px-1 font-semibold">Formateurs habilités</legend>
          <p className="mb-2 text-sm text-gray-700">Aucune case cochée : tous les formateurs peuvent enseigner la matière.</p>
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
