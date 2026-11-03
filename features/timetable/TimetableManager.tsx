"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Calendar, CalendarRange, ChevronLeft, ChevronRight, Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { addDays, formatHours, formatShortDate, getWeekMonday, isValidIsoDate, timeToMinutes, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { groupFormations } from "@/lib/data/formations";
import {
  cleanupDuplicateSlots,
  createSlot,
  deleteSlot,
  duplicateSlotToDays,
  listSlots,
  updateSlot,
  type SlotInput,
} from "@/lib/data/timetable";
import { updateSubject } from "@/lib/data/subjects";
import { isActive } from "@/lib/data/users";
import { findConflicts, slotMinutes } from "@/lib/domain/schedule";
import { WEEKDAYS, WEEKDAY_LABELS, type TimetableSlot, type Weekday } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { ApplyMonthModal } from "./ApplyMonthModal";
import { DuplicateWeekModal } from "./DuplicateWeekModal";
import { GenerateStandardWeekModal } from "./GenerateStandardWeekModal";
import { TimetableExportButtons } from "./TimetableExportButtons";
import { WeekView } from "./WeekView";

export function TimetableManager({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error, reload } = useReferenceData();
  const [formationId, setFormationId] = useState("");
  const [allSlots, setAllSlots] = useState<TimetableSlot[] | null>(null);
  const [editing, setEditing] = useState<TimetableSlot | "new" | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showApplyMonthModal, setShowApplyMonthModal] = useState(false);
  const [showStandardWeekModal, setShowStandardWeekModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const weekHeading = useRef<HTMLHeadingElement>(null);
  const currentWeekMonday = getWeekMonday(todayIso());
  const [selectedMonday, setSelectedMonday] = useState(() => currentWeekMonday);
  const isCurrentWeek = selectedMonday === currentWeekMonday;

  useEffect(() => {
    listSlots()
      .then(setAllSlots)
      .catch(() => setAllSlots([]));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups || !allSlots) return <Loading />;

  const formations = data.formations.filter((f) => f.active !== false);
  const selectedFormationId =
    formationId || (formations.length > 0 ? formations[0].id : "");
  const formation = formations.find((f) => f.id === selectedFormationId);
  const slots = allSlots.filter((s) => s.formationId === selectedFormationId);
  const labelOf = (s: Pick<TimetableSlot, "subjectId" | "trainerId">) =>
    `${lookups.subjectTitle(s.subjectId)} avec ${lookups.trainerName(s.trainerId)} (${formation?.title ?? ""})`;

  const reloadSlots = async () => setAllSlots(await listSlots());
  const closeEditor = () => {
    setEditing(null);
    setTimeout(() => weekHeading.current?.focus(), 0);
  };

  const handleCleanDuplicates = async () => {
    setCleaning(true);
    try {
      const deleted = await cleanupDuplicateSlots(actor, selectedFormationId);
      await reloadSlots();
      await reload();
      announce(`${deleted} doublon(s) supprimé(s) avec succès.`);
    } catch {
      announce("La purge des doublons a échoué.", "assertive");
    } finally {
      setCleaning(false);
    }
  };

  const weeklyMinutes = slots
    .filter((s) => !s.validTo || s.validTo >= todayIso())
    .reduce((sum, s) => sum + slotMinutes(s), 0);

  const groupedFormations = groupFormations(formations);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-5 shadow-xs max-w-xl">
        <SelectField
          label="Formation / Promotion"
          value={selectedFormationId}
          onChange={(e) => {
            setFormationId(e.target.value);
            setEditing(null);
          }}
        >
          <option value="">Choisir une formation</option>
          {groupedFormations.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      </div>

      {formations.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Calendar className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-primary">Aucune formation active</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Pour configurer un emploi du temps, une formation est requise. Vous pouvez créer votre première formation dans l&apos;onglet Formations.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Link
              href="/pedagogical/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors"
            >
              <span>Créer une formation</span>
            </Link>
          </div>
        </div>
      )}
      {formations.length > 0 && data.subjects.length === 0 && (
        <Alert tone="info">Créez d&apos;abord les matières (page Matières) pour affecter des cours à cette formation.</Alert>
      )}

      {formation && (
        <>
          {editing ? (
            <SlotForm
              slot={editing === "new" ? null : editing}
              formationId={formation.id}
              existing={allSlots}
              reference={data}
              labelFor={(s) => `${lookups.subjectTitle(s.subjectId)} — ${lookups.formationTitle(s.formationId)} (${lookups.personName(s.trainerId)})`}
              onSubmit={async (input, additionalDays) => {
                try {
                  if (editing === "new") {
                    await createSlot(actor, input, labelOf(input));
                    // Duplication multi-jours optionnelle
                    if (additionalDays && additionalDays.length > 0) {
                      await duplicateSlotToDays(actor, input, additionalDays, labelOf(input));
                    }
                  } else {
                    await updateSlot(actor, editing, input, labelOf(input));
                  }

                  // Si la matière avait une liste restreinte de formateurs, on y intègre automatiquement ce formateur
                  const currentSubject = data.subjects.find((s) => s.id === input.subjectId);
                  if (
                    currentSubject &&
                    Array.isArray(currentSubject.trainerIds) &&
                    currentSubject.trainerIds.length > 0 &&
                    !currentSubject.trainerIds.includes(input.trainerId)
                  ) {
                    await updateSubject(actor, currentSubject, {
                      trainerIds: [...currentSubject.trainerIds, input.trainerId],
                    });
                  }

                  await reloadSlots();
                  await reload();
                  const extraMsg = additionalDays?.length
                    ? ` et dupliqué sur ${additionalDays.length} autre(s) jour(s)`
                    : "";
                  announce(`Créneau du ${WEEKDAY_LABELS[input.weekday].toLowerCase()} ${input.startTime} enregistré${extraMsg}.`);
                  closeEditor();
                } catch {
                  announce("L'enregistrement du créneau a échoué.", "assertive");
                }
              }}
              onCancel={closeEditor}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-border-subtle">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button onClick={() => setEditing("new")} className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Ajouter un créneau</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowApplyMonthModal(true)}
                  disabled={slots.length === 0}
                  className="inline-flex items-center gap-2"
                  title="Appliquer cette semaine à tout le mois en cours (prise d'effet au 1er du mois)"
                >
                  <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Appliquer au mois en cours</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowDuplicateModal(true)}
                  disabled={slots.length === 0}
                  className="inline-flex items-center gap-2"
                  title={slots.length === 0 ? "Aucun créneau à dupliquer" : "Dupliquer cette semaine vers une autre promotion"}
                >
                  <Copy className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Dupliquer vers une autre formation</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowStandardWeekModal(true)}
                  className="inline-flex items-center gap-2"
                  title="Générer automatiquement la grille de 35h réglementaire (09:00-17:00)"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <span>Générer grille 35h</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleCleanDuplicates}
                  disabled={cleaning}
                  className="inline-flex items-center gap-2 text-status-absent hover:bg-status-absent-bg"
                  title="Nettoyer et purger les créneaux en double sur les mêmes horaires"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>{cleaning ? "Purge…" : "Purger les doublons"}</span>
                </Button>
              </div>

              <div className="text-xs text-on-surface-variant font-medium">
                {slots.length > 0 ? (
                  <span>{slots.length} créneau{slots.length > 1 ? "x" : ""} unique{slots.length > 1 ? "s" : ""}</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Aucun créneau configuré</span>
                )}
              </div>
            </div>
          )}

          <section aria-labelledby="week-heading" className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <h2 id="week-heading" ref={weekHeading} tabIndex={-1} className="text-2xl font-bold outline-none">
                  Semaine type — {formation.title}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  <span className="font-bold text-primary">{slots.length} créneau{slots.length > 1 ? "x" : ""}</span>, volume de <span className="font-bold text-primary">{formatHours(weeklyMinutes / 60)}</span> de formation par semaine.
                </p>
              </div>
              <TimetableExportButtons
                mode="formation"
                targetId={formation.id}
                targetTitle={formation.title}
                slots={slots}
                subjectTitle={lookups.subjectTitle}
                formationTitle={lookups.formationTitle}
                trainerName={lookups.trainerName}
              />
            </div>
            {/* Barre de navigation de la semaine dans le calendrier */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-border-subtle">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedMonday(addDays(selectedMonday, -7))}
                  aria-label="Afficher la semaine précédente"
                  className="gap-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Semaine précédente</span>
                </Button>

                <Button
                  variant={isCurrentWeek ? "primary" : "secondary"}
                  onClick={() => setSelectedMonday(currentWeekMonday)}
                  className="px-3 py-1.5 text-xs font-bold"
                  aria-label="Revenir à la semaine actuelle"
                >
                  Semaine en cours
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setSelectedMonday(addDays(selectedMonday, 7))}
                  aria-label="Afficher la semaine suivante"
                  className="gap-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <span className="hidden sm:inline">Semaine suivante</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>
                  Semaine du {formatShortDate(selectedMonday)} au {formatShortDate(addDays(selectedMonday, 4))}
                </span>
              </div>

              <div className="text-xs text-on-surface-variant font-medium">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
                  <span>Récurrence permanente : créneaux appliqués automatiquement</span>
                </span>
              </div>
            </div>

            <WeekView
              slots={slots}
              subjectTitle={lookups.subjectTitle}
              detail={(s) => lookups.personName(s.trainerId)}
              weekMonday={selectedMonday}
              closedDays={lookups.closedDays}
              closureTitle={lookups.closureTitle}
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

          {/* Modal d'application au mois en cours */}
          {showApplyMonthModal && (
            <ApplyMonthModal
              actor={actor}
              currentFormation={formation}
              slots={slots}
              onSuccess={async () => {
                await reloadSlots();
                await reload();
              }}
              onClose={() => setShowApplyMonthModal(false)}
            />
          )}

          {/* Modal de duplication de semaine vers une autre formation */}
          {showDuplicateModal && (
            <DuplicateWeekModal
              actor={actor}
              currentFormation={formation}
              slots={slots}
              allFormations={formations}
              onSuccess={async () => {
                await reloadSlots();
              }}
              onClose={() => setShowDuplicateModal(false)}
            />
          )}

          {/* Modal de génération rapide grille standard 35h */}
          {showStandardWeekModal && (
            <GenerateStandardWeekModal
              actor={actor}
              currentFormation={formation}
              subjects={data.subjects}
              staff={data.staff}
              onSuccess={async () => {
                await reloadSlots();
              }}
              onClose={() => setShowStandardWeekModal(false)}
            />
          )}
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
  validFrom: `${todayIso().slice(0, 7)}-01`,
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
  onSubmit: (input: SlotInput, additionalDays?: number[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SlotInput>(slot ? { ...EMPTY_SLOT(formationId), ...slot } : EMPTY_SLOT(formationId));
  const [extraDays, setExtraDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const subjects = reference.subjects.filter((s) => s.active !== false || s.id === form.subjectId);
  const subject = reference.subjects.find((s) => s.id === form.subjectId);

  // Formateurs éligibles (rôle formateur ou resp. pédagogique)
  const allEligibleTrainers = reference.staff.filter(
    (u) =>
      (u.role === "trainer" || u.role === "pedagogical_lead") &&
      (isActive(u) || u.id === form.trainerId)
  );

  const hasRestrictions = Boolean(subject?.trainerIds && subject.trainerIds.length > 0);
  const habilitatedTrainers = hasRestrictions
    ? allEligibleTrainers.filter((u) => subject!.trainerIds!.includes(u.id))
    : allEligibleTrainers;
  const otherTrainers = hasRestrictions
    ? allEligibleTrainers.filter((u) => !subject!.trainerIds!.includes(u.id))
    : [];
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
    await onSubmit(
      { ...form, room: form.room.trim(), validTo: form.validTo || null },
      !slot ? extraDays : undefined,
    );
    setBusy(false);
  };

  return (
    <section aria-labelledby="slot-form-heading" className="rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-6 shadow-sm">
      <h2 id="slot-form-heading" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold text-primary outline-none">
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
          <SelectField label="Jour principal" value={form.weekday} onChange={(e) => set("weekday", Number(e.target.value) as Weekday)}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]}
              </option>
            ))}
          </SelectField>
          <TextField label="Début" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} error={errors.startTime} />
          <TextField label="Fin" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} error={errors.endTime} />

          {/* Duplication multi-jours en 1 clic (nouveau créneau uniquement) */}
          {!slot && (
            <div className="md:col-span-3 rounded-xl border border-border-subtle bg-surface-container p-3.5 space-y-2">
              <span className="text-xs font-bold text-on-surface">
                Répéter également ce cours sur d&apos;autres jours de la semaine (gain de temps) :
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKDAYS.filter((d) => d !== form.weekday).map((d) => {
                  const isChecked = extraDays.includes(d);
                  return (
                    <label
                      key={d}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        isChecked
                          ? "border-primary bg-primary text-on-primary"
                          : "border-border-subtle bg-surface-container-lowest text-on-surface hover:bg-surface-variant"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setExtraDays([...extraDays, d]);
                          else setExtraDays(extraDays.filter((x) => x !== d));
                        }}
                        className="sr-only"
                      />
                      <span>{WEEKDAY_LABELS[d]}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Cochez les jours supplémentaires pour créer simultanément ces créneaux identiques sans avoir à les retaper.
              </p>
            </div>
          )}

          <SelectField label="Matière" value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)} error={errors.subjectId}>
            <option value="">Choisir une matière</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            {form.subjectId && !subjects.some((s) => s.id === form.subjectId) && (
              <option value={form.subjectId}>
                {reference.subjects.find((s) => s.id === form.subjectId)?.title || form.subjectId}
              </option>
            )}
          </SelectField>
          <SelectField
            label="Formateur"
            value={form.trainerId}
            onChange={(e) => set("trainerId", e.target.value)}
            error={errors.trainerId}
            hint={
              hasRestrictions
                ? "Sélectionnez le formateur pour ce créneau (les formateurs habituels de la matière apparaissent en premier)."
                : undefined
            }
          >
            <option value="">Choisir un formateur</option>
            {hasRestrictions && habilitatedTrainers.length > 0 && otherTrainers.length > 0 ? (
              <>
                <optgroup label="Formateurs habilités pour cette matière">
                  {habilitatedTrainers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (habilité)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Autres formateurs du centre">
                  {otherTrainers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              allEligibleTrainers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))
            )}
            {form.trainerId && !allEligibleTrainers.some((u) => u.id === form.trainerId) && (
              <option value={form.trainerId}>
                {reference.staff.find((u) => u.id === form.trainerId)?.fullName || form.trainerId}
              </option>
            )}
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
            {busy ? "Enregistrement…" : extraDays.length > 0 ? `Enregistrer (${extraDays.length + 1} créneaux)` : "Enregistrer le créneau"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </section>
  );
}
