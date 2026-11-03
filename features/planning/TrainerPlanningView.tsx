"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Info, Sparkles } from "lucide-react";
import { ApplicationGuide } from "@/components/ApplicationGuide";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { addDays, formatHours, formatShortDate, getWeekMonday, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { deduplicateFormationsList } from "@/lib/data/formations";
import { getInitialSlots, listSlots } from "@/lib/data/timetable";
import { slotMinutes } from "@/lib/domain/schedule";
import type { TimetableSlot } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { TimetableExportButtons } from "@/features/timetable/TimetableExportButtons";
import { WeekView } from "@/features/timetable/WeekView";

type View = "trainer" | "formation";

/**
 * Vue Planning exclusivement dédiée au profil Formateur (`trainer`).
 * Isolation stricte de confidentialité :
 * - Un formateur ne peut jamais consulter le planning individuel d'un autre formateur.
 * - Affiche son planning personnel ou le planning hebdomadaire d'une promotion.
 */
export function TrainerPlanningView({ actor }: { actor: Actor }) {
  const { data, lookups, error } = useReferenceData();
  const [slots, setSlots] = useState<TimetableSlot[]>(() => getInitialSlots());
  const [view, setView] = useState<View>("trainer");
  const [formationId, setFormationId] = useState("");
  const currentWeekMonday = getWeekMonday(todayIso());
  const [selectedMonday, setSelectedMonday] = useState(() => currentWeekMonday);
  const isCurrentWeek = selectedMonday === currentWeekMonday;

  useEffect(() => {
    listSlots()
      .then(setSlots)
      .catch(() => setSlots([]));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups || !slots) return <Loading label="Chargement de votre planning…" />;

  const today = todayIso();

  const current = slots.filter((s) => {
    if (s.validTo && s.validTo < today) return false;
    const formation = lookups.formation(s.formationId);
    if (!formation || formation.active === false) return false;
    return true;
  });

  const mySlots = current.filter((s) => s.trainerId === actor.id);
  const myFormationIds = new Set(mySlots.map((s) => s.formationId));
  const dedupedFormations = deduplicateFormationsList(data.formations);

  const myTaughtFormations = dedupedFormations.filter(
    (f) => f.active !== false && myFormationIds.has(f.id),
  );
  const otherFormations = dedupedFormations.filter(
    (f) => f.active !== false && !myFormationIds.has(f.id),
  );

  const formationWithSlots = dedupedFormations.find(
    (f) => f.active !== false && current.some((s) => s.formationId === f.id),
  );
  const defaultFormationId =
    myTaughtFormations[0]?.id ??
    formationWithSlots?.id ??
    (dedupedFormations.find((f) => f.active !== false)?.id ?? "");
  const selectedFormationId = formationId || defaultFormationId;

  const selected =
    view === "trainer"
      ? mySlots
      : current.filter((s) => s.formationId === selectedFormationId && selectedFormationId !== "");

  const minutes = selected.reduce((sum, s) => sum + slotMinutes(s), 0);
  const subjectsTaught = [...new Set(selected.map((s) => lookups.subjectTitle(s.subjectId)))];

  return (
    <div className="flex flex-col gap-6">
      <ApplicationGuide />

      {/* 1. SÉLECTEUR DU PLANNING FORMATEUR */}
      <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            <span>Consultation de votre planning</span>
          </h2>
        </div>

        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <SelectField
            label="Afficher le planning"
            value={view}
            onChange={(e) => setView(e.target.value as View)}
          >
            <option value="trainer">Mon planning individuel</option>
            <option value="formation">D&apos;une formation / promotion</option>
          </SelectField>

          {view === "trainer" ? (
            <SelectField
              label="Votre profil formateur"
              value={actor.id}
              onChange={() => {}}
              disabled
              hint="Votre planning individuel est affiché (accès restreint à vos cours)."
            >
              <option value={actor.id}>
                {actor.fullName} {mySlots.length > 0 ? `(${mySlots.length} cours / semaine)` : "(aucun cours affecté)"}
              </option>
            </SelectField>
          ) : (
            <SelectField
              label="Formation / Promotion"
              value={selectedFormationId}
              onChange={(e) => setFormationId(e.target.value)}
            >
              <option value="">-- Choisir une formation / promotion --</option>
              {myTaughtFormations.length > 0 && (
                <optgroup label="Vos formations d'intervention (où vous dispensez des cours)">
                  {myTaughtFormations.map((f) => {
                    const myCount = mySlots.filter((s) => s.formationId === f.id).length;
                    const totalCount = current.filter((s) => s.formationId === f.id).length;
                    return (
                      <option key={f.id} value={f.id}>
                        {f.title} ({myCount} de vos cours · {totalCount} cours au total)
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {otherFormations.length > 0 && (
                <optgroup label="Autres formations du centre">
                  {otherFormations.map((f) => {
                    const totalCount = current.filter((s) => s.formationId === f.id).length;
                    return (
                      <option key={f.id} value={f.id}>
                        {f.title} {totalCount > 0 ? `(${totalCount} cours)` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </SelectField>
          )}
        </div>
      </div>

      {/* 2. GRILLE HEBDOMADAIRE */}
      <section aria-labelledby="trainer-planning-heading" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h2 id="trainer-planning-heading" className="text-2xl font-bold text-primary tracking-tight">
              {view === "trainer"
                ? `Votre planning personnel (${actor.fullName})`
                : lookups.formationTitle(selectedFormationId)}
            </h2>
            <p className="text-sm text-on-surface-variant">
              Volume hebdomadaire : <span className="font-bold text-primary">{formatHours(minutes / 60)} par semaine</span>
              {subjectsTaught.length > 0 && ` — matières : ${subjectsTaught.join(", ")}`}.
              {view === "formation" && (
                <span className="block sm:inline sm:ml-2 text-xs font-semibold text-secondary">
                  {mySlots.filter((s) => s.formationId === selectedFormationId).length > 0
                    ? `(Vous assurez ${mySlots.filter((s) => s.formationId === selectedFormationId).length} cours dans cette promotion)`
                    : "(Vous n'avez pas de cours dans cette promotion)"}
                </span>
              )}
            </p>
          </div>
          <TimetableExportButtons
            mode={view}
            targetId={view === "trainer" ? actor.id : selectedFormationId}
            targetTitle={
              view === "trainer"
                ? actor.fullName
                : lookups.formationTitle(selectedFormationId)
            }
            slots={selected}
            subjectTitle={lookups.subjectTitle}
            formationTitle={lookups.formationTitle}
            trainerName={lookups.trainerName}
          />
        </div>

        {selected.length === 0 && (
          <div className="rounded-2xl border-2 border-secondary/40 bg-surface-container-low p-4 sm:p-5 shadow-xs flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0 mt-0.5">
              <Info className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-base text-primary">
                {view === "trainer"
                  ? "Aucun créneau de cours spécifique ne vous a encore été attribué"
                  : "Horaire journalier standard actif (Lundi au Vendredi · 09:00 – 17:00)"}
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                {view === "trainer"
                  ? "Votre compte est bien actif. Vos créneaux hebdomadaires par matière apparaîtront ici dès que le responsable pédagogique les aura enregistrés dans la grille d'emploi du temps."
                  : "Cette promotion fonctionne actuellement sur l'horaire réglementaire standard du centre (09:00 – 17:00, 7h/jour, 35h/semaine)."}
              </p>
            </div>
          </div>
        )}

        <WeekView
          slots={selected}
          subjectTitle={lookups.subjectTitle}
          detailHeader={view === "trainer" ? "Formation" : "Formateur"}
          detail={(s) => {
            if (view === "trainer") {
              return lookups.formationTitle(s.formationId);
            }
            if (s.trainerId === actor.id) {
              return (
                <span className="inline-flex items-center gap-1.5 font-bold text-secondary">
                  <span>{lookups.trainerName(s.trainerId)}</span>
                  <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-bold text-secondary border border-secondary/40">
                    Vous
                  </span>
                </span>
              );
            }
            return lookups.trainerName(s.trainerId);
          }}
        />
      </section>
    </div>
  );
}
