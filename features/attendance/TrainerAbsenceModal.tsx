"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Laptop,
  RotateCcw,
  Shield,
  UserCheck,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import {
  cancelSessionForTrainerAbsence,
  restoreNormalSession,
  setSessionSelfStudyTP,
  setSessionSubstituteTrainer,
} from "@/lib/data/sessionOverrides";
import {
  SESSION_CANCELLATION_LABELS,
  type SessionCancellationReason,
  type SessionOverride,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";

interface TrainerAbsenceModalProps {
  actor: Actor;
  slot: TimetableSlot;
  date: string;
  override: SessionOverride | null;
  trainers: UserProfile[];
  subjectTitle: string;
  formationTitle: string;
  primaryTrainerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function TrainerAbsenceModal({
  actor,
  slot,
  date,
  override,
  trainers,
  subjectTitle,
  formationTitle,
  primaryTrainerName,
  isOpen,
  onClose,
  onSaved,
}: TrainerAbsenceModalProps) {
  const announce = useAnnounce();
  const [tab, setTab] = useState<"substitute" | "self_study" | "cancel">(
    override?.isCancelled
      ? "cancel"
      : override?.isSelfStudyTP
        ? "self_study"
        : "substitute"
  );
  const [substituteId, setSubstituteId] = useState(override?.substituteTrainerId || "");
  const [selfStudyNote, setSelfStudyNote] = useState(
    override?.selfStudyNote || "Travaux pratiques & exercices dirigés en autonomie"
  );
  const [cancelReason, setCancelReason] = useState<SessionCancellationReason>(
    override?.cancellationReason || "trainer_absent"
  );
  const [cancelNote, setCancelNote] = useState(override?.cancellationNote || "Absence imprévue du formateur titulaire");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter available substitute trainers (exclude primary trainer)
  const availableSubstitutes = trainers.filter((t) => t.id !== slot.trainerId);

  const handleAssignSubstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substituteId) {
      setError("Veuillez sélectionner un formateur remplaçant.");
      return;
    }
    const substitute = trainers.find((t) => t.id === substituteId);
    if (!substitute) return;

    setSaving(true);
    setError(null);
    try {
      await setSessionSubstituteTrainer(
        actor,
        slot,
        date,
        substitute.id,
        substitute.fullName,
        subjectTitle
      );
      announce(`Formateur remplaçant ${substitute.fullName} assigné avec succès.`);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement du remplacement.");
      announce("Erreur lors de l'enregistrement du remplacement.", "assertive");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSelfStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setSessionSelfStudyTP(
        actor,
        slot,
        date,
        selfStudyNote.trim() || "Travaux pratiques / Travail libre encadré",
        subjectTitle
      );
      announce("Séance basculée en Travaux Pratiques supervisés. L'émargement est maintenant déverrouillé pour le secrétariat et la direction.");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la configuration des travaux pratiques.");
      announce("Erreur lors de l'enregistrement.", "assertive");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await cancelSessionForTrainerAbsence(
        actor,
        slot,
        date,
        cancelReason,
        cancelNote.trim() || SESSION_CANCELLATION_LABELS[cancelReason],
        subjectTitle
      );
      announce("La séance a été annulée. Les heures des stagiaires sont protégées.");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'annulation de la séance.");
      announce("Erreur lors de l'annulation de la séance.", "assertive");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreNormal = async () => {
    setSaving(true);
    setError(null);
    try {
      await restoreNormalSession(actor, slot, date);
      announce("Créneau normal rétabli avec le formateur titulaire.");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Erreur lors du rétablissement de la séance normale.");
      announce("Erreur lors du rétablissement.", "assertive");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="absence-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-5">
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-absent/15 text-status-absent">
              <UserX className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="absence-modal-title" className="text-xl font-bold text-primary tracking-tight">
                Gestion de l&apos;Absence du Formateur
              </h2>
              <p className="text-xs text-on-surface-variant">
                {subjectTitle} · {formationTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            aria-label="Fermer la boîte de dialogue"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Détails du créneau */}
        <div className="rounded-xl border border-border-subtle bg-surface-container p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-on-surface-variant">Formateur titulaire : </span>
            <span className="font-bold text-primary">{primaryTrainerName}</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{date}</span>
            <span>•</span>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{slot.startTime}–{slot.endTime}</span>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {override && (
          <div className="rounded-xl border border-border-subtle bg-amber-500/10 p-3 text-xs flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300">
                {override.isCancelled
                  ? `Séance actuellement annulée : ${override.cancellationNote || "Absence formateur"}`
                  : override.isSelfStudyTP
                    ? `Travaux Pratiques / Travail libre actif (supervisé par ${override.supervisorName})`
                    : `Remplacement actuellement actif par : ${override.substituteTrainerName}`}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRestoreNormal}
              disabled={saving}
              className="!text-xs !py-1 flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Rétablir titulaire
            </Button>
          </div>
        )}

        {/* 3 Onglets : Remplacement vs Travaux Pratiques vs Annulation */}
        <div className="flex flex-col sm:flex-row rounded-xl bg-surface-container p-1 border border-border-subtle gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "substitute"}
            onClick={() => setTab("substitute")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
              tab === "substitute"
                ? "bg-surface-container-lowest text-primary shadow-xs"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Option A : Remplaçant
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "self_study"}
            onClick={() => setTab("self_study")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
              tab === "self_study"
                ? "bg-surface-container-lowest text-secondary shadow-xs"
                : "text-on-surface-variant hover:text-secondary"
            }`}
          >
            <Laptop className="h-4 w-4 shrink-0" aria-hidden="true" />
            Option B : TP / Travail libre
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cancel"}
            onClick={() => setTab("cancel")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
              tab === "cancel"
                ? "bg-surface-container-lowest text-status-absent shadow-xs"
                : "text-on-surface-variant hover:text-status-absent"
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Option C : Annuler cours
          </button>
        </div>

        {/* Formulaire Option A : Remplacement par un autre formateur */}
        {tab === "substitute" && (
          <form onSubmit={handleAssignSubstitute} className="flex flex-col gap-4">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Le formateur remplaçant pourra accéder à la feuille d&apos;émargement et signer la présence sous sa propre signature numérique. Les heures des stagiaires sont 100% validées.
            </p>

            <SelectField
              label="Formateur remplaçant habilité *"
              value={substituteId}
              onChange={(e) => setSubstituteId(e.target.value)}
              required
            >
              <option value="">-- Choisir un formateur remplaçant --</option>
              {availableSubstitutes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} {t.specialty ? `(${t.specialty})` : ""}
                </option>
              ))}
            </SelectField>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !substituteId}>
                {saving ? "Enregistrement…" : "Confirmer le remplacement"}
              </Button>
            </div>
          </form>
        )}

        {/* Formulaire Option B : Travaux Pratiques / Travail Libre surveillé par le Secrétariat / Responsable */}
        {tab === "self_study" && (
          <form onSubmit={handleAssignSelfStudy} className="flex flex-col gap-4">
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-3.5 text-xs text-on-surface-variant leading-relaxed">
              <p className="font-bold text-primary flex items-center gap-1.5 mb-1">
                <Shield className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                Maintien de la Séance en Travaux Pratiques (TP) &amp; Émargement Direct :
              </p>
              Les stagiaires restent présents au centre pour travailler en autonomie sur des exercices, TP ou projets. Le <strong>secrétariat ou le responsable pédagogique ({actor.fullName})</strong> assure l&apos;émargement à la place du formateur. Leurs heures d&apos;assiduité sont <strong>100% validées comme présence effective</strong> (conforme Qualiopi et financeurs publics).
            </div>

            <TextField
              label="Intitulé des travaux pratiques ou note d'activité *"
              value={selfStudyNote}
              onChange={(e) => setSelfStudyNote(e.target.value)}
              required
              placeholder="Ex : Travaux pratiques en salle informatique adaptée / Exercices en autonomie"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Activation en cours…" : "Activer les TP & Émarger"}
              </Button>
            </div>
          </form>
        )}

        {/* Formulaire Option C : Annulation & Protection des Stagiaires */}
        {tab === "cancel" && (
          <form onSubmit={handleCancelSession} className="flex flex-col gap-4">
            <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-3.5 text-xs text-on-surface-variant leading-relaxed">
              <p className="font-bold text-primary flex items-center gap-1.5 mb-1">
                <Shield className="h-4 w-4 text-secondary" aria-hidden="true" />
                Garantie Réglementaire &amp; Protection des Stagiaires :
              </p>
              L&apos;annulation d&apos;une séance pour absence du formateur constitue une <strong>dispense administrative</strong>. Les heures ne sont <strong>pas imputées comme des absences injustifiées</strong> et le taux d&apos;assiduité des stagiaires pour France Travail et la Région reste protégé.
            </div>

            <SelectField
              label="Motif officiel de l'annulation *"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as SessionCancellationReason)}
              required
            >
              {Object.entries(SESSION_CANCELLATION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Précision / Note interne"
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Ex : Formateur titulaire en arrêt maladie ce matin"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Retour
              </Button>
              <Button type="submit" variant="danger" disabled={saving}>
                {saving ? "Annulation en cours…" : "Confirmer l'annulation du cours"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
