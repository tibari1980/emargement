"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Laptop,
  Layers,
  Lock,
  MapPin,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import {
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
import { getUsersByIdsSync, listUsersByIds } from "@/lib/data/users";
import {
  getSessionTemporalStatus,
  nextWorkingDay,
  previousWorkingDay,
  sessionsOn,
} from "@/lib/domain/schedule";
import {
  ROLE_LABELS,
  SESSION_CANCELLATION_LABELS,
  WEEKDAY_LABELS,
  type Attendance,
  type AttendanceStatus,
  type SessionOverride,
  type TimetableSlot,
  type UserProfile,
} from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import {
  AttendanceKpiCards,
  AttendanceRosterSection,
  ClosedOrWeekendBanner,
  defaultSession,
  LiveClock,
  SPOKEN_STATUS,
  STORAGE_FORMATION_KEY,
  type FilterMode,
} from "./SharedAttendanceParts";
import type { RowState } from "./TraineeRow";

/**
 * Vue Émargement exclusivement dédiée au profil Formateur (trainer).
 * Isolation stricte :
 * - Aucun code de régularisation administrative ni de gestion d'absence formateur.
 * - Verrouillage temporel strict (Heure de Paris synchronisée serveur) :
 *   saisie impossible avant l'heure de début ou après la clôture de la séance (+15 min).
 */
export function TrainerAttendanceSheet({ profile }: { profile: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error: refError } = useReferenceData();
  const [slots, setSlots] = useState<TimetableSlot[]>(() => getInitialSlots());
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [selectedFormationId, setSelectedFormationId] = useState<string>("ALL");
  const [choice, setChoice] = useState<{ date: string; slotId: string } | null>(null);
  const [roster, setRoster] = useState<{ key: string; trainees: UserProfile[] } | null>(null);
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [dayAttendances, setDayAttendances] = useState<Attendance[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [overrides, setOverrides] = useState<SessionOverride[]>([]);

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

  useEffect(() => {
    const unsub = subscribeSessionOverridesForDate(date, (list) => {
      setOverrides(list);
    });
    return () => unsub();
  }, [date]);

  useEffect(() => {
    let stale = false;
    listSlots()
      .then((loaded) => {
        if (!stale) {
          setSlots(loaded);
          setError(null);
        }
      })
      .catch(() => {
        if (!stale) setSlots([]);
      });
    return () => {
      stale = true;
    };
  }, [profile.id]);

  const activeFormations = useMemo(() => {
    if (!data) return [];
    return deduplicateFormationsList(data.formations);
  }, [data]);

  // Tous les créneaux hebdomadaires attribués à ce formateur dans l'emploi du temps officiel
  const myWeeklySlots = useMemo(() => {
    if (!slots || !lookups) return [];
    return slots
      .filter((s) => lookups.formation(s.formationId)?.active !== false && s.trainerId === profile.id)
      .sort((a, b) => {
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [slots, lookups, profile.id]);

  // Sessions du jour filtrées strictement pour ce formateur (titulaire dans l'emploi du temps ou remplaçant désigné ce jour)
  // Aucun créneau générique 09:00-17:00 d'autres filières n'est injecté dans l'espace d'un formateur.
  const allDaySessions = useMemo(() => {
    if (!slots || !lookups || !isValidIsoDate(date)) return [];
    const activeCustomSlots = slots.filter((s) => lookups.formation(s.formationId)?.active !== false);
    const configuredOnDate = sessionsOn(activeCustomSlots, date, lookups.closedDays);

    const trainerSessions = configuredOnDate.filter((s) => {
      const ov = overrides.find((o) => o.slotId === s.id && o.date === date);
      const effectiveTrainer = ov?.substituteTrainerId || s.trainerId;
      return effectiveTrainer === profile.id || s.trainerId === profile.id;
    });

    return trainerSessions.sort((a, b) => {
      const aTrainees = lookups.formation(a.formationId)?.traineeIds?.length ?? 0;
      const bTrainees = lookups.formation(b.formationId)?.traineeIds?.length ?? 0;
      if ((bTrainees > 0 ? 1 : 0) !== (aTrainees > 0 ? 1 : 0)) {
        return (bTrainees > 0 ? 1 : 0) - (aTrainees > 0 ? 1 : 0);
      }
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return lookups.formationTitle(a.formationId).localeCompare(lookups.formationTitle(b.formationId), "fr");
    });
  }, [slots, lookups, date, overrides, profile.id]);

  // Filières dans lesquelles ce formateur enseigne réellement (dans la semaine ou en remplacement ce jour)
  const availableFormations = useMemo(() => {
    const allowedIds = new Set<string>([
      ...myWeeklySlots.map((s) => s.formationId),
      ...allDaySessions.map((s) => s.formationId),
    ]);
    return activeFormations.filter((f) => allowedIds.has(f.id));
  }, [activeFormations, myWeeklySlots, allDaySessions]);

  const groupedFormations = useMemo(() => groupFormations(availableFormations), [availableFormations]);

  const effectiveFormationFilter = useMemo(() => {
    if (selectedFormationId === "ALL") return "ALL";
    const exists = availableFormations.some((f) => f.id === selectedFormationId);
    return exists ? selectedFormationId : "ALL";
  }, [selectedFormationId, availableFormations]);

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

  useEffect(() => {
    if (!isValidIsoDate(date)) return;
    if (date > todayIso()) {
      setDayAttendances([]);
      return;
    }
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

  useEffect(() => {
    if (!slot || !formation || !sessionKey) return;
    let stale = false;
    Promise.all([
      listUsersByIds(formation.traineeIds ?? []),
      listForSession(slot.id, date, slot.formationId).catch(() => []),
    ])
      .then(([traineesList, attendances]) => {
        if (stale) return;
        const tempStatus = getSessionTemporalStatus(slot, date, nowTime(), todayIso());
        const validAttendances = tempStatus.status === "future" ? [] : attendances;
        setRecords(Object.fromEntries(validAttendances.map((a) => [a.traineeId, a])));
        setRowState({});
        setRoster({ key: sessionKey, trainees: traineesList });
      })
      .catch(() => {
        if (!stale) setRoster({ key: sessionKey, trainees: [] });
      });
    return () => {
      stale = true;
    };
  }, [slot, formation, date, sessionKey]);

  const label =
    slot && lookups ? `${lookups.subjectTitle(slot.subjectId)} — ${lookups.formationTitle(slot.formationId)}` : "";

  const currentOverride = useMemo(() => {
    if (!slot) return null;
    return overrides.find((o) => o.slotId === slot.id && o.date === date) ?? null;
  }, [slot, overrides, date]);

  const isCancelled = Boolean(currentOverride?.isCancelled);
  const isSubstitute = Boolean(currentOverride?.substituteTrainerId);
  const isSelfStudyTP = Boolean(currentOverride?.isSelfStudyTP);

  const temporal = useMemo(() => {
    if (!slot) return null;
    return getSessionTemporalStatus(slot, date, currentTime);
  }, [slot, date, currentTime]);

  const effectiveTrainerId = currentOverride?.substituteTrainerId || slot?.trainerId;
  const isAssignedTrainer = slot ? effectiveTrainerId === profile.id : false;

  // RÈGLE STRICTE FORMATEUR : Saisie autorisée UNIQUEMENT pendant la fenêtre horaire de la séance (startTime -> endTime + 15 min)
  const canModify =
    !isCancelled &&
    !isSelfStudyTP &&
    isAssignedTrainer &&
    Boolean(temporal?.isUnlockedForTrainer);

  const save = useCallback(
    async (entries: AttendanceEntry[], { silent = false } = {}) => {
      if (!slot) return false;

      // Re-vérification temporelle stricte à la milliseconde exacte du clic
      const freshTemporal = getSessionTemporalStatus(slot, date, nowTime(), todayIso());
      const allowedNow =
        !isCancelled &&
        !isSelfStudyTP &&
        isAssignedTrainer &&
        freshTemporal.isUnlockedForTrainer;

      if (!allowedNow) {
        announce(
          isCancelled
            ? "Cette séance a été annulée. L'émargement est désactivé."
            : freshTemporal.message || "Saisie verrouillée en dehors des horaires de la séance.",
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
      isSelfStudyTP,
      isAssignedTrainer,
      effectiveTrainerId,
    ],
  );

  if (error || refError) return <Alert tone="error">{error ?? refError}</Alert>;
  if (!slots || !data || !lookups) return <Loading label="Chargement de vos séances d'enseignement…" />;

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

  const sessionsWithTrainees = allDaySessions.filter(
    (s) => (lookups.formation(s.formationId)?.traineeIds?.length ?? 0) > 0,
  );
  const overviewSessions = sessionsWithTrainees.length > 0 ? sessionsWithTrainees : allDaySessions;
  const firstPopulatedFormation = availableFormations.find((f) => (f.traineeIds?.length ?? 0) > 0);

  // Recherche du jour de cours précédent et suivant dans l'emploi du temps du formateur
  const findNearestTeachingDate = (direction: -1 | 1): string | null => {
    if (!isValidIsoDate(date) || myWeeklySlots.length === 0) return null;
    for (let step = 1; step <= 14; step++) {
      const candidate = addDays(date, step * direction);
      if (sessionsOn(myWeeklySlots, candidate, lookups.closedDays).length > 0) {
        return candidate;
      }
    }
    return null;
  };
  const prevTeachingDate = findNearestTeachingDate(-1);
  const nextTeachingDate = findNearestTeachingDate(1);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. BARRE DE CONTRÔLE FORMATEUR : FILIÈRE & DATE */}
      <section
        aria-labelledby="trainer-day-heading"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <label htmlFor="trainer-formation-filter" className="text-sm font-bold text-primary flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span>Filière / Promotion de votre cours</span>
            </label>
            <select
              id="trainer-formation-filter"
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
                Toutes vos filières du jour ({sessionsWithTrainees.length} avec stagiaires inscrits)
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

          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="trainer-input-date"
                id="trainer-day-heading"
                className="text-sm font-bold text-primary flex items-center gap-2"
              >
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
                  id="trainer-input-date"
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

      {/* 2. BANDEAU WEEK-END / JOUR FÉRIÉ */}
      {isClosedOrWeekend && (
        <ClosedOrWeekendBanner
          date={date}
          closureTitle={closureTitle}
          prevWorkDay={prevWorkDay}
          nextWorkDay={nextWorkDay}
          onSelectDate={setDate}
        />
      )}

      {/* 3. VOS SÉANCES D'ENSEIGNEMENT DU JOUR */}
      {!isClosedOrWeekend && overviewSessions.length > 0 && (
        <section
          aria-labelledby="trainer-overview-heading"
          className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs flex flex-col gap-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="trainer-overview-heading" className="text-base font-bold text-primary">
                Vos séances d&apos;enseignement du jour ({formatLongDate(date)})
              </h2>
              <p className="text-xs text-on-surface-variant">
                Sélectionnez la promotion ci-dessous. L&apos;émargement s&apos;ouvre automatiquement à l&apos;heure de début du cours et se verrouille 15 minutes après la fin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overviewSessions.map((s) => {
              const f = lookups.formation(s.formationId);
              const traineeIds = f?.traineeIds ?? [];
              const totalInFormation = traineeIds.length;
              const isSelected = slot?.id === s.id;
              const ov = overrides.find((o) => o.slotId === s.id && o.date === date);
              const temp = getSessionTemporalStatus(s, date, currentTime);

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
                    announce(`Séance sélectionnée : ${f?.title ?? "Formation"}, ${totalInFormation} stagiaires.`);
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
                    ) : temp.status === "future" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 text-[11px] font-bold text-on-surface-variant shrink-0">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Séance à venir
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
                      {ov?.substituteTrainerId === profile.id ? "Vous (Remplaçant)" : profile.fullName}
                    </span>
                    <span className="font-bold shrink-0 text-primary">
                      {temp.isUnlockedForTrainer
                        ? "Ouvert à la saisie"
                        : temp.status === "future"
                          ? `Verrouillé (ouvre à ${s.startTime})`
                          : "Clôturé (lecture seule)"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3B. AUCUN COURS PROGRAMMÉ CE JOUR POUR CE FORMATEUR */}
      {!isClosedOrWeekend && overviewSessions.length === 0 && (
        <section
          aria-labelledby="trainer-no-session-heading"
          className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col items-center text-center gap-5"
        >
          <div className="h-14 w-14 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
            <Calendar className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="max-w-2xl flex flex-col gap-2">
            <h2 id="trainer-no-session-heading" className="text-xl sm:text-2xl font-bold text-primary">
              Bonjour {profile.fullName} ! Vous n&apos;avez aucun cours programmé le {formatLongDate(date)}
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Vous n&apos;avez pas de séance planifiée à cette date dans votre emploi du temps. Profitez de cette journée pour la préparation pédagogique, les échanges avec l&apos;équipe ou le suivi individualisé de vos apprenants.
            </p>
          </div>

          {myWeeklySlots.length > 0 && (
            <div className="w-full max-w-2xl rounded-xl border border-border-subtle bg-surface-container-low/60 p-4 text-left flex flex-col gap-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Vos créneaux habituels de la semaine ({myWeeklySlots.length} cours / semaine)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {myWeeklySlots.map((s) => {
                  const f = lookups.formation(s.formationId);
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border-subtle bg-surface-container-lowest p-2.5 text-xs flex flex-col gap-0.5"
                    >
                      <div className="font-bold text-primary flex items-center justify-between gap-2">
                        <span>{WEEKDAY_LABELS[s.weekday]}</span>
                        <span className="font-mono text-secondary">
                          {s.startTime} – {s.endTime}
                        </span>
                      </div>
                      <div className="font-semibold text-on-surface truncate">
                        {lookups.subjectTitle(s.subjectId)}
                      </div>
                      <div className="text-on-surface-variant truncate">
                        {f?.title ?? "Formation"} {s.room ? `• Salle ${s.room}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {prevTeachingDate && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDate(prevTeachingDate)}
                className="inline-flex items-center gap-2 !px-4"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Cours précédent ({formatLongDate(prevTeachingDate)})</span>
              </Button>
            )}
            {nextTeachingDate && (
              <Button
                type="button"
                onClick={() => setDate(nextTeachingDate)}
                className="inline-flex items-center gap-2 !px-4"
              >
                <span>Prochain cours ({formatLongDate(nextTeachingDate)})</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Link
              href="/planning"
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-4 py-2 text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
            >
              <Calendar className="h-4 w-4 text-secondary" aria-hidden="true" />
              <span>Consulter mon planning hebdomadaire</span>
            </Link>
          </div>
        </section>
      )}

      {/* 4. EN-TÊTE DE LA SÉANCE ACTIVE */}
      {slot && (
        <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex flex-col gap-2 relative z-10 max-w-3xl">
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
              ) : canModify ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-present-bg px-3 py-1 text-xs font-bold text-status-present">
                  <span className="h-2 w-2 rounded-full bg-status-present animate-pulse" aria-hidden="true"></span>
                  Séance ouverte à l&apos;émargement ({slot.startTime}–{slot.endTime})
                </span>
              ) : temporal?.status === "future" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-late-bg px-3 py-1 text-xs font-bold text-status-late">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Verrouillée avant début (ouvre à {slot.startTime})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface-variant">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Séance clôturée (lecture seule)
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Feuille d&apos;émargement — {formation ? formation.title : lookups.subjectTitle(slot.subjectId)}
            </h2>

            <div className="flex items-center gap-3 sm:gap-4 text-on-surface-variant flex-wrap text-sm pt-1">
              <span className="font-bold text-primary">{lookups.subjectTitle(slot.subjectId)}</span>
              <span className="text-outline" aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5 font-bold text-on-surface">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {formatLongDate(date)}
              </span>
              <span className="text-outline" aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-4 w-4 text-outline shrink-0" aria-hidden="true" />
                {slot.startTime} — {slot.endTime}
              </span>
              <span className="text-outline" aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5 text-secondary font-bold">
                <MapPin className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {slot.room ? `${slot.room}` : "Plateau Pédagogique"}
              </span>
              <span className="text-outline" aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5 text-on-surface font-medium">
                <User className="h-4 w-4 text-outline shrink-0" aria-hidden="true" />
                {isSubstitute
                  ? `${currentOverride?.substituteTrainerName} (remplace ${lookups.trainerName(slot.trainerId)})`
                  : lookups.trainerName(slot.trainerId)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 shrink-0 relative z-10">
            {sessions.length > 1 && (
              <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-border-subtle w-full sm:w-auto">
                <label htmlFor="trainer-slot-select" className="sr-only">
                  Changer de séance
                </label>
                <select
                  id="trainer-slot-select"
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

      {/* 5. BANNIÈRES DE CONTRÔLE TEMPOREL STRICT FORMATEUR */}
      {slot && (
        <div className="flex flex-col gap-3">
          {isCancelled && (
            <div className="rounded-xl border-2 border-status-absent/50 bg-status-absent-bg/40 p-4 shadow-xs flex items-start gap-3">
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
                  {currentOverride?.cancellationNote || "Séance non dispensée par l'établissement."} L&apos;émargement est désactivé sur ce créneau.
                </p>
              </div>
            </div>
          )}

          {isSubstitute && !isCancelled && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 shadow-xs flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-base text-primary">Remplacement Pédagogique Actif</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Formateur titulaire : <strong>{lookups.trainerName(slot.trainerId)}</strong> — Séance assurée par :{" "}
                  <strong className="text-primary">{currentOverride?.substituteTrainerName || "Formateur remplaçant"}</strong>.
                </p>
              </div>
            </div>
          )}

          {isSelfStudyTP && !isCancelled && (
            <div className="rounded-xl border-2 border-secondary/40 bg-secondary/10 p-4 shadow-xs flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Laptop className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-base text-primary">
                  Travaux Pratiques &amp; Travail Libre Supervisé par le Secrétariat
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Cette séance est supervisée par <strong>{currentOverride?.supervisorName}</strong> (
                  {currentOverride?.supervisorRole ? ROLE_LABELS[currentOverride.supervisorRole] : "Responsable"}).
                </p>
              </div>
            </div>
          )}

          {/* Verrouillage Temporel Formateur : AVANT ou APRÈS la séance */}
          {!isCancelled && !canModify && (
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
                    ? "Séance placée en Travaux Pratiques supervisés (Lecture seule)"
                    : !isAssignedTrainer
                      ? "Séance assurée par un formateur remplaçant (Lecture seule)"
                      : temporal?.status === "future"
                        ? "Émargement verrouillé avant la séance (Anticipation interdite)"
                        : "Émargement verrouillé après la séance (Séance clôturée — Lecture seule)"}
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {isSelfStudyTP
                    ? `Cette séance est supervisée par ${currentOverride?.supervisorName || "le secrétariat"}.`
                    : !isAssignedTrainer
                      ? `Un remplacement est actif sur cette séance. Seul ${currentOverride?.substituteTrainerName || "le formateur remplaçant"} ou le secrétariat peut saisir les présences.`
                      : temporal?.message}
                </p>
              </div>
            </div>
          )}

          {/* Fenêtre temporelle ouverte pour le Formateur */}
          {!isCancelled && canModify && (
            <div className="rounded-xl border border-status-present-border/60 bg-status-present-bg/30 p-3.5 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
                <span className="font-bold text-status-present">Émargement Formateur Ouvert :</span>
                <span className="text-on-surface">{temporal?.message}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. FILIÈRE SANS STAGIAIRES INSCRITS */}
      {slot && trainees && trainees.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="h-14 w-14 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Users className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="max-w-lg">
            <h2 className="text-lg sm:text-xl font-bold text-primary">
              La filière « {formation?.title ?? "sélectionnée"} » est prête pour sa prochaine promotion
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant leading-relaxed">
              Aucun stagiaire n&apos;est encore inscrit dans ce groupe. Dès que les inscriptions seront enregistrées par le secrétariat, vous retrouverez votre liste d&apos;émargement ici.
            </p>
          </div>
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
        </div>
      )}

      {/* 7. CARTES KPI & TABLEAU DE PRÉSENCE */}
      {slot && trainees && trainees.length > 0 && (
        <>
          <AttendanceKpiCards
            totalTrainees={totalTrainees}
            presentCount={presentCount}
            lateCount={lateCount}
            absentCount={absentCount}
            excusedCount={excusedCount}
            pendingCount={pending.length}
            totalLateMinutes={totalLateMinutes}
          />

          <AttendanceRosterSection
            slot={slot}
            date={date}
            label={label}
            formationTitle={formation?.title ?? "Promotion"}
            trainees={trainees}
            filteredTrainees={filteredTrainees}
            records={records}
            rowState={rowState}
            pendingCount={pending.length}
            presentCount={presentCount}
            lateCount={lateCount}
            absentCount={absentCount}
            excusedCount={excusedCount}
            filter={filter}
            onFilterChange={handleFilterChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            canModify={canModify}
            onMarkAllPresent={markAllPresent}
            onSaveSingle={(t, status, arrivalTime) => save([{ trainee: t, status, arrivalTime }])}
          />
        </>
      )}
    </div>
  );
}
