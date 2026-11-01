"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Keyboard,
  Laptop,
  Layers,
  Lock,
  MapPin,
  Search,
  Shield,
  Timer,
  TrendingUp,
  User,
  UserCheck,
  Users,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField } from "@/components/ui/Field";
import {
  APP_TIME_ZONE,
  addDays,
  formatLongDate,
  formatSpokenTime,
  isValidIsoDate,
  isWeekend,
  nowTime,
  timeToMinutes,
  todayIso,
} from "@/lib/core/dates";
import { syncServerClock } from "@/lib/core/serverClock";
import { listForDate, listForSession, saveAttendances, type AttendanceEntry } from "@/lib/data/attendances";
import type { Actor } from "@/lib/data/audit";
import { deduplicateFormationsList, groupFormations } from "@/lib/data/formations";
import { subscribeSessionOverridesForDate } from "@/lib/data/sessionOverrides";
import { getInitialSlots, listSlots } from "@/lib/data/timetable";
import { getUsersByIdsSync, listStaff, listUsersByIds } from "@/lib/data/users";
import { can } from "@/lib/domain/permissions";
import {
  getSessionTemporalStatus,
  nextWorkingDay,
  previousWorkingDay,
  sessionsOn,
  weekdayOf,
} from "@/lib/domain/schedule";
import {
  ROLE_LABELS,
  SESSION_CANCELLATION_LABELS,
  type Attendance,
  type AttendanceStatus,
  type Formation,
  type SessionOverride,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { TrainerAbsenceModal } from "./TrainerAbsenceModal";
import { TraineeRow, TraineeCard, type RowState } from "./TraineeRow";

type FilterMode = "all" | "pending" | "present" | "late" | "absent";

const SPOKEN_STATUS: Record<AttendanceStatus, string> = {
  present: "marqué présent",
  absent: "marqué absent",
  late: "marqué en retard",
  excused: "en absence justifiée",
};

const STORAGE_FORMATION_KEY = "avh_emargement_formation_id";

/** Live clock component showing current time in Europe/Paris timezone */
function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("fr-FR", {
          timeZone: APP_TIME_ZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl bg-status-present-bg px-3.5 py-1.5 font-mono text-sm font-bold text-status-present shadow-xs"
      aria-label={`Heure actuelle de Paris : ${time}`}
    >
      <Timer className="h-4 w-4 shrink-0 text-status-present" aria-hidden="true" />
      <span className="tracking-widest">{time || "09:00:00"}</span>
      <span className="rounded bg-status-present/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        Heure de Paris
      </span>
    </div>
  );
}

/**
 * Session to open by default:
 * Prioritizes sessions belonging to formations with enrolled trainees (> 0),
 * then the one currently in progress, else the next one, else the first.
 */
function defaultSession(
  sessions: TimetableSlot[],
  date: string,
  formationLookup?: (id: string) => Formation | undefined,
): TimetableSlot | undefined {
  if (sessions.length === 0) return undefined;
  const populated = formationLookup
    ? sessions.filter((s) => (formationLookup(s.formationId)?.traineeIds?.length ?? 0) > 0)
    : [];
  const pool = populated.length > 0 ? populated : sessions;

  if (date !== todayIso()) return pool[0];
  const now = nowTime();
  return (
    pool.find((s) => s.startTime <= now && now < s.endTime) ??
    pool.find((s) => s.startTime > now) ??
    pool[pool.length - 1]
  );
}

export function AttendanceSheet({ profile }: { profile: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error: refError } = useReferenceData();
  const seesAll = can(profile.role, "attendance.recordAny");
  const [slots, setSlots] = useState<TimetableSlot[]>(() => getInitialSlots());
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [selectedFormationId, setSelectedFormationId] = useState<string>("ALL");
  const [showEmptyFormationsInOverview, setShowEmptyFormationsInOverview] = useState(false);
  const [choice, setChoice] = useState<{ date: string; slotId: string } | null>(null);
  const [roster, setRoster] = useState<{ key: string; trainees: UserProfile[] } | null>(null);
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [dayAttendances, setDayAttendances] = useState<Attendance[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Synchronize clock with server on mount & refresh every 15 seconds
  const [currentTime, setCurrentTime] = useState(nowTime());
  useEffect(() => {
    let lastKnownToday = todayIso();
    void syncServerClock().then(() => {
      const freshToday = todayIso();
      setCurrentTime(nowTime());
      if (freshToday !== lastKnownToday) {
        setDate((prev) => (prev === lastKnownToday ? freshToday : prev));
        lastKnownToday = freshToday;
      }
    });

    const timer = setInterval(() => {
      const freshToday = todayIso();
      setCurrentTime(nowTime());
      if (freshToday !== lastKnownToday) {
        setDate((prev) => (prev === lastKnownToday ? freshToday : prev));
        lastKnownToday = freshToday;
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, []);

  // Load persisted formation filter preference if valid
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_FORMATION_KEY);
      if (saved) setSelectedFormationId(saved);
    } catch {}
  }, []);

  const handleSelectFormation = useCallback((formationId: string) => {
    setSelectedFormationId(formationId);
    try {
      localStorage.setItem(STORAGE_FORMATION_KEY, formationId);
    } catch {}
  }, []);

  // Overrides & Substitute trainers state
  const [overrides, setOverrides] = useState<SessionOverride[]>([]);
  const [trainersList, setTrainersList] = useState<UserProfile[]>([]);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeSessionOverridesForDate(date, (list) => {
      setOverrides(list);
    });
    return () => unsub();
  }, [date]);

  useEffect(() => {
    if (can(profile.role, "trainer.manageAbsence")) {
      listStaff(["trainer"]).then(setTrainersList).catch(() => {});
    }
  }, [profile.role]);

  // Load all timetable slots so we can also resolve substitute trainer assignments and standard daily fallbacks
  useEffect(() => {
    let stale = false;
    listSlots()
      .then((loaded) => {
        if (!stale) {
          setSlots(loaded);
          setError(null);
        }
      })
      .catch((err) => {
        console.warn("AttendanceSheet: listSlots failed", err);
        if (!stale) {
          setSlots([]);
        }
      });
    return () => {
      stale = true;
    };
  }, [profile.id]);

  // Deduplicated active formations list
  const activeFormations = useMemo(() => {
    if (!data) return [];
    return deduplicateFormationsList(data.formations);
  }, [data]);

  // Default trainer fallback when a formation uses standard daily schedule (09:00-17:00)
  const defaultTrainerId = useMemo(() => {
    if (profile.role === "trainer") return profile.id;
    const firstTrainer = data?.staff.find((s) => s.role === "trainer" && s.active !== false);
    return firstTrainer?.id ?? profile.id;
  }, [data, profile.id, profile.role]);

  // Compute all sessions for the selected date (custom TimetableSlots + standard 09:00-17:00 fallback per active formation)
  const allDaySessions = useMemo(() => {
    if (!slots || !lookups || !isValidIsoDate(date)) return [];
    if (isWeekend(date) || lookups.closedDays.has(date)) return [];

    const activeCustomSlots = slots.filter((s) => lookups.formation(s.formationId)?.active !== false);
    const configuredOnDate = sessionsOn(activeCustomSlots, date, lookups.closedDays);

    const formationsWithCustomSlots = new Set(configuredOnDate.map((s) => s.formationId));
    const weekday = weekdayOf(date);
    if (!weekday) return [];

    // Synthesize standard 09:00-17:00 daily session for active formations without custom slots on this weekday
    // (Matches hoursCalculator.ts and JustificationManager.tsx 100%)
    const synthesized: TimetableSlot[] = [];
    for (const f of activeFormations) {
      if (!formationsWithCustomSlots.has(f.id)) {
        synthesized.push({
          id: `default_slot_${weekday}_${f.id}`,
          formationId: f.id,
          subjectId: "default_subject",
          trainerId: defaultTrainerId,
          weekday,
          startTime: "09:00",
          endTime: "17:00",
          room: "Plateau Pédagogique",
          validFrom: "1970-01-01",
          validTo: null,
        });
      }
    }

    const combined = [...configuredOnDate, ...synthesized];

    // Filter for trainer role: trainers see sessions where they are the titular trainer OR the assigned substitute trainer
    if (!seesAll) {
      return combined.filter((s) => {
        const ov = overrides.find((o) => o.slotId === s.id && o.date === date);
        const effectiveTrainer = ov?.substituteTrainerId || s.trainerId;
        return effectiveTrainer === profile.id || s.trainerId === profile.id;
      });
    }

    // Sort: formations with enrolled trainees first, then by startTime, then by formation title
    return combined.sort((a, b) => {
      const aTrainees = lookups.formation(a.formationId)?.traineeIds?.length ?? 0;
      const bTrainees = lookups.formation(b.formationId)?.traineeIds?.length ?? 0;
      if ((bTrainees > 0 ? 1 : 0) !== (aTrainees > 0 ? 1 : 0)) {
        return (bTrainees > 0 ? 1 : 0) - (aTrainees > 0 ? 1 : 0);
      }
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return lookups.formationTitle(a.formationId).localeCompare(lookups.formationTitle(b.formationId), "fr");
    });
  }, [slots, lookups, date, activeFormations, defaultTrainerId, seesAll, overrides, profile.id]);

  // Available formations for the current user
  const availableFormations = useMemo(() => {
    if (seesAll) return activeFormations;
    const allowedIds = new Set(allDaySessions.map((s) => s.formationId));
    const filtered = activeFormations.filter((f) => allowedIds.has(f.id));
    return filtered.length > 0 ? filtered : activeFormations;
  }, [seesAll, activeFormations, allDaySessions]);

  const groupedFormations = useMemo(() => groupFormations(availableFormations), [availableFormations]);

  // Ensure selectedFormationId is valid; if invalid, reset to "ALL"
  const effectiveFormationFilter = useMemo(() => {
    if (selectedFormationId === "ALL") return "ALL";
    const exists = availableFormations.some((f) => f.id === selectedFormationId);
    return exists ? selectedFormationId : "ALL";
  }, [selectedFormationId, availableFormations]);

  // Sessions matching the active formation filter
  const sessions = useMemo(() => {
    if (effectiveFormationFilter === "ALL") return allDaySessions;
    return allDaySessions.filter((s) => s.formationId === effectiveFormationFilter);
  }, [allDaySessions, effectiveFormationFilter]);

  const slot =
    (choice?.date === date ? sessions.find((s) => s.id === choice.slotId) : undefined) ??
    defaultSession(sessions, date, lookups?.formation);
  const formation = slot && lookups ? lookups.formation(slot.formationId) : undefined;
  const sessionKey = slot ? `${slot.id}|${date}` : null;
  const trainees = useMemo(() => {
    if (roster && roster.key === sessionKey) return roster.trainees;
    if (formation) return getUsersByIdsSync(formation.traineeIds ?? []);
    return null;
  }, [roster, sessionKey, formation]);

  // Load all attendances of the day for the multi-filière overview
  useEffect(() => {
    if (!isValidIsoDate(date)) return;
    let stale = false;
    listForDate(date)
      .then((list) => {
        if (!stale) setDayAttendances(list);
      })
      .catch(() => {
        if (!stale) setDayAttendances([]);
      });
    return () => {
      stale = true;
    };
  }, [date]);

  // Load roster and session attendances for the active slot
  useEffect(() => {
    if (!slot || !formation || !sessionKey) return;
    let stale = false;
    Promise.all([
      listUsersByIds(formation.traineeIds ?? []),
      listForSession(slot.id, date, slot.formationId).catch((err) => {
        console.warn("listForSession error", err);
        return [];
      }),
    ])
      .then(([traineesList, attendances]) => {
        if (stale) return;
        setRecords(Object.fromEntries(attendances.map((a) => [a.traineeId, a])));
        setRowState({});
        setRoster({ key: sessionKey, trainees: traineesList });
      })
      .catch((err) => {
        console.warn("trainees load error", err);
        if (!stale) setRoster({ key: sessionKey, trainees: [] });
      });
    return () => {
      stale = true;
    };
  }, [slot, formation, date, sessionKey]);

  const label = slot && lookups ? `${lookups.subjectTitle(slot.subjectId)} — ${lookups.formationTitle(slot.formationId)}` : "";

  // Temporal analysis & Overrides evaluation
  const currentOverride = useMemo(() => {
    if (!slot) return null;
    return overrides.find((o) => o.slotId === slot.id && o.date === date) ?? null;
  }, [slot, overrides, date]);

  const isCancelled = Boolean(currentOverride?.isCancelled);
  const isSubstitute = Boolean(currentOverride?.substituteTrainerId);
  const isSelfStudyTP = Boolean(currentOverride?.isSelfStudyTP);
  const isSupervisor = currentOverride?.supervisorId === profile.id;

  const temporal = useMemo(() => {
    if (!slot) return null;
    return getSessionTemporalStatus(slot, date, currentTime);
  }, [slot, date, currentTime]);

  const canManageAbsence = can(profile.role, "trainer.manageAbsence");
  const isRegularizationMode = can(profile.role, "attendance.modify");

  // Strict trainer check: if a substitute trainer is assigned, only the substitute trainer is active
  const effectiveTrainerId = currentOverride?.substituteTrainerId || slot?.trainerId;
  const isAssignedTrainer = slot ? effectiveTrainerId === profile.id : false;

  // Saisie/modification autorisée si :
  // 1. La séance n'est PAS annulée
  // 2. ET :
  //    - soit l'utilisateur est habilité en mode Régularisation Administrative (Admin, Responsable pédagogique, Secrétariat)
  //    - soit l'utilisateur est le superviseur désigné d'un TP en autonomie
  //    - soit l'utilisateur est le formateur actif (titulaire ou remplaçant), la séance n'est pas en TP supervisé par le secrétariat,
  //      ET la séance est dans sa fenêtre temporelle autorisée (de startTime jusqu'à endTime + 15 min le jour même).
  const canModify =
    !isCancelled &&
    (isRegularizationMode ||
      isSupervisor ||
      (isAssignedTrainer && !isSelfStudyTP && Boolean(temporal?.isUnlockedForTrainer)));

  const save = useCallback(
    async (entries: AttendanceEntry[], { silent = false } = {}) => {
      if (!slot) return false;

      // Re-vérification temporelle stricte à l'instant exact du clic (anti-onglet resté ouvert)
      const freshTemporal = getSessionTemporalStatus(slot, date, nowTime(), todayIso());
      const allowedNow =
        !isCancelled &&
        (isRegularizationMode ||
          isSupervisor ||
          (isAssignedTrainer && !isSelfStudyTP && freshTemporal.isUnlockedForTrainer));

      if (!allowedNow) {
        announce(
          isCancelled
            ? "Cette séance a été annulée. L'émargement est désactivé."
            : freshTemporal.message || "Saisie non autorisée sur ce créneau horaire.",
          "assertive",
        );
        return false;
      }

      const previous = { ...records };
      const optimisticRecords: Attendance[] = entries.map((e) => ({
        id: `${slot.id}_${date}_${e.trainee.id}`,
        formationId: slot.formationId,
        slotId: slot.id,
        subjectId: slot.subjectId,
        trainerId: effectiveTrainerId || slot.trainerId,
        traineeId: e.trainee.id,
        date,
        month: date.slice(0, 7),
        status: e.status,
        arrivalTime: e.status === "late" ? (e.arrivalTime ?? null) : null,
        excuseReason: null,
        recordedBy: profile.id,
      }));

      setRecords((r) => {
        const next = { ...r };
        for (const rec of optimisticRecords) {
          next[rec.traineeId] = rec;
        }
        return next;
      });

      // Update dayAttendances live so the multi-filière overview counters update immediately
      setDayAttendances((prev) => {
        const map = new Map(prev.map((a) => [`${a.slotId}_${a.traineeId}`, a]));
        for (const rec of optimisticRecords) {
          map.set(`${rec.slotId}_${rec.traineeId}`, rec);
        }
        return Array.from(map.values());
      });

      const mark = (state: RowState) =>
        setRowState((s) => ({ ...s, ...Object.fromEntries(entries.map((e) => [e.trainee.id, state])) }));
      mark("saving");
      try {
        await saveAttendances(profile, { slot, date, label }, entries);
        mark("saved");
        if (!silent && entries.length === 1) {
          const [e] = entries;
          const time =
            e.status === "late" && e.arrivalTime
              ? `, arrivée à ${formatSpokenTime(e.arrivalTime)}. Modifiez l'heure d'arrivée si nécessaire`
              : "";
          announce(`${e.trainee.fullName} ${SPOKEN_STATUS[e.status]}${time}. Enregistré.`);
        }
        return true;
      } catch {
        setRecords(previous);
        mark("error");
        announce("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.", "assertive");
        return false;
      }
    },
    [
      slot,
      date,
      label,
      profile,
      records,
      announce,
      isCancelled,
      isRegularizationMode,
      isSupervisor,
      isAssignedTrainer,
      isSelfStudyTP,
      effectiveTrainerId,
    ],
  );

  if (error || refError) return <Alert tone="error">{error ?? refError}</Alert>;
  if (!slots || !data || !lookups) return <Loading label="Chargement des séances et des filières…" />;

  const closureTitle = isValidIsoDate(date) ? lookups.closureTitle(date) : null;
  const isClosedOrWeekend = isValidIsoDate(date) && (isWeekend(date) || Boolean(closureTitle));
  const prevWorkDay = isValidIsoDate(date) ? previousWorkingDay(date, lookups.closedDays) : todayIso();
  const nextWorkDay = isValidIsoDate(date) ? nextWorkingDay(date, lookups.closedDays) : todayIso();

  const pending = trainees?.filter((t) => !records[t.id]) ?? [];
  const count = (status: AttendanceStatus) => trainees?.filter((t) => records[t.id]?.status === status).length ?? 0;

  const totalTrainees = trainees?.length ?? 0;
  const presentCount = count("present");
  const lateCount = count("late");
  const absentCount = count("absent");
  const excusedCount = count("excused");
  const attendanceRate = totalTrainees > 0 ? Math.round(((presentCount + lateCount) / totalTrainees) * 100) : 0;

  // Calcul du cumul de minutes de retard
  const totalLateMinutes = (trainees ?? []).reduce((acc, t) => {
    const rec = records[t.id];
    if (rec?.status === "late" && rec.arrivalTime && slot) {
      const arrMin = timeToMinutes(rec.arrivalTime);
      const startMin = timeToMinutes(slot.startTime);
      if (arrMin && startMin && arrMin > startMin) return acc + (arrMin - startMin);
    }
    return acc;
  }, 0);

  const filteredTrainees = (trainees ?? []).filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = t.fullName.toLowerCase().includes(q);
      const matchEmail = t.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    const rec = records[t.id];
    if (filter === "pending") return !rec;
    if (filter === "present") return rec?.status === "present";
    if (filter === "late") return rec?.status === "late";
    if (filter === "absent") return rec?.status === "absent" || rec?.status === "excused";
    return true;
  });

  const handleFilterChange = (mode: FilterMode) => {
    setFilter(mode);
    const filterLabels: Record<FilterMode, string> = {
      all: `Tous les ${trainees?.length ?? 0} stagiaires affichés`,
      pending: `${pending.length} stagiaires non saisis affichés`,
      present: `${presentCount} stagiaires présents affichés`,
      late: `${lateCount} stagiaires en retard affichés`,
      absent: `${absentCount + excusedCount} stagiaires absents affichés`,
    };
    announce(filterLabels[mode]);
  };

  const markAllPresent = async () => {
    if (!pending.length) return;
    const ok = await save(
      pending.map((trainee) => ({ trainee, status: "present" as const })),
      { silent: true },
    );
    if (ok) {
      announce(
        `${pending.length} stagiaire${pending.length > 1 ? "s" : ""} marqué${pending.length > 1 ? "s" : ""} présent${pending.length > 1 ? "s" : ""}.`,
      );
    }
  };

  // Multi-filière overview metrics per session
  const sessionsWithTrainees = allDaySessions.filter(
    (s) => (lookups.formation(s.formationId)?.traineeIds?.length ?? 0) > 0,
  );
  const overviewSessions =
    showEmptyFormationsInOverview || sessionsWithTrainees.length === 0
      ? allDaySessions
      : sessionsWithTrainees;

  const firstPopulatedFormation = availableFormations.find((f) => (f.traineeIds?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. BARRE DE CONTRÔLE : SÉLECTION DE LA FILIÈRE / PROMOTION & DE LA DATE */}
      <section
        aria-labelledby="day-heading"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Sélecteur de Filière / Promotion */}
          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <label htmlFor="formation-filter" className="text-sm font-bold text-primary flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span>Filière / Promotion à émarger</span>
            </label>
            <select
              id="formation-filter"
              value={effectiveFormationFilter}
              onChange={(e) => {
                const val = e.target.value;
                handleSelectFormation(val);
                if (val !== "ALL") {
                  const firstForForm = allDaySessions.find((s) => s.formationId === val);
                  if (firstForForm) {
                    setChoice({ date, slotId: firstForForm.id });
                  }
                }
              }}
              className={`min-h-11 w-full rounded-xl border border-border-subtle bg-surface-container-lowest px-3.5 py-2 text-sm font-bold text-on-surface shadow-xs ${focusRing}`}
            >
              <option value="ALL">
                Toutes les filières actives ({sessionsWithTrainees.length} avec stagiaires inscrits / {availableFormations.length} au total)
              </option>
              {groupedFormations.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((f) => {
                    const countTrainees = f.traineeIds?.length ?? 0;
                    return (
                      <option key={f.id} value={f.id}>
                        {f.shortCode ? `[${f.shortCode}] ` : ""}
                        {f.title} ({countTrainees} stagiaire{countTrainees > 1 ? "s" : ""})
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Sélecteur de Date & Navigation Jour Ouvré */}
          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="input-date" id="day-heading" className="text-sm font-bold text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Date de la séance</span>
              </label>
              {isValidIsoDate(date) && (
                <span className="text-xs font-bold text-secondary capitalize">{formatLongDate(date)}</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="sm:w-44 shrink-0">
                <TextField
                  id="input-date"
                  label=""
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="!min-h-11 text-sm w-full"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <Button
                  variant="secondary"
                  onClick={() => setDate(addDays(date, -1))}
                  className="!min-h-11 !px-3 text-xs sm:text-sm inline-flex items-center justify-center gap-1 flex-1"
                  aria-label="Aller au jour précédent"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Préc.</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setDate(todayIso())}
                  className="!min-h-11 !px-3 text-xs sm:text-sm font-bold flex-1 justify-center"
                  aria-label="Revenir à la date d'aujourd'hui"
                >
                  Aujourd&apos;hui
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setDate(addDays(date, 1))}
                  className="!min-h-11 !px-3 text-xs sm:text-sm inline-flex items-center justify-center gap-1 flex-1"
                  aria-label="Aller au jour suivant"
                >
                  <span>Suiv.</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BANDEAU WEEK-END / JOUR FÉRIÉ AVEC NAVIGATION RAPIDE VERS LES JOURS OUVRÉS */}
      {isClosedOrWeekend && (
        <section
          aria-label="Jour non ouvré"
          className="rounded-xl border-2 border-secondary/40 bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">
                {isWeekend(date)
                  ? `Aucune séance programmée le week-end (${formatLongDate(date)})`
                  : `Établissement fermé ce jour : ${closureTitle} (${formatLongDate(date)})`}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Les cours et feuilles d&apos;émargement ont lieu du lundi au vendredi (hors jours fériés). Utilisez les raccourcis ci-contre pour accéder directement à un jour de cours :
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDate(prevWorkDay)}
              className="!min-h-11 !px-4 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Dernier jour ouvré ({formatLongDate(prevWorkDay)})</span>
            </Button>
            <Button
              type="button"
              onClick={() => setDate(nextWorkDay)}
              className="!min-h-11 !px-4 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
            >
              <span>Prochain jour ouvré ({formatLongDate(nextWorkDay)})</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {/* 3. VUE D'ENSEMBLE MULTI-FILIÈRES DU JOUR (Pour savoir immédiatement quelle filière émarger) */}
      {!isClosedOrWeekend && allDaySessions.length > 0 && (
        <section
          aria-labelledby="overview-heading"
          className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs flex flex-col gap-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="overview-heading" className="text-base font-bold text-primary">
                  État des émargements du jour par filière ({formatLongDate(date)})
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Cliquez sur une filière ci-dessous pour ouvrir sa feuille d&apos;émargement et saisir les présences.
                </p>
              </div>
            </div>

            {seesAll && allDaySessions.length > sessionsWithTrainees.length && sessionsWithTrainees.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEmptyFormationsInOverview((v) => !v)}
                className="!min-h-9 !px-3 !py-1.5 text-xs font-bold"
              >
                {showEmptyFormationsInOverview
                  ? `Afficher uniquement les filières avec stagiaires (${sessionsWithTrainees.length})`
                  : `Voir aussi les ${allDaySessions.length - sessionsWithTrainees.length} filières sans stagiaires inscrits`}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overviewSessions.map((s) => {
              const f = lookups.formation(s.formationId);
              const traineeIds = f?.traineeIds ?? [];
              const totalInFormation = traineeIds.length;
              const isSelected = slot?.id === s.id;
              const ov = overrides.find((o) => o.slotId === s.id && o.date === date);
              const temp = getSessionTemporalStatus(s, date, currentTime);

              // Count marked trainees for this session (including day-level justifications)
              const traineeSet = new Set(traineeIds);
              const markedTraineeIds = new Set<string>();
              for (const att of dayAttendances) {
                if (!traineeSet.has(att.traineeId)) continue;
                if (
                  att.slotId === s.id ||
                  (att.formationId === s.formationId &&
                    (att.slotId === "general" || att.slotId.startsWith("default_slot_")))
                ) {
                  markedTraineeIds.add(att.traineeId);
                }
              }
              const markedCount = markedTraineeIds.size;
              const isComplete = totalInFormation > 0 && markedCount >= totalInFormation;
              const isPartial = markedCount > 0 && markedCount < totalInFormation;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    handleSelectFormation(s.formationId);
                    setChoice({ date, slotId: s.id });
                    announce(`Filière sélectionnée : ${f?.title ?? "Formation"}, ${totalInFormation} stagiaires.`);
                  }}
                  aria-pressed={isSelected}
                  className={`text-left rounded-xl p-3.5 transition-all flex flex-col justify-between gap-2.5 border-2 ${focusRing} ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border-subtle bg-surface-container-low/60 hover:bg-surface-container"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {f?.shortCode && (
                        <span className="rounded-md bg-primary-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-primary">
                          {f.shortCode}
                        </span>
                      )}
                      <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] font-mono font-bold text-on-surface">
                        {s.startTime} – {s.endTime}
                      </span>
                    </div>

                    {/* Badge d'état d'émargement */}
                    {ov?.isCancelled ? (
                      <span className="rounded-full bg-status-absent-bg px-2.5 py-0.5 text-[11px] font-bold text-status-absent shrink-0">
                        Annulée
                      </span>
                    ) : totalInFormation === 0 ? (
                      <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant shrink-0">
                        0 stagiaire
                      </span>
                    ) : isComplete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-present-bg px-2.5 py-0.5 text-[11px] font-bold text-status-present shrink-0">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Complet ({markedCount}/{totalInFormation})
                      </span>
                    ) : isPartial ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-late-bg px-2.5 py-0.5 text-[11px] font-bold text-status-late shrink-0">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        En cours ({markedCount}/{totalInFormation})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-absent-bg px-2.5 py-0.5 text-[11px] font-bold text-status-absent shrink-0">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        À émarger (0/{totalInFormation})
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-primary line-clamp-1">
                      {f?.title ?? "Formation"}
                    </h3>
                    <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                      {lookups.subjectTitle(s.subjectId)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle/60 text-[11px] text-on-surface-variant w-full">
                    <span className="truncate font-medium">
                      {ov?.isSelfStudyTP
                        ? `TP supervisé (${ov.supervisorName})`
                        : ov?.substituteTrainerName
                          ? `Rempl. : ${ov.substituteTrainerName}`
                          : lookups.trainerName(s.trainerId)}
                    </span>
                    <span className="font-bold shrink-0 text-primary">
                      {temp.status === "current"
                        ? "Séance en cours"
                        : temp.status === "future"
                          ? `Ouvre à ${s.startTime}`
                          : "Clôturée"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. CONTEXT HERO & SÉANCE ACTIVE */}
      {slot && (
        <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex flex-col gap-2 relative z-10 max-w-3xl">
            {/* Badges de Filière & Statut Réel */}
            <div className="flex items-center gap-2 flex-wrap">
              {formation?.shortCode && (
                <span className="rounded-full bg-primary-container px-3 py-1 font-bold text-xs uppercase tracking-wide text-on-primary">
                  {formation.shortCode}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface">
                <GraduationCap className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {formation ? formation.title : "Formation"}
              </span>

              {/* Badge dynamique reflétant l'état réel de la séance */}
              {isCancelled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-absent-bg px-3 py-1 text-xs font-bold text-status-absent">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Séance annulée
                </span>
              ) : isSelfStudyTP ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-3 py-1 text-xs font-bold text-secondary">
                  <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
                  TP &amp; Travail libre supervisé
                </span>
              ) : temporal?.status === "current" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-present-bg px-3 py-1 text-xs font-bold text-status-present">
                  <span className="h-2 w-2 rounded-full bg-status-present animate-pulse" aria-hidden="true"></span>
                  Séance en cours ({slot.startTime}–{slot.endTime})
                </span>
              ) : temporal?.status === "future" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-late-bg px-3 py-1 text-xs font-bold text-status-late">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Séance à venir (ouvre à {slot.startTime})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface-variant">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Séance clôturée
                </span>
              )}
            </div>

            {/* Titre de la séance */}
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Feuille d&apos;émargement — {formation ? formation.title : lookups.subjectTitle(slot.subjectId)}
            </h1>

            {/* Métadonnées : matière, date, horaires, salle, formateur */}
            <div className="flex items-center gap-3 sm:gap-4 text-on-surface-variant flex-wrap text-sm pt-1">
              <span className="font-bold text-primary">
                {lookups.subjectTitle(slot.subjectId)}
              </span>
              <span className="text-outline" aria-hidden="true">
                •
              </span>
              <span className="flex items-center gap-1.5 font-bold text-on-surface">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {formatLongDate(date)}
              </span>
              <span className="text-outline" aria-hidden="true">
                •
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-4 w-4 text-outline shrink-0" aria-hidden="true" />
                {slot.startTime} — {slot.endTime}
              </span>
              <span className="text-outline" aria-hidden="true">
                •
              </span>
              <span className="flex items-center gap-1.5 text-secondary font-bold">
                <MapPin className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {slot.room ? `${slot.room}` : "Plateau Pédagogique"}
              </span>
              <span className="text-outline" aria-hidden="true">
                •
              </span>
              <span className="flex items-center gap-1.5 text-on-surface font-medium">
                <User className="h-4 w-4 text-outline shrink-0" aria-hidden="true" />
                {isSubstitute
                  ? `${currentOverride?.substituteTrainerName} (remplace ${lookups.trainerName(slot.trainerId)})`
                  : lookups.trainerName(slot.trainerId)}
              </span>
            </div>
          </div>

          {/* Contrôles droits : commutateur de créneau de la filière + horloge en temps réel */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 shrink-0 relative z-10">
            {sessions.length > 1 && (
              <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-border-subtle w-full sm:w-auto">
                <label htmlFor="slot-select" className="sr-only">
                  Changer de séance
                </label>
                <select
                  id="slot-select"
                  value={slot.id}
                  onChange={(e) => setChoice({ date, slotId: e.target.value })}
                  className="bg-surface-container-lowest text-on-surface font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg shadow-xs focus:ring-4 focus:ring-focus-outer focus:outline-none max-w-xs sm:max-w-md truncate"
                >
                  {sessions.map((s) => {
                    const f = lookups.formation(s.formationId);
                    return (
                      <option key={s.id} value={s.id}>
                        {f?.shortCode ? `[${f.shortCode}] ` : `${f?.title ?? ""} · `}
                        {s.startTime}–{s.endTime} · {lookups.subjectTitle(s.subjectId)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <LiveClock />
          </div>
        </div>
      )}

      {/* 5. BANNIÈRES OPÉRATIONNELLES : ANNULATION / REMPLACEMENT / CONTRÔLE TEMPOREL FORMATEUR / RÉGULARISATION */}
      {slot && (
        <div className="flex flex-col gap-3">
          {/* Cas 1 : Séance Annulée pour absence du formateur */}
          {isCancelled && (
            <div className="rounded-xl border-2 border-status-absent/50 bg-status-absent-bg/40 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-status-absent/20 text-status-absent flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-status-absent">
                    Séance Annulée —{" "}
                    {currentOverride?.cancellationReason
                      ? SESSION_CANCELLATION_LABELS[currentOverride.cancellationReason]
                      : "Absence du formateur"}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {currentOverride?.cancellationNote || "Séance non dispensée par l'établissement."} Les heures de ce créneau ne sont pas imputées aux stagiaires (dispense administrative officielle sans pénalisation d&apos;assiduité).
                  </p>
                </div>
              </div>

              {canManageAbsence && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAbsenceModalOpen(true)}
                  className="shrink-0 !text-xs !py-1.5"
                >
                  Modifier la décision
                </Button>
              )}
            </div>
          )}

          {/* Cas 2 : Remplacement actif */}
          {isSubstitute && !isCancelled && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-primary">Remplacement Pédagogique Actif</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Formateur titulaire : <strong>{lookups.trainerName(slot.trainerId)}</strong> (absent) — Séance assurée par :{" "}
                    <strong className="text-primary">
                      {currentOverride?.substituteTrainerName || "Formateur remplaçant"}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              {canManageAbsence && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAbsenceModalOpen(true)}
                  className="shrink-0 !text-xs !py-1.5"
                >
                  Modifier le remplacement
                </Button>
              )}
            </div>
          )}

          {/* Cas 3 : Travaux Pratiques / Travail Libre Supervisé par Secrétariat / Direction */}
          {isSelfStudyTP && !isCancelled && (
            <div className="rounded-xl border-2 border-secondary/40 bg-secondary/10 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <Laptop className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-primary flex items-center gap-2 flex-wrap">
                    Travaux Pratiques &amp; Travail Libre Supervisé
                    <span className="rounded-full bg-status-present-bg px-2.5 py-0.5 text-[11px] font-bold text-status-present">
                      Présence 100% Validée
                    </span>
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    Formateur titulaire absent — Séance maintenue en auto-formation / exercices pratiques. Émargement supervisé par{" "}
                    <strong>{currentOverride?.supervisorName}</strong> (
                    {currentOverride?.supervisorRole ? ROLE_LABELS[currentOverride.supervisorRole] : "Responsable"}).{" "}
                    {currentOverride?.selfStudyNote && `Activité : « ${currentOverride.selfStudyNote} »`}
                  </p>
                </div>
              </div>

              {canManageAbsence && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAbsenceModalOpen(true)}
                  className="shrink-0 !text-xs !py-1.5"
                >
                  Modifier la décision
                </Button>
              )}
            </div>
          )}

          {/* Cas 4 : Verrouillage Temporel Formateur (avant la séance ou après la séance) */}
          {!isCancelled && !isRegularizationMode && !canModify && (
            <div
              role="status"
              className="rounded-xl border-2 border-status-late-border/60 bg-status-late-bg/30 p-4 shadow-xs flex items-start gap-3.5"
            >
              <div className="h-10 w-10 rounded-xl bg-status-late/20 text-status-late flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-sm sm:text-base text-primary">
                  {isSelfStudyTP
                    ? "Séance placée en Travaux Pratiques supervisés (Formateur absent)"
                    : temporal?.status === "future"
                      ? "Émargement verrouillé avant la séance (Anticipation interdite)"
                      : "Émargement verrouillé après la séance (Séance clôturée — Lecture seule)"}
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {isSelfStudyTP
                    ? `Cette séance est supervisée par ${currentOverride?.supervisorName || "le secrétariat"}. Seul le superviseur ou le secrétariat peut modifier l'émargement.`
                    : temporal?.message}
                </p>
              </div>
            </div>
          )}

          {/* Cas 4b : Fenêtre temporelle ouverte pour le Formateur */}
          {!isCancelled && !isRegularizationMode && canModify && (
            <div className="rounded-xl border border-status-present-border/60 bg-status-present-bg/30 p-3.5 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
                <span className="font-bold text-status-present">Émargement Formateur Ouvert :</span>
                <span className="text-on-surface">{temporal?.message}</span>
              </div>
            </div>
          )}

          {/* Cas 5 : Mode Régularisation Administrative (Admin / Responsable pédagogique / Secrétariat) */}
          {isRegularizationMode && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm">
                <Shield className="h-5 w-5 text-secondary shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                <div>
                  <span className="font-bold text-primary">
                    Mode {ROLE_LABELS[profile.role]} (Émargement multi-filières &amp; Régularisation) :{" "}
                  </span>
                  <span className="text-on-surface-variant">
                    Vous pouvez saisir et régulariser les présences de toutes les filières, ou gérer l&apos;absence d&apos;un formateur.
                  </span>
                </div>
              </div>

              {canManageAbsence && !isCancelled && !isSubstitute && !isSelfStudyTP && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAbsenceModalOpen(true)}
                  className="shrink-0 !text-xs !py-1.5 flex items-center gap-1.5"
                >
                  <UserX className="h-4 w-4 text-status-absent" aria-hidden="true" />
                  Gérer l&apos;absence du formateur
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. CAS FILIÈRE SANS STAGIAIRES INSCRITS (Explication claire + bouton vers filière active ou import) */}
      {slot && trainees && trainees.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="h-14 w-14 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Users className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="max-w-lg">
            <h2 className="text-lg sm:text-xl font-bold text-primary">
              Aucun stagiaire n&apos;est inscrit dans la filière « {formation?.title ?? "sélectionnée"} »
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant leading-relaxed">
              Cette promotion compte actuellement <strong>0 stagiaire inscrit</strong>. Choisissez une filière ayant des stagiaires inscrits dans le tableau ci-dessus, ou importez la liste des stagiaires de cette promotion.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
            {firstPopulatedFormation && firstPopulatedFormation.id !== formation?.id && (
              <Button
                type="button"
                onClick={() => {
                  handleSelectFormation(firstPopulatedFormation.id);
                  const targetSlot = allDaySessions.find((s) => s.formationId === firstPopulatedFormation.id);
                  if (targetSlot) setChoice({ date, slotId: targetSlot.id });
                }}
                className="inline-flex items-center gap-2 !px-4"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                <span>
                  Ouvrir « {firstPopulatedFormation.title} » ({firstPopulatedFormation.traineeIds?.length ?? 0} stagiaires)
                </span>
              </Button>
            )}
            {seesAll && (
              <Link
                href="/secretary/import"
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-4 py-2 text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Importer des stagiaires dans cette filière</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 7. KPI / ATTENDANCE METRICS CARDS */}
      {slot && trainees && trainees.length > 0 && (
        <section
          aria-label="Statistiques instantanées de la séance"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {/* KPI 1: Taux de présence */}
          <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs uppercase text-on-surface-variant font-bold tracking-wider truncate">
                Taux de présence
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-primary mt-1">{attendanceRate}%</span>
              <span className="text-[11px] sm:text-xs font-bold text-status-present flex items-center gap-1 mt-0.5 truncate">
                <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />
                {presentCount + lateCount} / {totalTrainees} présents
              </span>
            </div>
            <div className="relative h-10 w-10 sm:h-14 sm:w-14 shrink-0 flex items-center justify-center">
              <svg aria-hidden="true" className="h-full w-full -rotate-90 hidden sm:block" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-highest"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
                <path
                  className="text-status-present"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${attendanceRate}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>
              <Users className="h-5 w-5 text-status-present" aria-hidden="true" />
            </div>
          </div>

          {/* KPI 2: Stagiaires Présents */}
          <div className="rounded-xl border border-status-present-border/50 bg-status-present-bg p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs uppercase text-status-present tracking-wider font-bold truncate">
                Présents
              </span>
              <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-bold text-status-present">{presentCount}</span>
                <span className="text-[11px] sm:text-xs font-semibold text-status-present/80">/ {totalTrainees}</span>
              </div>
              <span className="text-[11px] sm:text-xs text-status-present mt-0.5 font-medium truncate">
                Émargés avec succès
              </span>
            </div>
            <div
              className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-status-present/15 flex items-center justify-center text-status-present shrink-0"
              aria-hidden="true"
            >
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-status-present" aria-hidden="true" />
            </div>
          </div>

          {/* KPI 3: Retards */}
          <div className="rounded-xl border border-status-late-border/50 bg-status-late-bg p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs uppercase text-status-late tracking-wider font-bold truncate">
                Retards
              </span>
              <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-bold text-status-late">{lateCount}</span>
                <span className="text-[11px] sm:text-xs font-medium text-status-late/80 truncate">
                  {totalLateMinutes > 0 ? `+${totalLateMinutes}m` : "horodaté"}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-status-late mt-0.5 font-medium truncate">
                Horodatage consigné
              </span>
            </div>
            <div
              className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-status-late/15 flex items-center justify-center text-status-late shrink-0"
              aria-hidden="true"
            >
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-status-late" aria-hidden="true" />
            </div>
          </div>

          {/* KPI 4: Absents & Excusés */}
          <div className="rounded-xl border border-status-absent-border/50 bg-status-absent-bg p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs uppercase text-status-absent tracking-wider font-bold truncate">
                Absences
              </span>
              <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-bold text-status-absent">{absentCount}</span>
                {excusedCount > 0 && (
                  <span className="text-[11px] sm:text-xs font-bold text-status-excused">({excusedCount} exc.)</span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5 font-medium truncate">
                {pending.length > 0 ? `${pending.length} non saisis` : "Tous saisis"}
              </span>
            </div>
            <div
              className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-status-absent/15 flex items-center justify-center text-status-absent shrink-0"
              aria-hidden="true"
            >
              <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-status-absent" aria-hidden="true" />
            </div>
          </div>
        </section>
      )}

      {/* 8. BANDEAU ASSISTANCE ACCESSIBILITÉ & ACTIONS GROUPÉES */}
      {slot && trainees && trainees.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-high p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0 shadow-xs"
              aria-hidden="true"
            >
              <Keyboard className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-on-surface flex items-center gap-2">
                Assistance vocale &amp; Raccourcis clavier
                <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-mono font-bold text-primary">
                  Accessible NVDA / JAWS
                </span>
              </span>
              <span className="text-xs text-on-surface-variant">
                Sur une ligne stagiaire :{" "}
                <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">P</kbd> Présent,{" "}
                <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">R</kbd> Retard,{" "}
                <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">A</kbd> Absent.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-end">
            {pending.length > 0 && canModify && (
              <ConfirmDialog
                triggerLabel={`Marquer tous présents (${pending.length})`}
                triggerAccessibleLabel={`Marquer présents les ${pending.length} stagiaires non saisis`}
                title="Valider la présence groupée ?"
                description={`Cette action va marquer « Présent » les ${pending.length} stagiaire(s) de la filière « ${formation?.title ?? ""} » qui n'ont pas encore d'émargement enregistré pour cette séance.`}
                confirmLabel="Confirmer la présence"
                onConfirm={markAllPresent}
              />
            )}
            {pending.length > 0 && !canModify && (
              <span className="inline-flex items-center gap-1.5 font-bold text-xs text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Émargement verrouillé ({pending.length} en attente)
              </span>
            )}
            {pending.length === 0 && (
              <span className="inline-flex items-center gap-1.5 font-bold text-xs text-status-present bg-status-present-bg px-3 py-2 rounded-xl">
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Tous les stagiaires de cette filière sont émargés
              </span>
            )}
          </div>
        </div>
      )}

      {/* 9. BARRE DE RECHERCHE & FILTRES */}
      {slot && trainees && trainees.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Champ de recherche */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="search-trainee" className="sr-only">
              Rechercher un stagiaire par nom ou prénom
            </label>
            <Search
              className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="search-trainee"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer stagiaire (ex: Lamia, Karim, Chloé...)"
              className={`w-full rounded-xl border border-border-subtle bg-surface-container-lowest py-2.5 pl-10 pr-10 text-sm text-on-surface shadow-xs placeholder:text-outline ${focusRing}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Onglets de filtre de statut */}
          <div
            role="tablist"
            aria-label="Filtrer les stagiaires par statut"
            className="flex items-center gap-1 bg-surface-container p-1 rounded-xl overflow-x-auto scrollbar-none"
          >
            {[
              { id: "all" as const, label: `Tous (${trainees.length})` },
              { id: "pending" as const, label: `À saisir (${pending.length})`, count: pending.length },
              { id: "present" as const, label: `Présents (${presentCount})`, count: presentCount },
              { id: "late" as const, label: `Retards (${lateCount})`, count: lateCount },
              {
                id: "absent" as const,
                label: `Absents (${absentCount + excusedCount})`,
                count: absentCount + excusedCount,
              },
            ].map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => handleFilterChange(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${focusRing} ${
                    active
                      ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 10. TABLEAU DE PRÉSENCE (Design accessible, contrasté, responsive) */}
      {slot && trainees && trainees.length > 0 && (
        <section
          aria-labelledby="roster-heading"
          className="rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 sm:px-6 py-4 bg-surface-container-low">
            <h2 id="roster-heading" className="text-base sm:text-lg font-bold text-primary">
              Liste d&apos;émargement — {formation?.title ?? "Promotion"}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                {filteredTrainees.length} stagiaire{filteredTrainees.length > 1 ? "s" : ""} affiché
                {filteredTrainees.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Vue Mobile (< 768px) : Cartes tactiles directes sans défilement horizontal */}
          <div className="md:hidden flex flex-col gap-3 p-3">
            {filteredTrainees.map((trainee) => (
              <TraineeCard
                key={trainee.id}
                trainee={trainee}
                slot={slot}
                date={date}
                record={records[trainee.id]}
                state={rowState[trainee.id] ?? "idle"}
                onSave={(t, status, arrivalTime) => save([{ trainee: t, status, arrivalTime }])}
                readOnly={!canModify}
              />
            ))}
            {filteredTrainees.length === 0 && (
              <div className="p-6 text-center text-sm font-semibold text-on-surface-variant bg-surface-container-lowest rounded-xl border border-border-subtle">
                {searchQuery
                  ? `Aucun stagiaire ne correspond à « ${searchQuery} ».`
                  : "Aucun stagiaire dans cette catégorie."}
              </div>
            )}
          </div>

          {/* Vue Tablette & Bureau (>= 768px) : Grand tableau structuré */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <caption className="sr-only">
                Feuille d&apos;émargement de la séance {label} du {formatLongDate(date)}.
              </caption>
              <thead>
                <tr className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="p-3 sm:p-4">
                    Stagiaire &amp; Aménagements
                  </th>
                  <th scope="col" className="p-3 sm:p-4">
                    Statut de présence
                  </th>
                  <th scope="col" className="p-3 sm:p-4">
                    Arrivée / Retard
                  </th>
                  <th scope="col" className="p-3 sm:p-4 text-right">
                    Horodatage &amp; État
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredTrainees.map((trainee) => (
                  <TraineeRow
                    key={trainee.id}
                    trainee={trainee}
                    slot={slot}
                    date={date}
                    record={records[trainee.id]}
                    state={rowState[trainee.id] ?? "idle"}
                    onSave={(t, status, arrivalTime) => save([{ trainee: t, status, arrivalTime }])}
                    readOnly={!canModify}
                  />
                ))}
                {filteredTrainees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm font-semibold text-on-surface-variant">
                      {searchQuery
                        ? `Aucun stagiaire ne correspond à « ${searchQuery} ».`
                        : "Aucun stagiaire dans cette catégorie."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 11. MODALE DE GESTION DE L'ABSENCE DU FORMATEUR (Remplacement & Annulation) */}
      {slot && canManageAbsence && (
        <TrainerAbsenceModal
          actor={profile}
          slot={slot}
          date={date}
          override={currentOverride}
          trainers={trainersList}
          subjectTitle={lookups?.subjectTitle(slot.subjectId) || "Matière"}
          formationTitle={lookups?.formationTitle(slot.formationId) || "Formation"}
          primaryTrainerName={lookups?.trainerName(slot.trainerId) || "Formateur titulaire"}
          isOpen={absenceModalOpen}
          onClose={() => setAbsenceModalOpen(false)}
          onSaved={() => {
            // Subscription to session overrides auto-updates state immediately
          }}
        />
      )}
    </div>
  );
}
