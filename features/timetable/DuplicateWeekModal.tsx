"use client";

import { useState } from "react";
import { ArrowRight, Copy, Info, Layers, X } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import { duplicateWeekToFormation } from "@/lib/data/timetable";
import type { Formation, TimetableSlot } from "@/lib/domain/types";

interface DuplicateWeekModalProps {
  actor: Actor;
  currentFormation: Formation;
  slots: TimetableSlot[];
  allFormations: Formation[];
  onSuccess: () => Promise<void>;
  onClose: () => void;
}

export function DuplicateWeekModal({
  actor,
  currentFormation,
  slots,
  allFormations,
  onSuccess,
  onClose,
}: DuplicateWeekModalProps) {
  const announce = useAnnounce();
  // Autres formations actives uniquement (interdit de dupliquer vers la formation source pour éviter les doublons)
  const otherFormations = allFormations.filter((f) => f.id !== currentFormation.id && f.active !== false);
  const [targetFormationId, setTargetFormationId] = useState(otherFormations[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const targetFormation = allFormations.find((f) => f.id === targetFormationId);

  const handleDuplicateToFormation = async () => {
    if (!targetFormationId || !targetFormation) return;
    setBusy(true);
    setFeedback(null);
    try {
      const count = await duplicateWeekToFormation(actor, slots, targetFormationId, {
        targetFormationTitle: targetFormation.title,
      });
      announce(`Semaine type dupliquée avec succès : ${count} créneaux copiés vers ${targetFormation.title}.`);
      setFeedback(`Succès : ${count} créneaux copiés vers « ${targetFormation.title} ».`);
      await onSuccess();
      setTimeout(onClose, 1200);
    } catch {
      announce("La duplication vers la formation a échoué.", "assertive");
      setFeedback("Erreur lors de la duplication.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-white" aria-hidden="true">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2 id="duplicate-modal-title" className="text-lg font-bold text-on-surface">
                Dupliquer la Semaine Type
              </h2>
              <p className="text-xs text-on-surface-variant">
                Source : <span className="font-semibold text-primary">{currentFormation.title}</span> ({slots.length} créneaux)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors ${focusRing}`}
            aria-label="Fermer la fenêtre de duplication"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="py-5 space-y-4 text-sm text-on-surface">
          {feedback && (
            <Alert tone={feedback.startsWith("Succès") ? "success" : "error"}>
              {feedback}
            </Alert>
          )}

          {/* Note explicative indispensable */}
          <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-3.5 flex gap-3 text-xs leading-relaxed text-on-surface">
            <Info className="h-4 w-4 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Fonctionnement récurrent :</strong> L&apos;emploi du temps est déjà une semaine type permanente.
              Une fois configurée, elle s&apos;applique <strong>automatiquement à toutes les semaines du mois et de l&apos;année</strong> sans que vous ayez besoin de la dupliquer mois par mois.
            </p>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Cette fonction vous permet de copier l&apos;intégralité des {slots.length} créneaux de cette semaine vers <strong>une autre promotion</strong> (ex: copier de 1ère année vers 2ème année).
          </p>

          {otherFormations.length > 0 ? (
            <SelectField
              label="Formation de destination"
              value={targetFormationId}
              onChange={(e) => setTargetFormationId(e.target.value)}
            >
              {otherFormations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </SelectField>
          ) : (
            <Alert tone="info">Aucune autre formation active disponible pour la duplication.</Alert>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleDuplicateToFormation}
            disabled={busy || !targetFormationId || slots.length === 0}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? "Copie en cours…" : `Copier vers cette formation`}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
