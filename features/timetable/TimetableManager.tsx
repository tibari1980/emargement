"use client";

import { useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { formatHours, formatShortDate, isValidIsoDate, timeToMinutes, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { createSlot, deleteSlot, listSlots, updateSlot, type SlotInput } from "@/lib/data/timetable";
import { isActive } from "@/lib/data/users";
import { findConflicts, slotMinutes } from "@/lib/domain/schedule";
import { WEEKDAYS, WEEKDAY_LABELS, type TimetableSlot, type Weekday } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { WeekView } from "./WeekView";

export function TimetableManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error } = useReferenceData();
  const [formationId, setFormationId] = useState("");
  const [allSlots, setAllSlots] = useState<TimetableSlot[] | null>(null);
  const [editing, setEditing] = useState<TimetableSlot | "new" | null>(null);
  const weekHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    listSlots()
      .then(setAllSlots)
      .catch(() => setAllSlots([]));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups || !allSlots) return <Loading />;

  const formations = data.formations.filter((f) => f.active !== false);
  const formation = formations.find((f) => f.id === formationId);
  const slots = allSlots.filter((s) => s.formationId === formationId);
  const labelOf = (s: Pick<TimetableSlot, "subjectId" | "trainerId">) =>
    `${lookups.subjectTitle(s.subjectId)} avec ${lookups.personName(s.trainerId)} (${formation?.title ?? ""})`;

  const reloadSlots = async () => setAllSlots(await listSlots());
  const closeEditor = () => {
    setEditing(null);
    setTimeout(() => weekHeading.current?.focus(), 0);
  };

  const weeklyMinutes = slots
    .filter((s) => !s.validTo || s.validTo >= todayIso())
    .reduce((sum, s) => sum + slotMinutes(s), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-xl">
        <SelectField
          label="Formation"
          value={formationId}
          onChange={(e) => {
            setFormationId(e.target.value);
            setEditing(null);
          }}
        >
          <option value="">Choisir une formation</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </SelectField>
      </div>

      {formations.length === 0 && <Alert tone="info">Créez d&apos;abord une formation (page Formations).</Alert>}
      {data.subjects.length === 0 && <Alert tone="info">Créez d&apos;abord les matières (page Matières).</Alert>}

      {formation && (
        <>
          {editing ? (
            <SlotForm
              slot={editing === "new" ? null : editing}
              formationId={formation.id}
              existing={allSlots}
              reference={data}
              labelFor={(s) => `${lookups.subjectTitle(s.subjectId)} — ${lookups.formationTitle(s.formationId)} (${lookups.personName(s.trainerId)})`}
              onSubmit={async (input) => {
                try {
                  if (editing === "new") await createSlot(actor, input, labelOf(input));
                  else await updateSlot(actor, editing, input, labelOf(input));
                  await reloadSlots();
                  announce(`Créneau du ${WEEKDAY_LABELS[input.weekday].toLowerCase()} ${input.startTime} enregistré.`);
                  closeEditor();
                } catch {
                  announce("L'enregistrement du créneau a échoué.", "assertive");
                }
              }}
              onCancel={closeEditor}
            />
          ) : (
            <div>
              <Button onClick={() => setEditing("new")}>Ajouter un créneau</Button>
            </div>
          )}

          <section aria-labelledby="week-heading" className="flex flex-col gap-4">
            <h2 id="week-heading" ref={weekHeading} tabIndex={-1} className="text-2xl font-bold outline-none">
              Semaine type — {formation.title}
            </h2>
            <p>
              {slots.length} créneau{slots.length > 1 ? "x" : ""}, {formatHours(weeklyMinutes / 60)} de formation par semaine.
            </p>
            <WeekView
              slots={slots}
              subjectTitle={lookups.subjectTitle}
              detail={(s) => lookups.personName(s.trainerId)}
              actions={(s) => (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditing(s)} aria-label={`Modifier le créneau ${labelOf(s)}`}>
                    Modifier
                  </Button>
                  <ConfirmDialog
                    triggerLabel="Supprimer"
                    triggerAccessibleLabel={`Supprimer le créneau ${labelOf(s)}`}
                    title="Supprimer ce créneau ?"
                    description="À utiliser pour un créneau créé par erreur. Si le cours a déjà eu lieu, indiquez plutôt une date de fin dans « Modifier » : l'historique d'émargement reste rattaché au créneau."
                    confirmLabel="Supprimer le créneau"
                    onConfirm={async () => {
                      try {
                        await deleteSlot(actor, s, labelOf(s));
                        await reloadSlots();
                        announce("Créneau supprimé.");
                        weekHeading.current?.focus();
                      } catch {
                        announce("La suppression a échoué.", "assertive");
                      }
                    }}
                  />
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}

const EMPTY_SLOT = (formationId: string): SlotInput => ({
  formationId,
  subjectId: "",
  trainerId: "",
  weekday: 1,
  startTime: "09:00",
  endTime: "10:30",
  room: "",
  validFrom: todayIso(),
  validTo: null,
});

function SlotForm({
  slot,
  formationId,
  existing,
  reference,
  labelFor,
  onSubmit,
  onCancel,
}: {
  slot: TimetableSlot | null;
  formationId: string;
  existing: TimetableSlot[];
  reference: NonNullable<ReturnType<typeof useReferenceData>["data"]>;
  labelFor: (s: TimetableSlot) => string;
  onSubmit: (input: SlotInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SlotInput>(slot ? { ...EMPTY_SLOT(formationId), ...slot } : EMPTY_SLOT(formationId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const subjects = reference.subjects.filter((s) => s.active !== false || s.id === form.subjectId);
  const subject = reference.subjects.find((s) => s.id === form.subjectId);
  const trainers = reference.staff.filter(
    (u) =>
      (u.role === "trainer" || u.role === "pedagogical_lead") &&
      (isActive(u) || u.id === form.trainerId) &&
      (!subject?.trainerIds?.length || subject.trainerIds.includes(u.id) || u.id === form.trainerId),
  );
  const set = <K extends keyof SlotInput>(key: K, value: SlotInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const e: Record<string, string> = {};
    if (!form.subjectId) e.subjectId = "Choisissez la matière.";
    if (!form.trainerId) e.trainerId = "Choisissez le formateur.";
    const start = timeToMinutes(form.startTime);
    const end = timeToMinutes(form.endTime);
    if (start === null) e.startTime = "Heure de début invalide.";
    if (end === null) e.endTime = "Heure de fin invalide.";
    else if (start !== null && end <= start) e.endTime = "La fin doit être après le début.";
    if (!isValidIsoDate(form.validFrom)) e.validFrom = "Date invalide.";
    if (form.validTo && (!isValidIsoDate(form.validTo) || form.validTo < form.validFrom)) {
      e.validTo = "La date de fin doit être postérieure à la date de début.";
    }
    setErrors(e);
    if (Object.keys(e).length) return setConflicts([]);

    const found = findConflicts({ ...form, id: slot?.id }, existing);
    setConflicts(
      found.map(({ kind, slot: other }) =>
        kind === "formation"
          ? `Chevauchement avec un autre créneau de la formation : ${WEEKDAY_LABELS[other.weekday]} ${other.startTime}–${other.endTime}, ${labelFor(other)}.`
          : `Le formateur enseigne déjà à ce moment : ${WEEKDAY_LABELS[other.weekday]} ${other.startTime}–${other.endTime}, ${labelFor(other)}.`,
      ),
    );
    if (found.length) return;

    setBusy(true);
    await onSubmit({ ...form, room: form.room.trim(), validTo: form.validTo || null });
    setBusy(false);
  };

  return (
    <section aria-labelledby="slot-form-heading" className="rounded-lg border-2 border-blue-800 bg-white p-5">
      <h2 id="slot-form-heading" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
        {slot ? "Modifier le créneau" : "Nouveau créneau"}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {(Object.keys(errors).length > 0 || conflicts.length > 0) && (
          <Alert tone="error">
            {conflicts.length ? (
              <ul className="ml-5 list-disc">
                {conflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              "Le formulaire contient des erreurs. Corrigez les champs signalés."
            )}
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Jour" value={form.weekday} onChange={(e) => set("weekday", Number(e.target.value) as Weekday)}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]}
              </option>
            ))}
          </SelectField>
          <TextField label="Début" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} error={errors.startTime} />
          <TextField label="Fin" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} error={errors.endTime} />
          <SelectField label="Matière" value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)} error={errors.subjectId}>
            <option value="">Choisir une matière</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Formateur"
            value={form.trainerId}
            onChange={(e) => set("trainerId", e.target.value)}
            error={errors.trainerId}
            hint={subject?.trainerIds?.length ? "Formateurs habilités pour cette matière." : undefined}
          >
            <option value="">Choisir un formateur</option>
            {trainers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
          <TextField label="Salle" value={form.room} onChange={(e) => set("room", e.target.value)} hint="Facultatif." />
          <TextField
            label="Valable à partir du"
            type="date"
            value={form.validFrom}
            onChange={(e) => set("validFrom", e.target.value)}
            error={errors.validFrom}
          />
          <TextField
            label="Jusqu'au"
            type="date"
            value={form.validTo ?? ""}
            onChange={(e) => set("validTo", e.target.value || null)}
            error={errors.validTo}
            hint={form.validTo ? `Dernière séance le ${formatShortDate(form.validTo)}.` : "Laisser vide : sans date de fin."}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer le créneau"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </section>
  );
}
