"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, GraduationCap, Info } from "lucide-react";
import { ApplicationGuide } from "@/components/ApplicationGuide";
import { Alert, Loading } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/Field";
import { formatHours, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { deduplicateFormationsList, groupFormations } from "@/lib/data/formations";
import { getInitialSlots, listSlots } from "@/lib/data/timetable";
import { isActive } from "@/lib/data/users";
import { can } from "@/lib/domain/permissions";
import { slotMinutes } from "@/lib/domain/schedule";
import type { TimetableSlot } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { WeekView } from "@/features/timetable/WeekView";

type View = "formation" | "trainer";

/**
 * Vue Supervision des Plannings (multi-promotions & multi-formateurs).
 * Exclusivement dédiée aux profils : Secrétariat (`secretary`), Responsable pédagogique (`pedagogical_lead`) et Administrateur (`admin`).
 */
export function StaffPlanningSupervisor({ actor }: { actor: Actor }) {
  const { data, lookups, error } = useReferenceData();
  const [slots, setSlots] = useState<TimetableSlot[]>(() => getInitialSlots());
  const [view, setView] = useState<View>("formation");
  const [trainerId, setTrainerId] = useState("");
  const [formationId, setFormationId] = useState("");

  useEffect(() => {
    listSlots()
      .then(setSlots)
      .catch(() => setSlots([]));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups || !slots) return <Loading label="Chargement des plannings du centre…" />;

  const today = todayIso();

  const current = slots.filter((s) => {
    if (s.validTo && s.validTo < today) return false;
    const formation = lookups.formation(s.formationId);
    if (!formation || formation.active === false) return false;
    return true;
  });

  // Filtrage strict : uniquement les comptes avec le rôle Formateur
  const trainers = data.staff.filter((u) => u.role === "trainer" && isActive(u));
  const dedupedFormations = deduplicateFormationsList(data.formations);

  const formationWithSlots = dedupedFormations.find(
    (f) => f.active !== false && current.some((s) => s.formationId === f.id),
  );
  const defaultFormationId =
    formationWithSlots?.id ?? (dedupedFormations.find((f) => f.active !== false)?.id ?? "");
  const selectedFormationId = formationId || defaultFormationId;

  const trainerWithSlots = trainers.find((u) => current.some((s) => s.trainerId === u.id));
  const selectedTrainerId =
    trainerId || (trainerWithSlots?.id ?? (trainers.length > 0 ? trainers[0].id : ""));

  const selected =
    view === "trainer"
      ? current.filter((s) => s.trainerId === selectedTrainerId && selectedTrainerId !== "")
      : current.filter((s) => s.formationId === selectedFormationId && selectedFormationId !== "");

  const minutes = selected.reduce((sum, s) => sum + slotMinutes(s), 0);
  const subjectsTaught = [...new Set(selected.map((s) => lookups.subjectTitle(s.subjectId)))];
  const groupedFormations = groupFormations(data.formations);
  const canEditTimetable = can(actor.role, "timetable.manage");

  return (
    <div className="flex flex-col gap-6">
      <ApplicationGuide />

      {/* 1. SÉLECTEUR DE SUPERVISION DU PLANNING */}
      <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-5 shadow-xs flex flex-col gap-4">
        <h2 className="text-base font-bold text-primary flex items-center gap-2">
          <Calendar className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Supervision des plannings (Filières &amp; Formateurs)</span>
        </h2>

        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <SelectField
            label="Afficher le planning"
            value={view}
            onChange={(e) => setView(e.target.value as View)}
          >
            <option value="formation">D&apos;une formation / promotion</option>
            <option value="trainer">D&apos;un formateur</option>
          </SelectField>

          {view === "trainer" ? (
            <SelectField
              label="Formateur"
              value={selectedTrainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              disabled={trainers.length === 0}
              hint={trainers.length === 0 ? "Aucun compte avec le rôle Formateur." : undefined}
            >
              <option value="">
                {trainers.length === 0 ? "-- Aucun formateur enregistré --" : "-- Choisir un formateur --"}
              </option>
              {trainers.map((u) => {
                const count = current.filter((s) => s.trainerId === u.id).length;
                return (
                  <option key={u.id} value={u.id}>
                    {u.fullName} {count > 0 ? `(${count} cours / semaine)` : "(aucun cours affecté)"}
                  </option>
                );
              })}
            </SelectField>
          ) : (
            <SelectField
              label="Formation / Promotion"
              value={selectedFormationId}
              onChange={(e) => setFormationId(e.target.value)}
            >
              <option value="">-- Choisir une formation / promotion --</option>
              {groupedFormations.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((f) => {
                    const count = current.filter((s) => s.formationId === f.id).length;
                    return (
                      <option key={f.id} value={f.id}>
                        {f.title} {count > 0 ? `(${count} cours)` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </SelectField>
          )}
        </div>

        {view === "trainer" && trainers.length === 0 && (
          <div className="rounded-xl border border-secondary/30 bg-surface-container-low p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-on-surface">
              <Info className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
              <span>
                Aucun compte avec le rôle <strong>Formateur</strong> n&apos;a encore été créé. Les comptes administrateur et secrétariat ne sont pas listés ici car ils n&apos;enseignent pas.
              </span>
            </div>
            {actor.role === "admin" && (
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 font-bold text-secondary hover:underline cursor-pointer shrink-0"
              >
                <span>Créer un compte Formateur</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 2. AFFICHAGE DE LA GRILLE HEBDOMADAIRE */}
      {view === "trainer" && trainers.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-8 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-primary">Aucun formateur enregistré</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Pour afficher le planning d&apos;un formateur, un compte avec le rôle « Formateur » doit d&apos;abord être créé dans l&apos;onglet Utilisateurs.
            </p>
          </div>
          {actor.role === "admin" && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors mt-2"
            >
              <span>Accéder à la gestion des utilisateurs</span>
            </Link>
          )}
        </div>
      ) : (view === "trainer" ? selectedTrainerId : selectedFormationId) ? (
        <section aria-labelledby="staff-planning-heading" className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div>
              <h2 id="staff-planning-heading" className="text-2xl font-bold text-primary tracking-tight">
                {view === "trainer"
                  ? (trainers.find((u) => u.id === selectedTrainerId)?.fullName ?? "Formateur")
                  : lookups.formationTitle(selectedFormationId)}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Volume hebdomadaire : <span className="font-bold text-primary">{formatHours(minutes / 60)} par semaine</span>
                {subjectsTaught.length > 0 && ` — matières : ${subjectsTaught.join(", ")}`}.
              </p>
            </div>
            {canEditTimetable && (
              <Link
                href="/pedagogical/timetable"
                className="inline-flex items-center gap-2 rounded-xl border border-secondary/40 bg-surface-container-low px-3.5 py-2 text-xs sm:text-sm font-bold text-primary hover:bg-surface-container transition-colors shrink-0"
              >
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Gérer les emplois du temps</span>
              </Link>
            )}
          </div>

          {selected.length === 0 && (
            <div className="rounded-2xl border-2 border-secondary/40 bg-surface-container-low p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0 mt-0.5">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-bold text-base text-primary">
                    {view === "trainer"
                      ? `Aucun cours n'est encore affecté à ${trainers.find((u) => u.id === selectedTrainerId)?.fullName ?? "ce formateur"}`
                      : `Horaire journalier standard actif (Lundi au Vendredi · 09:00 – 17:00)`}
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                    {view === "trainer"
                      ? "Le compte formateur est bien actif, mais aucun créneau horaire régulier ne lui a encore été attribué. Vous pouvez lui assigner des cours directement dans l'onglet « Emplois du temps »."
                      : "Cette promotion fonctionne actuellement sur l'horaire réglementaire standard du centre (09:00 – 17:00, 7h/jour, 35h/semaine) pour l'Émargement, les Justificatifs et les Rapports mensuels ASP. Vous pouvez découper sa semaine matière par matière dans l'onglet « Emplois du temps »."}
                  </p>
                </div>
              </div>
              {canEditTimetable && (
                <Link
                  href="/pedagogical/timetable"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors shrink-0"
                >
                  <span>Affecter des cours</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              )}
            </div>
          )}

          <WeekView
            slots={selected}
            subjectTitle={lookups.subjectTitle}
            detailHeader={view === "trainer" ? "Formation" : "Formateur"}
            detail={(s) =>
              view === "trainer"
                ? lookups.formationTitle(s.formationId)
                : lookups.trainerName(s.trainerId)
            }
          />
        </section>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-8 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <p className="text-base font-semibold text-primary">
            {view === "trainer"
              ? "Aucun formateur sélectionné."
              : "Aucune formation active sélectionnée."}
          </p>
          <p className="text-sm text-on-surface-variant">
            Les créneaux de cours sont configurés dans l&apos;onglet « Emplois du temps ».
          </p>
        </div>
      )}
    </div>
  );
}
