"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck,
  Loader2,
  XCircle,
} from "lucide-react";
import { focusRing } from "@/components/ui/Button";
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
  onSave: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null) => Promise<unknown>;
  readOnly?: boolean;
}) {
  const [time, setTime] = useState(record?.arrivalTime ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [savedArrival, setSavedArrival] = useState(record?.arrivalTime);

  if (record?.arrivalTime !== savedArrival) {
    setSavedArrival(record?.arrivalTime);
    setTime(record?.arrivalTime ?? "");
  }

  const defaultArrival = () => {
    const now = nowTime();
    return date === todayIso() && now > slot.startTime && now < slot.endTime ? now : slot.startTime;
  };

  const choose = (status: AttendanceStatus) => {
    setTimeError(null);
    if (status === "late") {
      const arrival = record?.arrivalTime ?? defaultArrival();
      setTime(arrival);
      void onSave(trainee, "late", arrival);
    } else {
      void onSave(trainee, status, null);
    }
  };

  const commitTime = () => {
    if (record?.status !== "late" || time === record.arrivalTime) return;
    const minutes = timeToMinutes(time);
    const start = timeToMinutes(slot.startTime) ?? 0;
    const end = timeToMinutes(slot.endTime) ?? 24 * 60;
    if (minutes === null) return setTimeError("Heure invalide. Format : 09:45.");
    if (minutes <= start || minutes >= end) {
      return setTimeError(`L'heure doit être entre ${slot.startTime} et ${slot.endTime}.`);
    }
    setTimeError(null);
    void onSave(trainee, "late", time);
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
              disabled={readOnly}
              aria-pressed={status === "late"}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${focusRing} ${
                readOnly ? "cursor-not-allowed opacity-75" : ""
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
              disabled={readOnly}
              aria-pressed={status === "absent"}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${focusRing} ${
                readOnly ? "cursor-not-allowed opacity-75" : ""
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
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-status-excused-bg text-status-excused border-2 border-status-excused-border px-3 py-2 text-sm font-bold shadow-xs">
                <FileCheck className="h-4 w-4 text-status-excused" aria-hidden="true" />
                <span>Excusé{record?.excuseReason ? ` : ${record.excuseReason}` : ""}</span>
              </span>
            )}
          </div>
        </fieldset>
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
                  className={`min-h-10 rounded-xl border-2 border-status-late bg-status-late-bg/50 px-2.5 py-1 text-sm font-mono font-bold text-status-late shadow-xs ${focusRing}`}
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

      {/* 4. Enregistrement & Horodatage */}
      <td className="p-3 sm:p-4 text-right whitespace-nowrap">
        <RowStatus state={state} hasRecord={Boolean(record)} />
      </td>
    </tr>
  );
}

function RowStatus({ state, hasRecord }: { state: RowState; hasRecord: boolean }) {
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
  onSave: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null) => Promise<unknown>;
  readOnly?: boolean;
}) {
  const [time, setTime] = useState(record?.arrivalTime ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [savedArrival, setSavedArrival] = useState(record?.arrivalTime);

  if (record?.arrivalTime !== savedArrival) {
    setSavedArrival(record?.arrivalTime);
    setTime(record?.arrivalTime ?? "");
  }

  const defaultArrival = () => {
    const now = nowTime();
    return date === todayIso() && now > slot.startTime && now < slot.endTime ? now : slot.startTime;
  };

  const choose = (status: AttendanceStatus) => {
    setTimeError(null);
    if (status === "late") {
      const arrival = record?.arrivalTime ?? defaultArrival();
      setTime(arrival);
      void onSave(trainee, "late", arrival);
    } else {
      void onSave(trainee, status, null);
    }
  };

  const commitTime = () => {
    if (record?.status !== "late" || time === record.arrivalTime) return;
    const minutes = timeToMinutes(time);
    const start = timeToMinutes(slot.startTime) ?? 0;
    const end = timeToMinutes(slot.endTime) ?? 24 * 60;
    if (minutes === null) return setTimeError("Format : 09:45");
    if (minutes <= start || minutes >= end) {
      return setTimeError(`Entre ${slot.startTime} et ${slot.endTime}`);
    }
    setTimeError(null);
    void onSave(trainee, "late", time);
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
          <RowStatus state={state} hasRecord={Boolean(record)} />
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
            disabled={readOnly}
            aria-pressed={status === "late"}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-bold transition-all ${focusRing} ${
              readOnly ? "cursor-not-allowed opacity-75" : ""
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
            disabled={readOnly}
            aria-pressed={status === "absent"}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-bold transition-all ${focusRing} ${
              readOnly ? "cursor-not-allowed opacity-75" : ""
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
              onChange={(e) => setTime(e.target.value)}
              onBlur={commitTime}
              className={`min-h-10 rounded-lg border-2 border-status-late bg-surface-container-lowest px-2 py-1 text-sm font-mono font-bold text-status-late shadow-xs ${focusRing}`}
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
    </article>
  );
}
