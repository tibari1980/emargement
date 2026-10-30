"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Keyboard,
  MapPin,
  Search,
  Sparkles,
  Timer,
  TrendingUp,
  User,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField } from "@/components/ui/Field";
import { addDays, formatLongDate, formatSpokenTime, isValidIsoDate, isWeekend, nowTime, timeToMinutes, todayIso } from "@/lib/core/dates";
import { listForSession, saveAttendances, type AttendanceEntry } from "@/lib/data/attendances";
import type { Actor } from "@/lib/data/audit";
import { listSlots } from "@/lib/data/timetable";
import { listUsersByIds } from "@/lib/data/users";
import { can } from "@/lib/domain/permissions";
import { sessionsOn } from "@/lib/domain/schedule";
import type { Attendance, AttendanceStatus, TimetableSlot, UserProfile } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { TraineeRow, TraineeCard, type RowState } from "./TraineeRow";

type FilterMode = "all" | "pending" | "present" | "late" | "absent";

const SPOKEN_STATUS: Record<AttendanceStatus, string> = {
  present: "marqué présent",
  absent: "marqué absent",
  late: "marqué en retard",
  excused: "en absence justifiée",
};

/** Live clock component showing current time in France timezone */
function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl bg-status-present-bg px-3.5 py-1.5 font-mono text-sm font-bold text-status-present shadow-xs"
      aria-label={`Heure actuelle : ${time}`}
    >
      <Timer className="h-4 w-4 shrink-0 text-status-present" aria-hidden="true" />
      <span className="tracking-widest">{time || "09:00:00"}</span>
      <span className="rounded bg-status-present/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        UTC+2
      </span>
    </div>
  );
}

/** Session to open by default: the one in progress, else the next one, else the first. */
function defaultSession(sessions: TimetableSlot[], date: string): TimetableSlot | undefined {
  if (date !== todayIso()) return sessions[0];
  const now = nowTime();
  return (
    sessions.find((s) => s.startTime <= now && now < s.endTime) ??
    sessions.find((s) => s.startTime > now) ??
    sessions[sessions.length - 1]
  );
}

export function AttendanceSheet({ profile }: { profile: Actor }) {
  const announce = useAnnounce();
  const { data, lookups, error: refError, reload } = useReferenceData();
  const seesAll = can(profile.role, "attendance.recordAny");
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [choice, setChoice] = useState<{ date: string; slotId: string } | null>(null);
  const [roster, setRoster] = useState<{ key: string; trainees: UserProfile[] } | null>(null);
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let stale = false;
    listSlots(seesAll ? {} : { trainerId: profile.id })
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
  }, [profile.id, seesAll]);

  const sessions = useMemo(() => {
    if (!slots || !lookups || !isValidIsoDate(date)) return [];
    const active = slots.filter((s) => lookups.formation(s.formationId)?.active !== false);
    return sessionsOn(active, date, lookups.closedDays);
  }, [slots, lookups, date]);

  const slot =
    (choice?.date === date ? sessions.find((s) => s.id === choice.slotId) : undefined) ?? defaultSession(sessions, date);
  const formation = slot && lookups ? lookups.formation(slot.formationId) : undefined;
  const sessionKey = slot ? `${slot.id}|${date}` : null;
  const trainees = roster && roster.key === sessionKey ? roster.trainees : null;

  useEffect(() => {
    if (!slot || !formation || !sessionKey) return;
    let stale = false;
    Promise.all([
      listUsersByIds(formation.traineeIds ?? []),
      listForSession(slot.id, date).catch((err) => {
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

  const save = useCallback(
    async (entries: AttendanceEntry[], { silent = false } = {}) => {
      if (!slot) return false;
      const previous = { ...records };
      setRecords((r) => {
        const next = { ...r };
        for (const e of entries) {
          next[e.trainee.id] = {
            id: "",
            formationId: slot.formationId,
            slotId: slot.id,
            subjectId: slot.subjectId,
            trainerId: slot.trainerId,
            traineeId: e.trainee.id,
            date,
            month: date.slice(0, 7),
            status: e.status,
            arrivalTime: e.status === "late" ? (e.arrivalTime ?? null) : null,
            excuseReason: null,
            recordedBy: profile.id,
          };
        }
        return next;
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
    [slot, date, label, profile, records, announce],
  );

  if (error || refError) return <Alert tone="error">{error ?? refError}</Alert>;
  if (!slots || !data || !lookups) return <Loading label="Chargement de vos séances…" />;

  const closure = data.holidays.find((h) => h.startDate <= date && date <= h.endDate);
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
    if (ok) announce(`${pending.length} stagiaire${pending.length > 1 ? "s" : ""} marqué${pending.length > 1 ? "s" : ""} présent${pending.length > 1 ? "s" : ""}.`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. SÉLECTEUR DE DATE & CONTRÔLE JOURNÉE */}
      <section
        aria-labelledby="day-heading"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 sm:p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="day-heading" className="text-lg font-bold text-primary">
              Sélection de la date
            </h2>
            {isValidIsoDate(date) && (
              <p className="text-sm font-semibold text-on-surface-variant">{formatLongDate(date)}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-44">
              <label htmlFor="input-date" className="sr-only">
                Choisir la date d&apos;émargement
              </label>
              <TextField
                id="input-date"
                label=""
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="!min-h-10 text-sm w-full"
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={() => setDate(addDays(date, -1))}
                className="!min-h-10 !px-3 text-xs sm:text-sm inline-flex items-center justify-center gap-1 flex-1 sm:flex-none"
                aria-label="Aller au jour précédent"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Préc.</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDate(todayIso())}
                className="!min-h-10 !px-3 text-xs sm:text-sm font-bold flex-1 sm:flex-none justify-center"
                aria-label="Revenir à la date d'aujourd'hui"
              >
                Aujourd&apos;hui
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDate(addDays(date, 1))}
                className="!min-h-10 !px-3 text-xs sm:text-sm inline-flex items-center justify-center gap-1 flex-1 sm:flex-none"
                aria-label="Aller au jour suivant"
              >
                <span>Suiv.</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ALERTES DU JOUR */}
      {isValidIsoDate(date) && isWeekend(date) && <Alert tone="info">Pas de séance programmée le week-end.</Alert>}
      {closure && <Alert tone="info">Établissement fermé ce jour : {closure.title}.</Alert>}

      {/* CAS AUCUNE SÉANCE : Stitch Design Empty State avec Initialiseur */}
      {isValidIsoDate(date) && !isWeekend(date) && !closure && sessions.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-container-lowest p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
            <Calendar className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-primary">Aucune séance programmée pour cette journée</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {seesAll
                ? "Il n'y a pas encore de créneau configuré pour ce jour dans l'emploi du temps."
                : "Aucune séance ne vous est attribuée ce jour. Les emplois du temps sont gérés par les responsables pédagogiques."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            {seesAll && (
              <Link
                href="/pedagogical/timetable"
                className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-4 py-2 text-sm font-bold text-primary hover:bg-surface-variant transition-colors"
              >
                <span>Gérer les emplois du temps</span>
              </Link>
            )}
            <Button
              variant="secondary"
              onClick={() => setDate(todayIso())}
              className="!px-4"
            >
              Revenir à aujourd&apos;hui
            </Button>
          </div>
        </div>
      )}

      {/* 2. CONTEXT HERO & SÉANCE DU JOUR (Stitch Design) */}
      {slot && (
        <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex flex-col gap-2 relative z-10 max-w-3xl">
            {/* Badges de Filière & Direct */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-primary-container px-3 py-1 font-bold text-xs uppercase tracking-wide text-on-primary">
                Filière Certifiante
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface">
                <GraduationCap className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                {formation ? formation.title : "Formation"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-present-bg px-3 py-1 text-xs font-bold text-status-present">
                <span className="h-2 w-2 rounded-full bg-status-present animate-pulse" aria-hidden="true"></span>
                Séance en direct
              </span>
            </div>

            {/* Titre de la séance */}
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Feuille d&apos;émargement — {lookups.subjectTitle(slot.subjectId)}
            </h1>

            {/* Métadonnées : date, horaires, salle, formateur */}
            <div className="flex items-center gap-3 sm:gap-4 text-on-surface-variant flex-wrap text-sm pt-1">
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
                {slot.room ? `Salle ${slot.room}` : "Plateau Adapté"}
              </span>
              {seesAll && (
                <>
                  <span className="text-outline" aria-hidden="true">
                    •
                  </span>
                  <span className="flex items-center gap-1.5 text-on-surface font-medium">
                    <User className="h-4 w-4 text-outline shrink-0" aria-hidden="true" />
                    {lookups.personName(slot.trainerId)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Contrôles droits : commutateur de séances + horloge en temps réel */}
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
                  className="bg-surface-container-lowest text-on-surface font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg shadow-xs focus:ring-4 focus:ring-focus-outer focus:outline-none"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.startTime}–{s.endTime} · {lookups.subjectTitle(s.subjectId)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <LiveClock />
          </div>
        </div>
      )}

      {/* 3. KPI / ATTENDANCE METRICS CARDS (Stitch Design Responsive Grid) */}
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
              <span className="text-[11px] sm:text-xs text-status-present mt-0.5 font-medium truncate">Émargés avec succès</span>
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
              <span className="text-[11px] sm:text-xs text-status-late mt-0.5 font-medium truncate">Horodatage consigné</span>
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

      {/* 4. BANDEAU ASSISTANCE ACCESSIBILITÉ & ACTIONS GROUPÉES */}
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
                Touches : <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">P</kbd> Présent,{" "}
                <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">R</kbd> Retard,{" "}
                <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono shadow-xs">A</kbd> Absent.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-end">
            {pending.length > 0 && (
              <ConfirmDialog
                triggerLabel={`Marquer tous présents (${pending.length})`}
                triggerAccessibleLabel={`Marquer présents les ${pending.length} stagiaires non saisis`}
                title="Valider la présence groupée ?"
                description={`Cette action va marquer « Présent » les ${pending.length} stagiaire(s) qui n'ont pas encore d'émargement enregistré pour cette séance.`}
                confirmLabel="Confirmer la présence"
                onConfirm={markAllPresent}
              />
            )}
            {pending.length === 0 && (
              <span className="inline-flex items-center gap-1.5 font-bold text-xs text-status-present bg-status-present-bg px-3 py-2 rounded-xl">
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Tous les stagiaires sont émargés
              </span>
            )}
          </div>
        </div>
      )}

      {/* 5. BARRE DE RECHERCHE & FILTRES */}
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
              placeholder="Filtrer stagiaire (ex: Alexandre, Sophie...)"
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
              { id: "absent" as const, label: `Absents (${absentCount + excusedCount})`, count: absentCount + excusedCount },
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

      {/* 6. TABLEAU DE PRÉSENCE (Design accessible, contrasté, responsive) */}
      {slot && (
        <section
          aria-labelledby="roster-heading"
          className="rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 sm:px-6 py-4 bg-surface-container-low">
            <h2 id="roster-heading" className="text-base sm:text-lg font-bold text-primary">
              Liste d&apos;émargement des stagiaires
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                {filteredTrainees.length} stagiaire{filteredTrainees.length > 1 ? "s" : ""} affiché{filteredTrainees.length > 1 ? "s" : ""}
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

          {/* Vue Tablette & Bureau (>= 768px) : Grand tableau Stitch structuré */}
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
    </div>
  );
}
