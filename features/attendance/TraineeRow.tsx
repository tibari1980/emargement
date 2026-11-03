"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck,
  Loader2,
  XCircle,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Button, focusRing } from "@/components/ui/Button";
import { nowTime, timeToMinutes, todayIso } from "@/lib/core/dates";
import {
  ATTENDANCE_STATUS_LABELS,
  type Attendance,
  type AttendanceStatus,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";

const ADAPTED_EQUIPMENTS = [
  "NVDA + Clavier Gros Caractères",
  "Plage Braille Focus 40",
  "ZoomText 400% + Fond Sombre",
  "Synthèse vocale JAWS",
  "Écran braille Esys 24",
  "Agrandisseur vidéo HD",
];

function getEquipmentForTrainee(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ADAPTED_EQUIPMENTS[hash % ADAPTED_EQUIPMENTS.length];
}

export type RowState = "idle" | "saving" | "saved" | "error";

/**
 * Boîte de dialogue accessible de confirmation pour annuler une absence justifiée
 * lors d'une présence physique exceptionnelle en cours.
 */
function ExcusedOverrideDialog({
  open,
  onOpenChange,
  traineeName,
  slotTime,
  excuseReason,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traineeName: string;
  slotTime: string;
  excuseReason?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[121] max-h-[90dvh] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-5 sm:p-6 text-on-surface shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-150"
          aria-describedby="excused-override-description"
        >
          <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-excused-bg text-status-excused border-2 border-status-excused-border shadow-xs">
              <FileCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-lg sm:text-xl font-bold text-primary">
                Confirmer la présence physique ?
              </Dialog.Title>
              <p className="text-xs font-semibold text-secondary mt-0.5 truncate">
                {traineeName} &middot; Séance de {slotTime}
              </p>
            </div>
          </div>

          <div id="excused-override-description" className="mt-4 space-y-3 text-sm text-on-surface">
            <div className="rounded-xl border border-status-excused-border/50 bg-status-excused-bg/40 p-3 text-xs sm:text-sm text-status-excused font-semibold">
              <span className="block text-[11px] uppercase tracking-wider text-secondary font-bold">
                Justificatif administratif existant :
              </span>
              <span className="mt-0.5 block font-bold">
                {excuseReason || "Absence justifiée enregistrée par le secrétariat"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Ce stagiaire est officiellement dispensé de cette séance. Si vous confirmez sa présence physique en
              classe, le justificatif administratif sera annulé pour cette séance et les heures seront certifiées comme{" "}
              <strong className="text-primary font-bold">présence effective</strong>.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Annuler (garder excusé)
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
              className="w-full sm:w-auto text-xs sm:text-sm bg-status-present text-white hover:opacity-95"
            >
              Confirmer la présence physique
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Boîte de dialogue accessible de saisie et consultation d'une observation pédagogique
 * laissée par le formateur pour une séance donnée.
 */
function TraineeNoteDialog({
  open,
  onOpenChange,
  traineeName,
  slotTitle,
  slotTime,
  initialNote,
  readOnly = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traineeName: string;
  slotTitle: string;
  slotTime: string;
  initialNote?: string | null;
  readOnly?: boolean;
  onSave: (note: string | null) => Promise<unknown> | void;
}) {
  const announce = useAnnounce();
  const [text, setText] = useState(initialNote ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setText(initialNote ?? "");
    }
  }, [open, initialNote]);

  const handleSave = async () => {
    if (readOnly || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const trimmed = text.trim();
      await onSave(trimmed ? trimmed : null);
      if (trimmed) {
        announce(`Observation enregistrée pour ${traineeName}.`);
      } else {
        announce(`Observation supprimée pour ${traineeName}.`);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (readOnly || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave(null);
      setText("");
      announce(`Observation supprimée pour ${traineeName}.`);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[121] max-h-[90dvh] w-[min(94vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-5 sm:p-6 text-on-surface shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-150"
          aria-describedby={`trainee-note-desc-${traineeName}`}
        >
          <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
              <MessageSquare className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-lg sm:text-xl font-bold text-primary">
                Observation pédagogique
              </Dialog.Title>
              <p className="text-xs font-semibold text-secondary mt-0.5 truncate">
                {traineeName} &middot; {slotTitle} ({slotTime})
              </p>
            </div>
          </div>

          <div id={`trainee-note-desc-${traineeName}`} className="mt-4 space-y-3 text-sm text-on-surface">
            <p className="text-xs text-on-surface-variant">
              Cette observation est confidentielle et strictement réservée à l&apos;équipe pédagogique (formateurs, responsable pédagogique et direction).
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`note-text-${traineeName}`} className="text-xs font-bold text-primary flex items-center justify-between">
                <span>Remarque ou observation pour cette séance :</span>
                <span className="text-[11px] font-normal text-on-surface-variant font-mono">
                  {text.length} / 600 caractères
                </span>
              </label>
              <textarea
                id={`note-text-${traineeName}`}
                rows={4}
                maxLength={600}
                value={text}
                disabled={readOnly}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
                placeholder={
                  readOnly
                    ? "Aucune observation enregistrée pour cette séance."
                    : "Ex. : Difficulté constatée sur la synthèse vocale JAWS, départ anticipé convenu à 11h30 pour rendez-vous médical, excellente progression sur le maniement du bloc-notes braille…"
                }
                className={`w-full rounded-xl border border-secondary/40 bg-surface-container-low p-3 text-sm text-primary placeholder:text-outline focus:outline-none focus:ring-4 focus:ring-focus-outer ${
                  readOnly ? "cursor-not-allowed opacity-75" : ""
                }`}
              />
              <span className="text-[11px] text-on-surface-variant">
                Raccourci : <strong>Ctrl + Entrée</strong> pour enregistrer directement.
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-border-subtle pt-4">
            <div>
              {initialNote && !readOnly && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-status-absent hover:bg-status-absent/10 transition-colors cursor-pointer ${focusRing}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Supprimer la note</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {readOnly ? "Fermer" : "Annuler"}
              </Button>
              {!readOnly && (
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enregistrement…" : "Enregistrer l'observation"}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TraineeRow({
  trainee,
  slot,
  date,
  record,
  state,
  onSave,
  readOnly = false,
}: {
  trainee: UserProfile;
  slot: TimetableSlot;
  date: string;
  record: Attendance | undefined;
  state: RowState;
  onSave: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null, note?: string | null) => Promise<unknown>;
  readOnly?: boolean;
}) {
  const [time, setTime] = useState(record?.arrivalTime ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [savedArrival, setSavedArrival] = useState(record?.arrivalTime);
  const [confirmOverrideOpen, setConfirmOverrideOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  if (record?.arrivalTime !== savedArrival) {
    setSavedArrival(record?.arrivalTime);
    setTime(record?.arrivalTime ?? "");
  }

  const defaultArrival = () => {
    const now = nowTime();
    return date === todayIso() && now > slot.startTime && now < slot.endTime ? now : slot.startTime;
  };

  const choose = (status: AttendanceStatus) => {
    if (readOnly) return;
    if (record?.status === "excused") {
      if (status === "present") {
        setConfirmOverrideOpen(true);
      }
      return;
    }
    setTimeError(null);
    if (status === "late") {
      const arrival = record?.arrivalTime ?? defaultArrival();
      setTime(arrival);
      void onSave(trainee, "late", arrival, record?.note);
    } else {
      void onSave(trainee, status, null, record?.note);
    }
  };

  const handleConfirmOverride = () => {
    setTimeError(null);
    void onSave(trainee, "present", null, record?.note);
  };

  const commitTime = () => {
    if (readOnly || record?.status !== "late" || time === record.arrivalTime) return;
    const minutes = timeToMinutes(time);
    const start = timeToMinutes(slot.startTime) ?? 0;
    const end = timeToMinutes(slot.endTime) ?? 24 * 60;
    if (minutes === null) return setTimeError("Heure invalide. Format : 09:45.");
    if (minutes <= start || minutes >= end) {
      return setTimeError(`L'heure doit être entre ${slot.startTime} et ${slot.endTime}.`);
    }
    setTimeError(null);
    void onSave(trainee, "late", time, record?.note);
  };

  const handleSaveNote = (newNote: string | null) => {
    return onSave(
      trainee,
      record?.status ?? "present",
      record?.arrivalTime ?? null,
      newNote,
    );
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (readOnly || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "p") {
      e.preventDefault();
      choose("present");
    } else if (key === "r") {
      if (record?.status === "excused") return;
      e.preventDefault();
      choose("late");
    } else if (key === "a") {
      if (record?.status === "excused") return;
      e.preventDefault();
      choose("absent");
    } else if (key === "n") {
      e.preventDefault();
      setNoteDialogOpen(true);
    }
  };

  const status = record?.status;

  const initials = trainee.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const equipment = getEquipmentForTrainee(trainee.id);
  const idShort = `#${trainee.id.slice(0, 6)}`;

  // Late diff
  const arrivalMinutes = time ? timeToMinutes(time) : null;
  const startMinutes = timeToMinutes(slot.startTime);
  const lateMinutes = arrivalMinutes && startMinutes && arrivalMinutes > startMinutes ? arrivalMinutes - startMinutes : null;

  return (
    <tr
      onKeyDown={handleRowKeyDown}
      className={`border-b border-surface-container transition-colors hover:bg-surface-container-low/70 ${
        status === "present"
          ? "bg-status-present-bg/20"
          : status === "late"
            ? "bg-status-late-bg/20"
            : status === "absent"
              ? "bg-status-absent-bg/20"
              : status === "excused"
                ? "bg-status-excused-bg/20"
                : ""
      }`}
    >
      {/* 1. Stagiaire & Matériel Adapté */}
      <th scope="row" className="p-3 sm:p-4 text-left font-normal">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-fixed text-primary font-bold text-sm shadow-xs"
              aria-hidden="true"
            >
              {initials}
            </div>
            {status && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest ${
                  status === "present"
                    ? "bg-status-present"
                    : status === "late"
                      ? "bg-status-late"
                      : status === "absent"
                        ? "bg-status-absent"
                        : "bg-status-excused"
                }`}
                title={`Statut : ${ATTENDANCE_STATUS_LABELS[status]}`}
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-base text-on-surface truncate">{trainee.fullName}</span>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                {equipment}
              </span>
              <span className="text-xs text-outline font-mono">{idShort}</span>
            </div>
            {status && <span className="sr-only"> — Actuellement {ATTENDANCE_STATUS_LABELS[status]}</span>}
          </div>
        </div>
      </th>

      {/* 2. Boutons de Statut */}
      <td className="p-3 sm:p-4">
        <fieldset>
          <legend className="sr-only">Statut de présence de {trainee.fullName}</legend>
          <div
            className="flex items-center gap-1.5 flex-wrap"
            role="group"
            aria-label={`Statut de présence de ${trainee.fullName}`}
          >
            {/* Bouton Présent */}
            <button
              type="button"
              onClick={() => choose("present")}
              disabled={readOnly}
              aria-pressed={status === "present"}
              title={
                status === "excused"
                  ? "Absence justifiée par le secrétariat : cliquer pour confirmer une présence physique exceptionnelle"
                  : undefined
              }
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${focusRing} ${
                readOnly ? "cursor-not-allowed opacity-75" : ""
              } ${
                status === "present"
                  ? "bg-status-present-bg text-status-present border-2 border-status-present-border font-bold shadow-xs ring-1 ring-status-present"
                  : "bg-surface-container text-on-surface hover:bg-surface-variant border border-border-subtle"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Présent</span>
            </button>

            {/* Bouton Retard */}
            <button
              type="button"
              onClick={() => choose("late")}
              disabled={readOnly || status === "excused"}
              aria-disabled={readOnly || status === "excused"}
              aria-pressed={status === "late"}
              title={
                status === "excused"
                  ? "Verrouillé : le stagiaire bénéficie d'une absence justifiée enregistrée par le secrétariat"
                  : undefined
              }
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${focusRing} ${
                readOnly || status === "excused" ? "cursor-not-allowed opacity-50" : ""
              } ${
                status === "late"
                  ? "bg-status-late-bg text-status-late border-2 border-status-late-border font-bold shadow-xs ring-1 ring-status-late"
                  : "bg-surface-container text-on-surface hover:bg-surface-variant border border-border-subtle"
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>Retard{lateMinutes ? ` (${lateMinutes}m)` : ""}</span>
            </button>

            {/* Bouton Absent */}
            <button
              type="button"
              onClick={() => choose("absent")}
              disabled={readOnly || status === "excused"}
              aria-disabled={readOnly || status === "excused"}
              aria-pressed={status === "absent"}
              title={
                status === "excused"
                  ? "Verrouillé : le stagiaire bénéficie d'une absence justifiée enregistrée par le secrétariat"
                  : undefined
              }
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${focusRing} ${
                readOnly || status === "excused" ? "cursor-not-allowed opacity-50" : ""
              } ${
                status === "absent"
                  ? "bg-status-absent-bg text-status-absent border-2 border-status-absent-border font-bold shadow-xs ring-1 ring-status-absent"
                  : "bg-surface-container text-on-surface hover:bg-surface-variant border border-border-subtle"
              }`}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              <span>Absent</span>
            </button>

            {/* Statut Excusé (saisi par secrétariat) */}
            {status === "excused" && (
              <span
                role="status"
                aria-label={`Absence justifiée par le secrétariat : ${record?.excuseReason || "justificatif administratif"}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-status-excused-bg text-status-excused border-2 border-status-excused-border px-3 py-2 text-sm font-bold shadow-xs"
              >
                <FileCheck className="h-4 w-4 text-status-excused shrink-0" aria-hidden="true" />
                <span>Excusé{record?.excuseReason ? ` : ${record.excuseReason}` : ""}</span>
              </span>
            )}
          </div>
        </fieldset>

        <ExcusedOverrideDialog
          open={confirmOverrideOpen}
          onOpenChange={setConfirmOverrideOpen}
          traineeName={trainee.fullName}
          slotTime={`${slot.startTime} – ${slot.endTime}`}
          excuseReason={record?.excuseReason}
          onConfirm={handleConfirmOverride}
        />
      </td>

      {/* 3. Arrivée / Retard */}
      <td className="p-3 sm:p-4 whitespace-nowrap">
        {status === "late" ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor={`arrivee-${trainee.id}`} className="sr-only">
                Heure d&apos;arrivée de {trainee.fullName}
              </label>
              <div className="relative flex items-center">
                <input
                  id={`arrivee-${trainee.id}`}
                  type="time"
                  value={time}
                  disabled={readOnly}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={commitTime}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTime();
                    }
                  }}
                  aria-invalid={timeError ? true : undefined}
                  aria-errormessage={timeError ? `arrivee-err-${trainee.id}` : undefined}
                  className={`min-h-10 rounded-xl border-2 border-status-late bg-status-late-bg/50 px-2.5 py-1 text-sm font-mono font-bold text-status-late shadow-xs ${focusRing} ${
                    readOnly ? "cursor-not-allowed opacity-75" : ""
                  }`}
                />
              </div>
              {lateMinutes !== null && (
                <span className="rounded-lg bg-status-late-bg px-2 py-1 text-xs font-bold text-status-late">
                  +{lateMinutes} min
                </span>
              )}
            </div>
            {timeError && (
              <p id={`arrivee-err-${trainee.id}`} role="alert" className="text-xs font-semibold text-status-absent">
                {timeError}
              </p>
            )}
          </div>
        ) : status === "present" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-status-present-bg px-2.5 py-1 text-xs font-semibold text-status-present">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            À l&apos;heure
          </span>
        ) : (
          <span className="text-outline text-sm" aria-label="Non applicable">
            —
          </span>
        )}
      </td>

      {/* 4. Observation / Note pédagogique */}
      <td className="p-3 sm:p-4">
        {record?.note ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNoteDialogOpen(true)}
              aria-label={`Note pour ${trainee.fullName} : ${record.note}`}
              title={`Consulter ou modifier la note pour ${trainee.fullName} (Raccourci N)`}
              className={`group max-w-[220px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-200 transition-colors text-left cursor-pointer ${focusRing}`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold shrink-0">Note :</span>
              <span className="truncate italic">« {record.note} »</span>
            </button>
          </div>
        ) : (
          !readOnly ? (
            <button
              type="button"
              onClick={() => setNoteDialogOpen(true)}
              aria-label={`Ajouter une note pour ${trainee.fullName}`}
              title={`Ajouter une note pour ${trainee.fullName} (Raccourci N)`}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-container hover:bg-surface-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer ${focusRing}`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              <span>+ Note</span>
            </button>
          ) : (
            <span className="text-outline text-sm" aria-label="Aucune observation">
              —
            </span>
          )
        )}

        <TraineeNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          traineeName={trainee.fullName}
          slotTitle={slot.room ? `Salle ${slot.room}` : "Séance"}
          slotTime={`${slot.startTime} – ${slot.endTime}`}
          initialNote={record?.note}
          readOnly={readOnly}
          onSave={handleSaveNote}
        />
      </td>

      {/* 5. Enregistrement & Horodatage */}
      <td className="p-3 sm:p-4 text-right whitespace-nowrap">
        <RowStatus state={state} hasRecord={Boolean(record)} status={status} />
      </td>
    </tr>
  );
}

function RowStatus({
  state,
  hasRecord,
  status,
}: {
  state: RowState;
  hasRecord: boolean;
  status?: AttendanceStatus;
}) {
  if (state === "saving")
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Enregistrement…</span>
      </span>
    );
  if (state === "error")
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 text-xs font-bold text-status-absent">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>Échec, réessayez</span>
      </span>
    );
  if (hasRecord && status === "excused")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-status-excused">
        <FileCheck className="h-4 w-4" aria-hidden="true" />
        <span>Absence justifiée</span>
      </span>
    );
  if (hasRecord)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-status-present">
        <Check className="h-4 w-4" aria-hidden="true" />
        <span>Émargé</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-outline">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Non saisi</span>
    </span>
  );
}

/**
 * Mobile-first card view for smartphones and small tablets (< 768px).
 * Eliminates two-dimensional horizontal scrolling while keeping 100% touch accessibility.
 */
export function TraineeCard({
  trainee,
  slot,
  date,
  record,
  state,
  onSave,
  readOnly = false,
}: {
  trainee: UserProfile;
  slot: TimetableSlot;
  date: string;
  record: Attendance | undefined;
  state: RowState;
  onSave: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null, note?: string | null) => Promise<unknown>;
  readOnly?: boolean;
}) {
  const [time, setTime] = useState(record?.arrivalTime ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [savedArrival, setSavedArrival] = useState(record?.arrivalTime);
  const [confirmOverrideOpen, setConfirmOverrideOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  if (record?.arrivalTime !== savedArrival) {
    setSavedArrival(record?.arrivalTime);
    setTime(record?.arrivalTime ?? "");
  }

  const defaultArrival = () => {
    const now = nowTime();
    return date === todayIso() && now > slot.startTime && now < slot.endTime ? now : slot.startTime;
  };

  const choose = (status: AttendanceStatus) => {
    if (readOnly) return;
    if (record?.status === "excused") {
      if (status === "present") {
        setConfirmOverrideOpen(true);
      }
      return;
    }
    setTimeError(null);
    if (status === "late") {
      const arrival = record?.arrivalTime ?? defaultArrival();
      setTime(arrival);
      void onSave(trainee, "late", arrival, record?.note);
    } else {
      void onSave(trainee, status, null, record?.note);
    }
  };

  const handleConfirmOverride = () => {
    setTimeError(null);
    void onSave(trainee, "present", null, record?.note);
  };

  const commitTime = () => {
    if (readOnly || record?.status !== "late" || time === record.arrivalTime) return;
    const minutes = timeToMinutes(time);
    const start = timeToMinutes(slot.startTime) ?? 0;
    const end = timeToMinutes(slot.endTime) ?? 24 * 60;
    if (minutes === null) return setTimeError("Format : 09:45");
    if (minutes <= start || minutes >= end) {
      return setTimeError(`Entre ${slot.startTime} et ${slot.endTime}`);
    }
    setTimeError(null);
    void onSave(trainee, "late", time, record?.note);
  };

  const handleSaveNote = (newNote: string | null) => {
    return onSave(
      trainee,
      record?.status ?? "present",
      record?.arrivalTime ?? null,
      newNote,
    );
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (readOnly || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "p") {
      e.preventDefault();
      choose("present");
    } else if (key === "r") {
      if (record?.status === "excused") return;
      e.preventDefault();
      choose("late");
    } else if (key === "a") {
      if (record?.status === "excused") return;
      e.preventDefault();
      choose("absent");
    } else if (key === "n") {
      e.preventDefault();
      setNoteDialogOpen(true);
    }
  };

  const status = record?.status;

  const initials = trainee.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const equipment = getEquipmentForTrainee(trainee.id);
  const arrivalMinutes = time ? timeToMinutes(time) : null;
  const startMinutes = timeToMinutes(slot.startTime);
  const lateMinutes = arrivalMinutes && startMinutes && arrivalMinutes > startMinutes ? arrivalMinutes - startMinutes : null;

  return (
    <article
      onKeyDown={handleCardKeyDown}
      aria-label={`Émargement de ${trainee.fullName}`}
      className={`rounded-2xl border p-4 shadow-xs transition-all flex flex-col gap-3.5 ${
        status === "present"
          ? "border-status-present-border/60 bg-status-present-bg/25"
          : status === "late"
            ? "border-status-late-border/60 bg-status-late-bg/25"
            : status === "absent"
              ? "border-status-absent-border/60 bg-status-absent-bg/25"
              : status === "excused"
                ? "border-status-excused-border/60 bg-status-excused-bg/25"
                : "border-border-subtle bg-surface-container-lowest"
      }`}
    >
      {/* Header: Trainee Info & Live Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-fixed text-primary font-bold text-sm shadow-xs"
              aria-hidden="true"
            >
              {initials}
            </div>
            {status && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest ${
                  status === "present"
                    ? "bg-status-present"
                    : status === "late"
                      ? "bg-status-late"
                      : status === "absent"
                        ? "bg-status-absent"
                        : "bg-status-excused"
                }`}
                title={`Statut : ${ATTENDANCE_STATUS_LABELS[status]}`}
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-base text-primary truncate leading-tight">{trainee.fullName}</h3>
            <span className="text-xs text-on-surface-variant font-medium mt-0.5 line-clamp-1">
              {equipment}
            </span>
          </div>
        </div>

        <div className="shrink-0 pt-0.5">
          <RowStatus state={state} hasRecord={Boolean(record)} status={status} />
        </div>
      </div>

      {/* Touch Buttons: Full-width segmented controls */}
      <fieldset>
        <legend className="sr-only">Statut de présence de {trainee.fullName}</legend>
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Statut de présence de ${trainee.fullName}`}
        >
          {/* Présent */}
          <button
            type="button"
            onClick={() => choose("present")}
            disabled={readOnly}
            aria-pressed={status === "present"}
            title={
              status === "excused"
                ? "Absence justifiée par le secrétariat : toucher pour confirmer la présence physique exceptionnelle"
                : undefined
            }
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-bold transition-all ${focusRing} ${
              readOnly ? "cursor-not-allowed opacity-75" : ""
            } ${
              status === "present"
                ? "bg-status-present-bg text-status-present border-2 border-status-present shadow-xs ring-1 ring-status-present"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-border-subtle"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span>Présent</span>
          </button>

          {/* Retard */}
          <button
            type="button"
            onClick={() => choose("late")}
            disabled={readOnly || status === "excused"}
            aria-disabled={readOnly || status === "excused"}
            aria-pressed={status === "late"}
            title={
              status === "excused"
                ? "Verrouillé : le stagiaire fait l'objet d'une absence justifiée par le secrétariat"
                : undefined
            }
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-bold transition-all ${focusRing} ${
              readOnly || status === "excused" ? "cursor-not-allowed opacity-50" : ""
            } ${
              status === "late"
                ? "bg-status-late-bg text-status-late border-2 border-status-late shadow-xs ring-1 ring-status-late"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-border-subtle"
            }`}
          >
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span>Retard</span>
          </button>

          {/* Absent */}
          <button
            type="button"
            onClick={() => choose("absent")}
            disabled={readOnly || status === "excused"}
            aria-disabled={readOnly || status === "excused"}
            aria-pressed={status === "absent"}
            title={
              status === "excused"
                ? "Verrouillé : le stagiaire fait l'objet d'une absence justifiée par le secrétariat"
                : undefined
            }
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-bold transition-all ${focusRing} ${
              readOnly || status === "excused" ? "cursor-not-allowed opacity-50" : ""
            } ${
              status === "absent"
                ? "bg-status-absent-bg text-status-absent border-2 border-status-absent shadow-xs ring-1 ring-status-absent"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-border-subtle"
            }`}
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span>Absent</span>
          </button>
        </div>
      </fieldset>

      {/* Retard Detail Drawer (when status is late) */}
      {status === "late" && (
        <div className="rounded-xl border border-status-late-border/50 bg-status-late-bg/40 p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`mobile-arrivee-${trainee.id}`} className="text-xs font-bold text-status-late">
              Heure d&apos;arrivée :
            </label>
            <input
              id={`mobile-arrivee-${trainee.id}`}
              type="time"
              value={time}
              disabled={readOnly}
              onChange={(e) => setTime(e.target.value)}
              onBlur={commitTime}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTime();
                }
              }}
              className={`min-h-10 rounded-lg border-2 border-status-late bg-surface-container-lowest px-2 py-1 text-sm font-mono font-bold text-status-late shadow-xs ${focusRing} ${
                readOnly ? "cursor-not-allowed opacity-75" : ""
              }`}
            />
          </div>
          {lateMinutes !== null && (
            <span className="rounded-md bg-status-late text-white px-2 py-1 text-xs font-bold font-mono">
              +{lateMinutes} min de retard
            </span>
          )}
          {timeError && (
            <p role="alert" className="text-xs font-bold text-status-absent w-full">
              {timeError}
            </p>
          )}
        </div>
      )}

      {/* Excused reason */}
      {status === "excused" && (
        <div className="rounded-xl border border-status-excused-border/50 bg-status-excused-bg/60 p-2.5 text-xs font-bold text-status-excused flex items-center gap-2">
          <FileCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Excusé{record?.excuseReason ? ` : ${record.excuseReason}` : " (justificatif secrétariat)"}</span>
        </div>
      )}

      {/* Observation / Note pédagogique mobile */}
      {record?.note ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100 flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <span className="font-bold text-amber-900 dark:text-amber-200">Observation :</span>
              <p className="mt-0.5 italic text-on-surface line-clamp-3">« {record.note} »</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoteDialogOpen(true)}
            aria-label={`Modifier la note pour ${trainee.fullName}`}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-primary bg-surface-container hover:bg-surface-variant border border-border-subtle cursor-pointer ${focusRing}`}
          >
            Modifier
          </button>
        </div>
      ) : (
        !readOnly && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setNoteDialogOpen(true)}
              aria-label={`Ajouter une note pour ${trainee.fullName}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-secondary hover:text-primary hover:bg-surface-container transition-colors cursor-pointer ${focusRing}`}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>+ Note</span>
            </button>
          </div>
        )
      )}

      <TraineeNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        traineeName={trainee.fullName}
        slotTitle={slot.room ? `Salle ${slot.room}` : "Séance"}
        slotTime={`${slot.startTime} – ${slot.endTime}`}
        initialNote={record?.note}
        readOnly={readOnly}
        onSave={handleSaveNote}
      />

      <ExcusedOverrideDialog
        open={confirmOverrideOpen}
        onOpenChange={setConfirmOverrideOpen}
        traineeName={trainee.fullName}
        slotTime={`${slot.startTime} – ${slot.endTime}`}
        excuseReason={record?.excuseReason}
        onConfirm={handleConfirmOverride}
      />
    </article>
  );
}
