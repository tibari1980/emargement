"use client";

import { useState } from "react";
import { CalendarRange, CheckCircle2, Info, Sparkles, X } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { currentMonth, formatShortDate, isValidIsoDate, monthBounds, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { applyWeekValidityPeriod } from "@/lib/data/timetable";
import type { Formation, TimetableSlot } from "@/lib/domain/types";

interface ApplyMonthModalProps {
  actor: Actor;
  currentFormation: Formation;
  slots: TimetableSlot[];
  onSuccess: () => Promise<void>;
  onClose: () => void;
}

export function ApplyMonthModal({
  actor,
  currentFormation,
  slots,
  onSuccess,
  onClose,
}: ApplyMonthModalProps) {
  const announce = useAnnounce();
  const curMonth = currentMonth();
  const bounds = monthBounds(curMonth);

  // Par défaut, début au 1er du mois en cours
  const [validFrom, setValidFrom] = useState(bounds.start);
  const [openEnded, setOpenEnded] = useState(true);
  const [validTo, setValidTo] = useState(bounds.end);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApply = async () => {
    if (!isValidIsoDate(validFrom)) {
      setFeedback("Date de début invalide.");
      return;
    }
    if (!openEnded && validTo && (!isValidIsoDate(validTo) || validTo < validFrom)) {
      setFeedback("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const finalValidTo = openEnded ? null : validTo;
      const count = await applyWeekValidityPeriod(
        actor,
        currentFormation.id,
        validFrom,
        finalValidTo,
        { formationTitle: currentFormation.title },
      );
      announce(
        `Période appliquée avec succès : ${count} créneau(x) configuré(s) du ${formatShortDate(validFrom)}${
          finalValidTo ? ` au ${formatShortDate(finalValidTo)}` : " (permanent)"
        }.`,
      );
      setFeedback(`Succès : ${count} créneaux mis à jour.`);
      await onSuccess();
      setTimeout(onClose, 1200);
    } catch {
      announce("L'application de la période a échoué.", "assertive");
      setFeedback("Erreur lors de l'application de la période.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-month-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"
              aria-hidden="true"
            >
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <h2 id="apply-month-title" className="text-lg font-bold text-on-surface">
                Appliquer au Mois en Cours
              </h2>
              <p className="text-xs text-on-surface-variant">
                Formation : <span className="font-semibold text-primary">{currentFormation.title}</span> ({slots.length} créneaux)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors ${focusRing}`}
            aria-label="Fermer la fenêtre d'application de la période"
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

          {/* Règle pédagogique essentielle pour l'utilisateur */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex gap-3 text-xs leading-relaxed text-on-surface">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="font-bold text-primary">
                Fonctionnement de l&apos;emploi du temps (Semaine type récurrente) :
              </p>
              <p>
                Vous n&apos;avez <strong>pas besoin de copier-coller la semaine</strong> pour chaque semaine du mois :
                dans notre système, votre semaine type se répète <strong>déjà automatiquement</strong> d&apos;une semaine à l&apos;autre.
              </p>
              <p>
                Cette action ajuste la <strong>date d&apos;effet</strong> de l&apos;ensemble de vos {slots.length} créneaux au <strong>1er du mois ({formatShortDate(bounds.start)})</strong>,
                ce qui permet à l&apos;émargement et aux calculs ASP de couvrir l&apos;intégralité du mois en cours, y compris les jours passés.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <TextField
              label="Date d'effet (début de validité)"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              hint="Par défaut le 1er jour du mois en cours pour couvrir tout le mois."
            />

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={openEnded}
                  onChange={(e) => setOpenEnded(e.target.checked)}
                  className="rounded border-border-subtle text-primary focus:ring-primary"
                />
                <span>Sans date de fin (semaine permanente pour tous les mois suivants)</span>
              </label>

              {!openEnded && (
                <TextField
                  label="Date de fin de validité"
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  hint="Dernier jour où ces créneaux seront actifs."
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={busy || slots.length === 0}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? "Application en cours…" : "Appliquer à tout le mois"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
