"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, GraduationCap, Sparkles, UploadCloud } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import {
  cleanDuplicateFormationsInDb,
  clearFormationTrainees,
  createFormation,
  getOfficialDuration,
  removeTrainee,
  repairFormationDurations,
  syncCatalogFormations,
  updateFormation,
  type FormationInput,
} from "@/lib/data/formations";
import { isActive, listUsersByIds } from "@/lib/data/users";
import { FORMATION_CATALOG } from "@/lib/domain/catalog";
import { downloadTraineeCsvTemplate, downloadTraineeExcelTemplate } from "@/lib/domain/templates";
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
  yearLevel: null,
  totalYears: null,
  shortCode: "",
  academicYear: "2025-2026",
};

export function FormationManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error, reload } = useReferenceData();
  const [editing, setEditing] = useState<Formation | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);
  const hasRepairedRef = useRef(false);

  // Auto-repair missing durations & clean duplicates in background on load
  useEffect(() => {
    if (hasRepairedRef.current) return;
    hasRepairedRef.current = true;
    Promise.all([
      repairFormationDurations(actor),
      cleanDuplicateFormationsInDb(actor),
    ])
      .then(([{ updatedCount }, { cleanedCount }]) => {
        if ((updatedCount > 0 || cleanedCount > 0) && reload) {
          reload();
          if (updatedCount > 0) {
            announce(`${updatedCount} durées officielles de formation enregistrées.`);
          }
        }
      })
      .catch((err) => console.warn("Auto-maintenance formations failed:", err));
  }, [actor, reload, announce]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups) return <Loading />;

  const leads = data.staff.filter((u) => (u.role === "pedagogical_lead" || u.role === "admin") && isActive(u));
  const visible = data.formations.filter((f) => {
    if (!showArchived && f.active === false) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.title.toLowerCase().includes(q) || (f.description && f.description.toLowerCase().includes(q));
  });
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
          onChanged={async () => {
            await reload();
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setEditing("new")}>Nouvelle formation</Button>
          <Button
            variant="secondary"
            className="inline-flex items-center gap-2"
            onClick={() =>
              run(
                () => syncCatalogFormations(actor),
                "Catalogue synchronisé avec succès : promotions par année (1ère année, 2ème année, Kiné K1-K4...) prêtes.",
              )
            }
          >
            <Sparkles className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <span>Synchroniser les promotions (1ère & 2ème année, Kiné...)</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              run(
                () => repairFormationDurations(actor),
                "Toutes les durées officielles ont été renseignées et enregistrées.",
              )
            }
          >
            <span>Renseigner toutes les durées officielles</span>
          </Button>
        </div>
      )}

      <section aria-labelledby="formations-heading" className="flex flex-col gap-4">
        <h2 id="formations-heading" ref={listHeading} tabIndex={-1} className="text-xl font-bold outline-none">
          {visible.length} formation{visible.length > 1 ? "s" : ""}
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-full max-w-sm">
            <TextField
              label="Rechercher une formation"
              placeholder="Titre ou description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              hint={search ? `${visible.length} formation(s) correspondante(s)` : undefined}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-blue-900" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Afficher les formations archivées
          </label>
        </div>
        {FORMATION_CATEGORIES.map((category) => {
          const list = visible.filter((f) => f.category === category);
          if (!list.length) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-2">
              <h3 id={`cat-${category}`} className="text-base font-bold text-primary flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
                <span>{FORMATION_CATEGORY_LABELS[category]} ({list.length})</span>
              </h3>
              {/* Vue Cartes sur Smartphone (< 768px) */}
              <div className="grid gap-3 md:hidden">
                {list.map((f) => (
                  <article
                    key={f.id}
                    className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 shadow-xs flex flex-col gap-3"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {f.shortCode && (
                        <span className="inline-flex rounded-md bg-primary-container px-2 py-0.5 text-xs font-bold text-on-primary">
                          {f.shortCode}
                        </span>
                      )}
                      {f.yearLevel && (
                        <span className="inline-flex rounded-md bg-surface-container-high border border-border-subtle px-2 py-0.5 text-xs font-bold text-secondary">
                          Année {f.yearLevel}{f.totalYears ? ` / ${f.totalYears}` : ""}
                        </span>
                      )}
                      {f.academicYear && (
                        <span className="inline-flex rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                          {f.academicYear}
                        </span>
                      )}
                      {f.active === false && (
                        <span className="inline-flex rounded bg-status-late-bg px-2 py-0.5 text-xs font-bold text-status-late">
                          Archivée
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-on-surface text-base leading-snug">{f.title}</h4>
                      {f.certification && (
                        <p className="text-xs text-on-surface-variant mt-0.5">{f.certification}</p>
                      )}
                    </div>

                    <dl className="grid grid-cols-2 gap-2 rounded-lg bg-surface-container-low p-2.5 text-xs">
                      <div>
                        <dt className="font-semibold text-on-surface-variant">Durée</dt>
                        <dd className="font-bold text-on-surface mt-0.5">
                          {f.duration || getOfficialDuration(f.title)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-on-surface-variant">Stagiaires inscrits</dt>
                        <dd className="font-bold text-primary mt-0.5">
                          {f.traineeIds?.length ?? 0} stagiaire{(f.traineeIds?.length ?? 0) > 1 ? "s" : ""}
                        </dd>
                      </div>
                      <div className="col-span-2 border-t border-border-subtle/60 pt-1.5">
                        <dt className="font-semibold text-on-surface-variant inline">Responsable : </dt>
                        <dd className="font-bold text-on-surface inline">
                          {f.pedagogicalLeadId ? lookups.personName(f.pedagogicalLeadId) : "Non attribué"}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <Button
                        variant="secondary"
                        className="flex-1 sm:flex-none !min-h-10 !px-3 text-xs rounded-xl"
                        onClick={() => setEditing(f)}
                        aria-label={`Modifier ${f.title}`}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 sm:flex-none !min-h-10 !px-3 text-xs rounded-xl"
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
                  </article>
                ))}
              </div>

              {/* Vue Tableau sur Tablette & Ordinateur (>= 768px) */}
              <div
                tabIndex={0}
                role="region"
                aria-label={`Tableau des formations : ${FORMATION_CATEGORY_LABELS[category]}`}
                className="hidden md:block overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
              >
                <table className="w-full border-collapse text-left text-sm min-w-[620px]">
                  <caption className="sr-only">{FORMATION_CATEGORY_LABELS[category]}</caption>
                  <thead className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
                    <tr>
                      <th scope="col" className="p-3 sm:p-4">Formation</th>
                      <th scope="col" className="p-3 sm:p-4">Durée</th>
                      <th scope="col" className="p-3 sm:p-4">Responsable</th>
                      <th scope="col" className="p-3 sm:p-4">Stagiaires</th>
                      <th scope="col" className="p-3 sm:p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {list.map((f) => (
                      <tr key={f.id} className="align-top hover:bg-surface-container-low transition-colors">
                        <th scope="row" className="p-3 sm:p-4 font-normal">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {f.shortCode && (
                              <span className="inline-flex rounded-md bg-primary-container px-2 py-0.5 text-xs font-bold text-on-primary">
                                {f.shortCode}
                              </span>
                            )}
                            {f.yearLevel && (
                              <span className="inline-flex rounded-md bg-surface-container-high border border-border-subtle px-2 py-0.5 text-xs font-bold text-secondary">
                                Année {f.yearLevel}{f.totalYears ? ` / ${f.totalYears}` : ""}
                              </span>
                            )}
                            {f.academicYear && (
                              <span className="inline-flex rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                                {f.academicYear}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-on-surface text-base block">{f.title}</span>
                          {f.certification && <span className="block text-xs text-on-surface-variant mt-0.5">{f.certification}</span>}
                          {f.active === false && (
                            <span className="inline-flex mt-1 rounded bg-status-late-bg px-2 py-0.5 text-xs font-bold text-status-late">
                              Archivée
                            </span>
                          )}
                        </th>
                        <td className="p-3 sm:p-4 font-medium text-on-surface">{f.duration || getOfficialDuration(f.title)}</td>
                        <td className="p-3 sm:p-4 font-medium text-on-surface">
                          {f.pedagogicalLeadId ? lookups.personName(f.pedagogicalLeadId) : <span className="text-outline">Non attribué</span>}
                        </td>
                        <td className="p-3 sm:p-4 font-bold text-primary">{f.traineeIds?.length ?? 0}</td>
                        <td className="p-3 sm:p-4 text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button variant="secondary" className="!min-h-9 !px-3 text-xs rounded-xl" onClick={() => setEditing(f)} aria-label={`Modifier ${f.title}`}>
                              Modifier
                            </Button>
                            <Button
                              variant="secondary"
                              className="!min-h-9 !px-3 text-xs rounded-xl"
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
    const duration = form.duration.trim() || getOfficialDuration(form.title.trim());
    await onSubmit({ ...form, title: form.title.trim(), duration });
    setBusy(false);
  };

  const handleCatalogPreset = (presetTitle: string) => {
    const item = FORMATION_CATALOG.find((c) => c.title === presetTitle);
    if (!item) return;
    setForm((f) => ({
      ...f,
      title: item.title,
      category: item.category,
      duration: item.duration,
      certification: item.certification,
      description: item.description,
      yearLevel: item.yearLevel ?? null,
      totalYears: item.totalYears ?? null,
      shortCode: item.shortCode ?? "",
    }));
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
    <section aria-labelledby="formation-form-heading" className="rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-6 shadow-sm">
      <h2 id="formation-form-heading" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold text-primary outline-none">
        {formation ? `Modifier « ${formation.title} »` : "Nouvelle formation / promotion"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!formation && (
          <div className="rounded-xl border border-secondary/40 bg-surface-container-low p-4">
            <SelectField
              label="Modèle prédéfini du catalogue officiel CFRP (facultatif)"
              value=""
              onChange={(e) => {
                if (e.target.value) handleCatalogPreset(e.target.value);
              }}
              hint="Sélectionnez une formation ou une promotion par année pour pré-remplir automatiquement les informations officielles."
            >
              <option value="">-- Choisir un modèle du CFRP (TIP 1, TIP 2, Prépa Info, Kiné...) --</option>
              {FORMATION_CATALOG.map((c) => (
                <option key={c.title} value={c.title}>
                  {c.title} {c.duration ? `— ${c.duration}` : ""}
                </option>
              ))}
            </SelectField>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Titre de la formation / promotion" value={form.title} onChange={(e) => set("title", e.target.value)} error={error} required />
          <SelectField label="Catégorie" value={form.category} onChange={(e) => set("category", e.target.value as FormationCategory)}>
            {FORMATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FORMATION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Année de la promotion dans le cursus"
            value={form.yearLevel ?? ""}
            onChange={(e) => set("yearLevel", e.target.value ? Number(e.target.value) : null)}
            hint="Pour les formations pluriannuelles (1ère année, 2ème année...)"
          >
            <option value="">Cursus 1 an / Non applicable</option>
            <option value="1">1ère année</option>
            <option value="2">2ème année</option>
            <option value="3">3ème année (ex: K3)</option>
            <option value="4">4ème année (ex: K4)</option>
          </SelectField>

          <SelectField
            label="Durée totale du cursus"
            value={form.totalYears ?? ""}
            onChange={(e) => set("totalYears", e.target.value ? Number(e.target.value) : null)}
            hint="Nombre d'années complètes du cursus"
          >
            <option value="">Non spécifié</option>
            <option value="1">1 an (Prépa Info, Adaptation, Cycles...)</option>
            <option value="2">2 ans (TIP, CAGA...)</option>
            <option value="4">4 ans (DE Kinésithérapie IFMK)</option>
            <option value="5">5 ans (Cursus Kiné avec Prépa scientifique)</option>
          </SelectField>

          <TextField label="Sigle / Code court" value={form.shortCode ?? ""} onChange={(e) => set("shortCode", e.target.value)} hint="Exemple : TIP 1, TIP 2, K1, PREPA-INFO..." />
          <TextField label="Année académique" value={form.academicYear ?? ""} onChange={(e) => set("academicYear", e.target.value)} hint="Exemple : 2025-2026, 2026-2027" />

          <TextField
            label="Durée de la formation"
            value={form.duration}
            onChange={(e) => set("duration", e.target.value)}
            placeholder={getOfficialDuration(form.title)}
            hint={form.duration ? "Exemple : 21 mois — 2 800 heures dont 490 heures de stage." : `Durée officielle suggérée : ${getOfficialDuration(form.title)}`}
          />
          <TextField label="Certification" value={form.certification} onChange={(e) => set("certification", e.target.value)} hint="Exemple : Titre RNCP Niveau 4, Diplôme d'État..." />

          <SelectField label="Responsable pédagogique" value={form.pedagogicalLeadId} onChange={(e) => set("pedagogicalLeadId", e.target.value)}>
            <option value="">Non attribué</option>
            {leads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>

          <div className="md:col-span-2">
            <TextAreaField label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
        </div>
        <p className="text-sm text-on-surface-variant">
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
        <section aria-labelledby="enrolled-heading" className="mt-8 border-t border-border-subtle pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 id="enrolled-heading" ref={enrolledHeading} tabIndex={-1} className="text-xl font-bold text-primary outline-none">
              Stagiaires inscrits ({trainees.length})
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/secretary/import?formationId=${formation.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-95 transition-opacity"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                <span>Importer des stagiaires</span>
              </Link>
              {trainees.length > 0 && (
                <ConfirmDialog
                  triggerLabel="Vider les stagiaires"
                  triggerAccessibleLabel={`Vider tous les stagiaires de ${formation.title}`}
                  title="Vider la liste des stagiaires ?"
                  description={`Cette action va retirer les ${trainees.length} stagiaire(s) de la formation « ${formation.title} » pour repartir d'une liste vierge (0 stagiaire).`}
                  confirmLabel="Vider la formation"
                  onConfirm={async () => {
                    await clearFormationTrainees(actor, formation);
                    setTrainees([]);
                    await onChanged();
                    announce(`Tous les stagiaires de ${formation.title} ont été retirés.`);
                  }}
                />
              )}
            </div>
          </div>

          {/* Raccourci téléchargement de modèles vierges */}
          <div className="mb-4 rounded-xl border border-border-subtle bg-surface-container-low p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-on-surface-variant">
              Besoin d&apos;ajouter des stagiaires ? Téléchargez un modèle vierge à remplir :
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTraineeExcelTemplate().catch(() => {})}
                className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-container-lowest px-2.5 py-1 font-semibold text-primary hover:bg-surface-container transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#0f6f43]" aria-hidden="true" />
                <span>Modèle .xlsx</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTraineeCsvTemplate()}
                className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-container-lowest px-2.5 py-1 font-semibold text-primary hover:bg-surface-container transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span>Modèle .csv</span>
              </button>
            </div>
          </div>

          {trainees.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Aucun stagiaire inscrit dans cette formation pour le moment. Utilisez le bouton « Importer des stagiaires » ci-dessus.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-container-lowest">
              {trainees.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="font-semibold text-sm text-on-surface">{t.fullName}</span>
                  <Button variant="secondary" className="!min-h-8 !px-3 text-xs" onClick={() => unenroll(t)} aria-label={`Retirer ${t.fullName} de la formation`}>
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
