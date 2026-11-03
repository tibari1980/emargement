"use client";

import { useState } from "react";
import { Clock, Sparkles, X } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { formatHours, timeToMinutes, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { generateStandardWeekSlots } from "@/lib/data/timetable";
import type { Formation, Subject, UserProfile } from "@/lib/domain/types";

interface GenerateStandardWeekModalProps {
  actor: Actor;
  currentFormation: Formation;
  subjects: Subject[];
  staff: UserProfile[];
  onSuccess: () => Promise<void>;
  onClose: () => void;
}

export function GenerateStandardWeekModal({
  actor,
  currentFormation,
  subjects,
  staff,
  onSuccess,
  onClose,
}: GenerateStandardWeekModalProps) {
  const announce = useAnnounce();
  const [defaultSubjectId, setDefaultSubjectId] = useState(subjects[0]?.id || "");
  const trainers = staff.filter((u) => u.role === "trainer" || u.role === "pedagogical_lead");
  const [defaultTrainerId, setDefaultTrainerId] = useState(trainers[0]?.id || "");
  const [room, setRoom] = useState("");
  const [validFrom, setValidFrom] = useState(`${todayIso().slice(0, 7)}-01`);

  // Horaires personnalisables d'entrée et de sortie de la formation
  const [morningStart, setMorningStart] = useState("09:00");
  const [morningEnd, setMorningEnd] = useState("12:30");
  const [afternoonStart, setAfternoonStart] = useState("13:30");
  const [afternoonEnd, setAfternoonEnd] = useState("17:00");

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Calcul dynamique des volumes horaires
  const mStartMin = timeToMinutes(morningStart);
  const mEndMin = timeToMinutes(morningEnd);
  const aStartMin = timeToMinutes(afternoonStart);
  const aEndMin = timeToMinutes(afternoonEnd);

  const mMinutes = mStartMin !== null && mEndMin !== null ? Math.max(0, mEndMin - mStartMin) : 0;
  const aMinutes = aStartMin !== null && aEndMin !== null ? Math.max(0, aEndMin - aStartMin) : 0;
  const dailyMinutes = mMinutes + aMinutes;
  const weeklyMinutes = dailyMinutes * 5;

  let timingError: string | null = null;
  if (mStartMin === null || mEndMin === null || mEndMin <= mStartMin) {
    timingError = "L'heure de sortie du matin doit être postérieure à l'heure d'entrée.";
  } else if (aStartMin === null || aEndMin === null || aEndMin <= aStartMin) {
    timingError = "L'heure de sortie de l'après-midi doit être postérieure à l'heure d'entrée.";
  } else if (aStartMin < mEndMin) {
    timingError = "L'après-midi ne peut pas commencer avant la fin de la matinée.";
  }

  const handleGenerate = async () => {
    if (!defaultSubjectId || !defaultTrainerId || timingError) return;
    setBusy(true);
    setFeedback(null);
    try {
      const count = await generateStandardWeekSlots(
        actor,
        currentFormation.id,
        defaultSubjectId,
        defaultTrainerId,
        {
          formationTitle: currentFormation.title,
          validFrom,
          room: room.trim(),
          morningStart,
          morningEnd,
          afternoonStart,
          afternoonEnd,
        },
      );
      announce(
        `Grille hebdomadaire générée avec succès : ${count} créneaux créés (${formatHours(weeklyMinutes / 60)} par semaine).`,
      );
      setFeedback(`Succès : ${count} créneaux créés (${formatHours(weeklyMinutes / 60)} / semaine).`);
      await onSuccess();
      setTimeout(onClose, 1200);
    } catch {
      announce("La génération de la grille a échoué.", "assertive");
      setFeedback("Erreur lors de la génération.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="generate-modal-title" className="text-lg font-bold text-on-surface">
                Générer la Grille Hebdomadaire
              </h2>
              <p className="text-xs text-on-surface-variant">
                Formation : <span className="font-semibold text-primary">{currentFormation.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors ${focusRing}`}
            aria-label="Fermer la fenêtre de génération"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-on-surface">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Génère en 1 clic les <strong>10 demi-journées</strong> du Lundi au Vendredi pour cette formation,
            avec les <strong>heures d&apos;entrée et de sortie personnalisées</strong> de votre choix.
          </p>

          {feedback && (
            <Alert tone={feedback.startsWith("Succès") ? "success" : "error"}>
              {feedback}
            </Alert>
          )}

          {timingError && <Alert tone="error">{timingError}</Alert>}

          {/* Section personnalisation des horaires d'entrée et de sortie */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Horaires d&apos;entrée et de sortie de la filière</span>
              </span>
              <span className="text-xs font-bold text-primary rounded-md bg-surface-container px-2 py-0.5">
                {formatHours(dailyMinutes / 60)} / jour ({formatHours(weeklyMinutes / 60)} / semaine)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Matin */}
              <div className="space-y-1.5 rounded-lg border border-border-subtle bg-surface-container-lowest p-2.5">
                <span className="text-xs font-bold text-on-surface">Matinée :</span>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Entrée matin"
                    type="time"
                    value={morningStart}
                    onChange={(e) => setMorningStart(e.target.value)}
                  />
                  <TextField
                    label="Sortie matin"
                    type="time"
                    value={morningEnd}
                    onChange={(e) => setMorningEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Après-midi */}
              <div className="space-y-1.5 rounded-lg border border-border-subtle bg-surface-container-lowest p-2.5">
                <span className="text-xs font-bold text-on-surface">Après-midi :</span>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Entrée après-midi"
                    type="time"
                    value={afternoonStart}
                    onChange={(e) => setAfternoonStart(e.target.value)}
                  />
                  <TextField
                    label="Sortie après-midi"
                    type="time"
                    value={afternoonEnd}
                    onChange={(e) => setAfternoonEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-on-surface-variant">
              Adaptez librement les heures selon le rythme propre à cette promotion (ex: 08:30–12:00 et 13:00–16:30, ou 09:00–12:30 et 13:30–17:00).
            </p>
          </div>

          <div className="space-y-3">
            <SelectField
              label="Matière initiale"
              value={defaultSubjectId}
              onChange={(e) => setDefaultSubjectId(e.target.value)}
              hint="Matière affectée par défaut aux créneaux générés (modifiable individuellement par la suite)."
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Formateur référent initial"
              value={defaultTrainerId}
              onChange={(e) => setDefaultTrainerId(e.target.value)}
              hint="Formateur affecté par défaut aux créneaux générés (modifiable individuellement par la suite)."
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </SelectField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Salle habituelle"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                hint="Facultatif (ex: Salle 501, Atelier braille...)."
              />
              <TextField
                label="Valable à partir du"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                hint="Prise d'effet de l'emploi du temps."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={busy || !defaultSubjectId || !defaultTrainerId || Boolean(timingError)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>
              {busy
                ? "Génération…"
                : `Générer les 10 créneaux (${formatHours(weeklyMinutes / 60)}/sem.)`}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
