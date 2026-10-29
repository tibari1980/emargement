"use client";

import { useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import { createFormation, removeTrainee, updateFormation, type FormationInput } from "@/lib/data/formations";
import { isActive, listUsersByIds } from "@/lib/data/users";
import { FORMATION_CATALOG } from "@/lib/domain/catalog";
import {
  FORMATION_CATEGORIES,
  FORMATION_CATEGORY_LABELS,
  type Formation,
  type FormationCategory,
  type UserProfile,
} from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";

const EMPTY: FormationInput = {
  title: "",
  category: "preparatory",
  description: "",
  duration: "",
  certification: "",
  pedagogicalLeadId: "",
  traineeIds: [],
  active: true,
};

export function FormationManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error, reload } = useReferenceData();
  const [editing, setEditing] = useState<Formation | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const listHeading = useRef<HTMLHeadingElement>(null);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups) return <Loading />;

  const leads = data.staff.filter((u) => (u.role === "pedagogical_lead" || u.role === "admin") && isActive(u));
  const visible = data.formations.filter((f) => showArchived || f.active !== false);
  const missing = FORMATION_CATALOG.filter((c) => !data.formations.some((f) => f.title === c.title));
  const defaultLead = actor.role === "pedagogical_lead" ? actor.id : "";

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
        <FormationForm
          actor={actor}
          formation={editing === "new" ? null : editing}
          leads={leads}
          defaultLead={defaultLead}
          onSubmit={async (input) => {
            const ok =
              editing === "new"
                ? await run(() => createFormation(actor, input), `Formation ${input.title} créée.`)
                : await run(() => updateFormation(actor, editing, input), `Formation ${input.title} enregistrée.`);
            if (ok) closeEditor();
          }}
          onCancel={closeEditor}
          onChanged={reload}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setEditing("new")}>Nouvelle formation</Button>
          {missing.length > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                run(async () => {
                  for (const c of missing) await createFormation(actor, { ...EMPTY, ...c, pedagogicalLeadId: defaultLead });
                }, `${missing.length} formations du catalogue CFRP créées.`)
              }
            >
              Importer les {missing.length} formations du catalogue CFRP
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="formations-heading" className="flex flex-col gap-4">
        <h2 id="formations-heading" ref={listHeading} tabIndex={-1} className="text-xl font-bold outline-none">
          {visible.length} formation{visible.length > 1 ? "s" : ""}
        </h2>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les formations archivées
        </label>
        {FORMATION_CATEGORIES.map((category) => {
          const list = visible.filter((f) => f.category === category);
          if (!list.length) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h3 id={`cat-${category}`} className="mb-2 text-lg font-bold">
                {FORMATION_CATEGORY_LABELS[category]} ({list.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">{FORMATION_CATEGORY_LABELS[category]}</caption>
                  <thead className="bg-gray-100">
                    <tr>
                      <th scope="col" className="p-3">Formation</th>
                      <th scope="col" className="p-3">Durée</th>
                      <th scope="col" className="p-3">Responsable</th>
                      <th scope="col" className="p-3">Stagiaires</th>
                      <th scope="col" className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((f) => (
                      <tr key={f.id} className="border-t-2 border-gray-200 align-top">
                        <th scope="row" className="p-3">
                          <span className="font-semibold">{f.title}</span>
                          {f.certification && <span className="block font-normal text-gray-700">{f.certification}</span>}
                          {f.active === false && <span className="block font-semibold text-gray-700">Archivée</span>}
                        </th>
                        <td className="p-3">{f.duration || "—"}</td>
                        <td className="p-3">{f.pedagogicalLeadId ? lookups.personName(f.pedagogicalLeadId) : "Non attribué"}</td>
                        <td className="p-3">{f.traineeIds?.length ?? 0}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setEditing(f)} aria-label={`Modifier ${f.title}`}>
                              Modifier
                            </Button>
                            <Button
                              variant="secondary"
                              aria-label={`${f.active === false ? "Réactiver" : "Archiver"} ${f.title}`}
                              onClick={() =>
                                run(
                                  () => updateFormation(actor, f, { active: f.active === false }),
                                  `Formation ${f.title} ${f.active === false ? "réactivée" : "archivée"}.`,
                                )
                              }
                            >
                              {f.active === false ? "Réactiver" : "Archiver"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {visible.length === 0 && <Alert tone="info">Aucune formation pour le moment.</Alert>}
      </section>
    </div>
  );
}

function FormationForm({
  actor,
  formation,
  leads,
  defaultLead,
  onSubmit,
  onCancel,
  onChanged,
}: {
  actor: Actor;
  formation: Formation | null;
  leads: UserProfile[];
  defaultLead: string;
  onSubmit: (input: FormationInput) => Promise<void>;
  onCancel: () => void;
  onChanged: () => Promise<void>;
}) {
  const announce = useAnnounce();
  const [form, setForm] = useState<FormationInput>(
    formation ? { ...EMPTY, ...formation } : { ...EMPTY, pedagogicalLeadId: defaultLead },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trainees, setTrainees] = useState<UserProfile[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const enrolledHeading = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof FormationInput>(key: K, value: FormationInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (formation?.traineeIds?.length) listUsersByIds(formation.traineeIds).then(setTrainees).catch(() => {});
  }, [formation]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("Le titre est obligatoire.");
    setError(null);
    setBusy(true);
    await onSubmit({ ...form, title: form.title.trim() });
    setBusy(false);
  };

  const unenroll = async (t: UserProfile) => {
    if (!formation) return;
    try {
      await removeTrainee(actor, formation, t);
      setTrainees((list) => list.filter((x) => x.id !== t.id));
      await onChanged();
      announce(`${t.fullName} retiré de la formation.`);
      enrolledHeading.current?.focus();
    } catch {
      announce(`Impossible de retirer ${t.fullName}.`, "assertive");
    }
  };

  return (
    <section aria-labelledby="formation-form-heading" className="rounded-lg border-2 border-blue-800 bg-white p-5">
      <h2 id="formation-form-heading" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
        {formation ? `Modifier « ${formation.title} »` : "Nouvelle formation"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Titre" value={form.title} onChange={(e) => set("title", e.target.value)} error={error} required />
          <SelectField label="Catégorie" value={form.category} onChange={(e) => set("category", e.target.value as FormationCategory)}>
            {FORMATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FORMATION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>
          <TextField label="Durée" value={form.duration} onChange={(e) => set("duration", e.target.value)} hint="Exemple : 10,5 mois — 1 400 heures." />
          <TextField label="Certification" value={form.certification} onChange={(e) => set("certification", e.target.value)} hint="Facultatif." />
          <SelectField label="Responsable pédagogique" value={form.pedagogicalLeadId} onChange={(e) => set("pedagogicalLeadId", e.target.value)}>
            <option value="">Non attribué</option>
            {leads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
          <TextField label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <p className="text-gray-800">
          Les matières, horaires et formateurs se configurent dans « Emplois du temps ».
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>

      {formation && (
        <section aria-labelledby="enrolled-heading" className="mt-8">
          <h3 id="enrolled-heading" ref={enrolledHeading} tabIndex={-1} className="mb-2 text-xl font-bold outline-none">
            Stagiaires inscrits ({trainees.length})
          </h3>
          {trainees.length === 0 ? (
            <p>Aucun stagiaire. Utilisez la page « Import de stagiaires » pour en ajouter.</p>
          ) : (
            <ul className="divide-y-2 divide-gray-200">
              {trainees.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{t.fullName}</span>
                  <Button variant="secondary" onClick={() => unenroll(t)} aria-label={`Retirer ${t.fullName} de la formation`}>
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
