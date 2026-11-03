"use client";

import { useState } from "react";
import { Sparkles, X, CheckCircle2 } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { todayIso } from "@/lib/core/dates";
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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!defaultSubjectId || !defaultTrainerId) return;
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
        },
      );
      announce(`Grille standard 35h générée avec succès (${count} créneaux créés).`);
      setFeedback(`Succès : ${count} créneaux de 35h réglementaires créés.`);
      await onSuccess();
      setTimeout(onClose, 1200);
    } catch {
      announce("La génération de la grille standard a échoué.", "assertive");
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
        className="w-full max-w-lg rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400" aria-hidden="true">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="generate-modal-title" className="text-lg font-bold text-on-surface">
                Générer la Grille Standard 35h
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
            Crée automatiquement les <strong>10 demi-journées réglementaires de l&apos;ESRP</strong> (09:00–12:30 et 13:30–17:00 du Lundi au Vendredi, soit 35h hebdomadaires).
            Vous pourrez ensuite modifier chaque matière et formateur individuellement.
          </p>

          {feedback && (
            <Alert tone={feedback.startsWith("Succès") ? "success" : "error"}>
              {feedback}
            </Alert>
          )}

          <div className="space-y-3">
            <SelectField
              label="Matière initiale"
              value={defaultSubjectId}
              onChange={(e) => setDefaultSubjectId(e.target.value)}
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
                hint="Facultatif."
              />
              <TextField
                label="Valable à partir du"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
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
            disabled={busy || !defaultSubjectId || !defaultTrainerId}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? "Génération…" : "Générer les 10 créneaux (35h)"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

