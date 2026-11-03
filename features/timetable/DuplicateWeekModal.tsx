"use client";

import { useState } from "react";
import { Copy, Calendar, Layers, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { cloneWeekForPeriod, duplicateWeekToFormation } from "@/lib/data/timetable";
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
  const [tab, setTab] = useState<"formation" | "month">("month");

  // Mode 1: Formation cible
  const otherFormations = allFormations.filter((f) => f.id !== currentFormation.id && f.active !== false);
  const [targetFormationId, setTargetFormationId] = useState(otherFormations[0]?.id || "");

  // Mode 2: Mois / Plage de dates
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const [validFrom, setValidFrom] = useState(`${currentYear}-${currentMonth}-01`);
  // Last day of current month
  const lastDay = new Date(currentYear, Number(currentMonth), 0).getDate();
  const [validTo, setValidTo] = useState(`${currentYear}-${currentMonth}-${String(lastDay).padStart(2, "0")}`);

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

  const handleCloneForPeriod = async () => {
    if (!validFrom || !validTo || validTo < validFrom) return;
    setBusy(true);
    setFeedback(null);
    try {
      const count = await cloneWeekForPeriod(actor, slots, validFrom, validTo, {
        formationTitle: currentFormation.title,
      });
      announce(`Semaine dupliquée pour la période du ${validFrom} au ${validTo} (${count} créneaux générés).`);
      setFeedback(`Succès : ${count} créneaux créés du ${validFrom} au ${validTo}.`);
      await onSuccess();
      setTimeout(onClose, 1200);
    } catch {
      announce("Le clonage sur la période a échoué.", "assertive");
      setFeedback("Erreur lors du clonage pour le mois.");
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
        className="w-full max-w-xl rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-white" aria-hidden="true">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2 id="duplicate-modal-title" className="text-lg font-bold text-on-surface">
                Dupliquer l&apos;Emploi du Temps
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

        {/* Tab Switcher */}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => setTab("month")}
            className={`flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition-all border ${
              tab === "month"
                ? "border-primary bg-primary text-on-primary shadow-xs"
                : "border-border-subtle bg-surface-container-high text-on-surface hover:bg-surface-variant"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>Cloner sur un mois / dates</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("formation")}
            className={`flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition-all border ${
              tab === "formation"
                ? "border-primary bg-primary text-on-primary shadow-xs"
                : "border-border-subtle bg-surface-container-high text-on-surface hover:bg-surface-variant"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Layers className="h-4 w-4" aria-hidden="true" />
              <span>Copier vers une autre promotion</span>
            </span>
          </button>
        </div>

        <div className="py-5 space-y-4 text-sm text-on-surface">
          {feedback && (
            <Alert tone={feedback.startsWith("Succès") ? "success" : "error"}>
              {feedback}
            </Alert>
          )}

          {tab === "month" ? (
            <div className="space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Applique l&apos;ensemble des {slots.length} créneaux de cette semaine type sur un mois ou une période définie.
                Idéal pour les modules spécifiques ou pour reconduire un planning d&apos;un mois sur l&apos;autre.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  label="Date de début du mois / période"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
                <TextField
                  label="Date de fin du mois / période"
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                />
              </div>

              {/* Raccourcis mois rapide */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-on-surface-variant">Sélection rapide :</span>
                {[
                  { label: "Mois en cours", from: `${currentYear}-${currentMonth}-01`, to: `${currentYear}-${currentMonth}-${String(lastDay).padStart(2, "0")}` },
                  {
                    label: "Mois prochain",
                    from: `${Number(currentMonth) === 12 ? currentYear + 1 : currentYear}-${String((Number(currentMonth) % 12) + 1).padStart(2, "0")}-01`,
                    to: `${Number(currentMonth) === 12 ? currentYear + 1 : currentYear}-${String((Number(currentMonth) % 12) + 1).padStart(2, "0")}-${new Date(currentYear, Number(currentMonth) + 1, 0).getDate()}`,
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setValidFrom(preset.from);
                      setValidTo(preset.to);
                    }}
                    className="text-xs rounded-lg border border-border-subtle bg-surface-container px-2.5 py-1 text-primary hover:bg-surface-variant transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Copie l&apos;intégralité des {slots.length} créneaux hebdomadaires de « {currentFormation.title} » vers une autre formation.
                Vous pourrez ensuite ajuster les matières et formateurs individuellement.
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
                <Alert tone="info">Aucune autre formation active disponible.</Alert>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          {tab === "month" ? (
            <Button
              variant="primary"
              onClick={handleCloneForPeriod}
              disabled={busy || !validFrom || !validTo || validTo < validFrom || slots.length === 0}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? "Duplication…" : `Cloner les ${slots.length} créneaux sur le mois`}</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleDuplicateToFormation}
              disabled={busy || !targetFormationId || slots.length === 0}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? "Copie en cours…" : `Copier vers cette formation`}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
