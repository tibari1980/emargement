"use client";

import { useState } from "react";
import { focusRing } from "@/components/ui/Button";
import { nowTime, timeToMinutes, todayIso } from "@/lib/core/dates";
import {
  ATTENDANCE_STATUS_LABELS,
  type Attendance,
  type AttendanceStatus,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";

const TRAINER_STATUSES: AttendanceStatus[] = ["present", "absent", "late"];

export type RowState = "idle" | "saving" | "saved" | "error";

/** One trainee: status radio group (arrow keys) and, when late, the arrival time. */
export function TraineeRow({
  trainee,
  slot,
  date,
  record,
  state,
  onSave,
}: {
  trainee: UserProfile;
  slot: TimetableSlot;
  date: string;
  record: Attendance | undefined;
  state: RowState;
  onSave: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null) => Promise<unknown>;
}) {
  const [time, setTime] = useState(record?.arrivalTime ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  // Keep the field in sync when the saved arrival time changes.
  const [savedArrival, setSavedArrival] = useState(record?.arrivalTime);
  if (record?.arrivalTime !== savedArrival) {
    setSavedArrival(record?.arrivalTime);
    setTime(record?.arrivalTime ?? "");
  }

  const defaultArrival = () => {
    const now = nowTime();
    // During the session, "now" is the most likely arrival time.
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
    if (minutes === null) return setTimeError("Heure invalide. Format attendu : 09:45.");
    if (minutes <= start || minutes >= end) {
      return setTimeError(`L'heure d'arrivée doit être comprise entre ${slot.startTime} et ${slot.endTime}.`);
    }
    setTimeError(null);
    void onSave(trainee, "late", time);
  };

  const status = record?.status;

  return (
    <tr className="border-t-2 border-gray-200 align-top">
      <th scope="row" className="p-3 text-lg font-semibold">
        {trainee.fullName}
      </th>
      <td className="p-3">
        <fieldset>
          <legend className="sr-only">Statut de {trainee.fullName}</legend>
          <div className="flex flex-wrap gap-2">
            {TRAINER_STATUSES.map((s) => (
              <label
                key={s}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 border-gray-700 px-3 py-2 font-semibold has-[:checked]:border-blue-900 has-[:checked]:bg-blue-900 has-[:checked]:text-white has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-amber-400"
              >
                <input
                  type="radio"
                  name={`statut-${trainee.id}`}
                  value={s}
                  checked={status === s}
                  onChange={() => choose(s)}
                  className="h-5 w-5 accent-white focus-visible:outline-none"
                />
                {ATTENDANCE_STATUS_LABELS[s]}
              </label>
            ))}
          </div>
          {status === "excused" && (
            <p className="mt-2 text-sm font-semibold text-gray-800">
              Absence justifiée par le secrétariat{record?.excuseReason ? ` : ${record.excuseReason}` : ""}.
            </p>
          )}
        </fieldset>
      </td>
      <td className="p-3">
        {status === "late" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`arrivee-${trainee.id}`} className="sr-only">
              Heure d&apos;arrivée de {trainee.fullName}
            </label>
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
              aria-describedby={timeError ? `arrivee-err-${trainee.id}` : undefined}
              className={`min-h-11 rounded-md border-2 border-gray-700 px-3 py-2 ${focusRing}`}
            />
            {timeError && (
              <p id={`arrivee-err-${trainee.id}`} role="alert" className="text-sm font-semibold text-red-800">
                {timeError}
              </p>
            )}
          </div>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="p-3">
        <RowStatus state={state} hasRecord={Boolean(record)} />
      </td>
    </tr>
  );
}

function RowStatus({ state, hasRecord }: { state: RowState; hasRecord: boolean }) {
  if (state === "saving") return <span>Enregistrement…</span>;
  if (state === "error") return <span className="font-semibold text-red-800">Échec, réessayez</span>;
  if (hasRecord) return <span className="font-semibold text-green-800">Enregistré</span>;
  return <span className="text-gray-700">Non saisi</span>;
}
