"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { COURSE_CATALOG } from "@/lib/catalog";
import { formatHours, timeToMinutes } from "@/lib/dates";
import {
  createCourse,
  deleteCourse,
  listCourses,
  listUsers,
  listUsersByIds,
  removeTraineeFromCourse,
  updateCourse,
  type CourseInput,
} from "@/lib/firestore";
import { rolesFor } from "@/lib/navigation";
import { SECTORS, SECTOR_LABELS, type Course, type Sector, type UserProfile } from "@/lib/types";

const EMPTY_COURSE: CourseInput = {
  title: "",
  sector: "tertiary",
  pedagogicalLeadId: "",
  trainerIds: [],
  defaultStartTime: "09:00",
  defaultEndTime: "17:00",
  dailyHours: 7,
  traineeIds: [],
};

export default function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Formations et horaires"
        description="Configurez pour chaque formation les horaires théoriques du lundi au vendredi, le responsable pédagogique et les formateurs chargés de l'émargement."
      />
      <RoleGuard roles={rolesFor("/pedagogical/courses")}>{(profile) => <CourseManager profile={profile} />}</RoleGuard>
    </>
  );
}

function CourseManager({ profile }: { profile: UserProfile }) {
  const announce = useAnnounce();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  const apply = useCallback(([courses, users]: [Course[], UserProfile[]]) => {
    setCourses(courses);
    setStaff(users.filter((u) => u.role !== "trainee"));
  }, []);
  const reload = async () => apply(await Promise.all([listCourses(), listUsers()]));

  useEffect(() => {
    Promise.all([listCourses(), listUsers()])
      .then(apply)
      .catch(() => setError("Impossible de charger les formations."));
  }, [apply]);

  const closeEditor = () => {
    setEditing(null);
    // Return focus to a stable landmark once the form disappears.
    setTimeout(() => listHeading.current?.focus(), 0);
  };

  const missingCatalog = courses
    ? COURSE_CATALOG.filter((c) => !courses.some((existing) => existing.title === c.title))
    : [];

  const createCatalog = async () => {
    try {
      for (const c of missingCatalog) {
        await createCourse({ ...EMPTY_COURSE, ...c, pedagogicalLeadId: profile.role === "pedagogical_lead" ? profile.id : "" });
      }
      await reload();
      announce(`${missingCatalog.length} formations du catalogue créées.`);
    } catch {
      announce("Échec de la création des formations du catalogue.", "assertive");
    }
  };

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!courses) return <Loading />;

  const nameOf = (id: string) => staff.find((u) => u.id === id)?.fullName ?? "Non attribué";

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <CourseForm
          course={editing === "new" ? null : editing}
          staff={staff}
          defaultLeadId={profile.role === "pedagogical_lead" ? profile.id : ""}
          onDone={async (message) => {
            await reload();
            announce(message);
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setEditing("new")}>Nouvelle formation</Button>
          {missingCatalog.length > 0 && (
            <Button variant="secondary" onClick={createCatalog}>
              Créer les {missingCatalog.length} formations du catalogue ESRP
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading" ref={listHeading} tabIndex={-1} className="mb-3 text-xl font-bold outline-none">
          {courses.length} formation{courses.length > 1 ? "s" : ""}
        </h2>
        {courses.length === 0 ? (
          <Alert tone="info">Aucune formation pour le moment.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Liste des formations</caption>
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="p-3">Formation</th>
                  <th scope="col" className="p-3">Secteur</th>
                  <th scope="col" className="p-3">Horaires</th>
                  <th scope="col" className="p-3">Responsable</th>
                  <th scope="col" className="p-3">Stagiaires</th>
                  <th scope="col" className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-t-2 border-gray-200 align-top">
                    <th scope="row" className="p-3 font-semibold">{c.title}</th>
                    <td className="p-3">{SECTOR_LABELS[c.sector] ?? c.sector}</td>
                    <td className="p-3">
                      {c.defaultStartTime} – {c.defaultEndTime} ({formatHours(c.dailyHours)} par jour)
                    </td>
                    <td className="p-3">{nameOf(c.pedagogicalLeadId)}</td>
                    <td className="p-3">{c.traineeIds?.length ?? 0}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setEditing(c)} aria-label={`Modifier ${c.title}`}>
                          Modifier
                        </Button>
                        <ConfirmDialog
                          triggerLabel="Supprimer"
                          triggerAccessibleLabel={`Supprimer ${c.title}`}
                          title="Supprimer la formation ?"
                          description={`La formation « ${c.title} » sera supprimée. Les émargements déjà saisis sont conservés mais ne seront plus rattachés à une formation visible.`}
                          confirmLabel="Supprimer définitivement"
                          onConfirm={async () => {
                            try {
                              await deleteCourse(c.id);
                              await reload();
                              announce(`Formation ${c.title} supprimée.`);
                              setTimeout(() => listHeading.current?.focus(), 0);
                            } catch {
                              announce("Échec de la suppression.", "assertive");
                            }
                          }}
                        />
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

function CourseForm({
  course,
  staff,
  defaultLeadId,
  onDone,
  onCancel,
}: {
  course: Course | null;
  staff: UserProfile[];
  defaultLeadId: string;
  onDone: (message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CourseInput>(
    course ? { ...EMPTY_COURSE, ...course } : { ...EMPTY_COURSE, pedagogicalLeadId: defaultLeadId },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trainees, setTrainees] = useState<UserProfile[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const enrolledHeading = useRef<HTMLHeadingElement>(null);
  const announce = useAnnounce();

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (course?.traineeIds?.length) listUsersByIds(course.traineeIds).then(setTrainees).catch(() => {});
  }, [course]);

  const leads = staff.filter((u) => u.role === "pedagogical_lead" || u.role === "admin");
  const trainers = staff.filter((u) => u.role === "trainer" || u.role === "admin");
  const set = <K extends keyof CourseInput>(key: K, value: CourseInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Le titre est obligatoire.";
    const start = timeToMinutes(form.defaultStartTime);
    const end = timeToMinutes(form.defaultEndTime);
    if (start === null) e.defaultStartTime = "Heure de début invalide.";
    if (end === null) e.defaultEndTime = "Heure de fin invalide.";
    if (start !== null && end !== null && end <= start) e.defaultEndTime = "La fin doit être après le début.";
    if (!(form.dailyHours > 0 && form.dailyHours <= 12)) e.dailyHours = "Indiquez une durée entre 0,5 et 12 heures.";
    else if (start !== null && end !== null && form.dailyHours * 60 > end - start) {
      e.dailyHours = "La durée quotidienne dépasse l'amplitude horaire.";
    }
    return e;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setSaveError(`Le formulaire contient ${Object.keys(e).length} erreur(s). Corrigez les champs signalés.`);
      return;
    }
    setSaveError(null);
    setBusy(true);
    const data: CourseInput = { ...form, title: form.title.trim() };
    try {
      if (course) {
        // Enrolment is managed separately (import, removal below): never overwrite it here.
        const { traineeIds: _ignored, ...rest } = data;
        void _ignored;
        await updateCourse(course.id, rest);
        await onDone(`Formation ${data.title} enregistrée.`);
      } else {
        await createCourse(data);
        await onDone(`Formation ${data.title} créée.`);
      }
    } catch {
      setSaveError("L'enregistrement a échoué. Vérifiez vos droits et votre connexion.");
    } finally {
      setBusy(false);
    }
  };

  const removeTrainee = async (t: UserProfile) => {
    if (!course) return;
    try {
      await removeTraineeFromCourse(course.id, t.id);
      setTrainees((list) => list.filter((x) => x.id !== t.id));
      announce(`${t.fullName} retiré de la formation.`);
      enrolledHeading.current?.focus();
    } catch {
      announce(`Impossible de retirer ${t.fullName}.`, "assertive");
    }
  };

  return (
    <section aria-labelledby="course-form-heading" className="rounded-lg border-2 border-blue-800 bg-white p-5">
      <h2 id="course-form-heading" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
        {course ? `Modifier « ${course.title} »` : "Nouvelle formation"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {saveError && <Alert tone="error">{saveError}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Titre de la formation" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title} required />
          <SelectField label="Secteur" value={form.sector} onChange={(e) => set("sector", e.target.value as Sector)}>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Heure de début"
            type="time"
            value={form.defaultStartTime}
            onChange={(e) => set("defaultStartTime", e.target.value)}
            error={errors.defaultStartTime}
            hint="Sert de référence pour calculer les minutes de retard."
          />
          <TextField label="Heure de fin" type="time" value={form.defaultEndTime} onChange={(e) => set("defaultEndTime", e.target.value)} error={errors.defaultEndTime} />
          <TextField
            label="Heures de formation par jour"
            type="number"
            min={0.5}
            max={12}
            step={0.25}
            value={Number.isFinite(form.dailyHours) ? form.dailyHours : ""}
            onChange={(e) => set("dailyHours", e.target.valueAsNumber)}
            error={errors.dailyHours}
            hint="Hors pause déjeuner. Exemple : 7 pour 9 h – 17 h avec une heure de pause."
          />
          <SelectField label="Responsable pédagogique" value={form.pedagogicalLeadId} onChange={(e) => set("pedagogicalLeadId", e.target.value)}>
            <option value="">Non attribué</option>
            {leads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
        </div>

        <fieldset className="rounded-md border-2 border-gray-300 p-4">
          <legend className="px-1 font-semibold">Formateurs autorisés à faire l&apos;émargement</legend>
          {trainers.length === 0 ? (
            <p>Aucun compte formateur. Créez-en un depuis la page Utilisateurs.</p>
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
                        set(
                          "trainerIds",
                          e.target.checked ? [...form.trainerIds, t.id] : form.trainerIds.filter((id) => id !== t.id),
                        )
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

      {course && (
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
                  <Button variant="secondary" onClick={() => removeTrainee(t)} aria-label={`Retirer ${t.fullName} de la formation`}>
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
