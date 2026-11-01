"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  Keyboard,
  Lock,
  Search,
  Timer,
  TrendingUp,
  Users,
  UserX,
  X,
} from "lucide-react";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  APP_TIME_ZONE,
  formatLongDate,
  isWeekend,
  nowTime,
  todayIso,
} from "@/lib/core/dates";
import { sessionsOn, weekdayOf } from "@/lib/domain/schedule";
import type {
  Attendance,
  AttendanceStatus,
  Formation,
  TimetableSlot,
  UserProfile,
} from "@/lib/domain/types";
import { TraineeCard, TraineeRow, type RowState } from "./TraineeRow";

export type FilterMode = "all" | "pending" | "present" | "late" | "absent";

export const SPOKEN_STATUS: Record<AttendanceStatus, string> = {
  present: "marqué présent",
  absent: "marqué absent",
  late: "marqué en retard",
  excused: "en absence justifiée",
};

export const STORAGE_FORMATION_KEY = "avh_emargement_formation_id";

/** Live clock component showing current time in Europe/Paris timezone */
export function LiveClock() {
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
export function defaultSession(
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

/**
 * Synthesizes all sessions for a given date:
 * combines custom TimetableSlots with the standard 09:00-17:00 daily session
 * for active formations that don't have custom slots on that weekday.
 */
export function buildDaySessions({
  slots,
  date,
  activeFormations,
  defaultTrainerId,
  closedDays,
  formationLookup,
}: {
  slots: TimetableSlot[];
  date: string;
  activeFormations: Formation[];
  defaultTrainerId: string;
  closedDays: Set<string>;
  formationLookup: (id: string) => Formation | undefined;
}): TimetableSlot[] {
  if (isWeekend(date) || closedDays.has(date)) return [];
  const weekday = weekdayOf(date);
  if (!weekday) return [];

  const activeCustomSlots = slots.filter((s) => formationLookup(s.formationId)?.active !== false);
  const configuredOnDate = sessionsOn(activeCustomSlots, date, closedDays);
  const formationsWithCustomSlots = new Set(configuredOnDate.map((s) => s.formationId));

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

  return [...configuredOnDate, ...synthesized];
}

/** Shared banner when the selected date is a weekend or an institution holiday */
export function ClosedOrWeekendBanner({
  date,
  closureTitle,
  prevWorkDay,
  nextWorkDay,
  onSelectDate,
}: {
  date: string;
  closureTitle: string | null;
  prevWorkDay: string;
  nextWorkDay: string;
  onSelectDate: (iso: string) => void;
}) {
  return (
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

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onSelectDate(prevWorkDay)}
          className="w-full sm:w-auto justify-center !min-h-11 !px-4 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Dernier jour ouvré ({formatLongDate(prevWorkDay)})</span>
        </Button>
        <Button
          type="button"
          onClick={() => onSelectDate(nextWorkDay)}
          className="w-full sm:w-auto justify-center !min-h-11 !px-4 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
        >
          <span>Prochain jour ouvré ({formatLongDate(nextWorkDay)})</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

/** Shared 4-card KPI summary for the active session */
export function AttendanceKpiCards({
  totalTrainees,
  presentCount,
  lateCount,
  absentCount,
  excusedCount,
  pendingCount,
  totalLateMinutes,
}: {
  totalTrainees: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  pendingCount: number;
  totalLateMinutes: number;
}) {
  const attendanceRate = totalTrainees > 0 ? Math.round(((presentCount + lateCount) / totalTrainees) * 100) : 0;

  return (
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
            {pendingCount > 0 ? `${pendingCount} non saisis` : "Tous saisis"}
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
  );
}

/** Shared Roster Section: Keyboard shortcuts bar, search & status filter tabs, mobile cards & desktop table */
export function AttendanceRosterSection({
  slot,
  date,
  label,
  formationTitle,
  trainees,
  filteredTrainees,
  records,
  rowState,
  pendingCount,
  presentCount,
  lateCount,
  absentCount,
  excusedCount,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  canModify,
  onMarkAllPresent,
  onSaveSingle,
}: {
  slot: TimetableSlot;
  date: string;
  label: string;
  formationTitle: string;
  trainees: UserProfile[];
  filteredTrainees: UserProfile[];
  records: Record<string, Attendance>;
  rowState: Record<string, RowState>;
  pendingCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  filter: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  canModify: boolean;
  onMarkAllPresent: () => Promise<void>;
  onSaveSingle: (trainee: UserProfile, status: AttendanceStatus, arrivalTime: string | null) => Promise<unknown>;
}) {
  return (
    <>
      {/* BANDEAU ASSISTANCE ACCESSIBILITÉ & ACTIONS GROUPÉES */}
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
          {pendingCount > 0 && canModify && (
            <ConfirmDialog
              triggerLabel={`Marquer tous présents (${pendingCount})`}
              triggerAccessibleLabel={`Marquer présents les ${pendingCount} stagiaires non saisis`}
              title="Valider la présence groupée ?"
              description={`Souhaitez-vous enregistrer la présence des ${pendingCount} stagiaire(s) en attente pour la filière « ${formationTitle} » ? Cette validation simplifiée vous fait gagner du temps tout en garantissant un émargement complet et bienveillant.`}
              confirmLabel="Confirmer la présence"
              onConfirm={onMarkAllPresent}
            />
          )}
          {pendingCount > 0 && !canModify && (
            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Émargement clôturé ({pendingCount} en attente)
            </span>
          )}
          {pendingCount === 0 && (
            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-status-present bg-status-present-bg px-3 py-2 rounded-xl">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Émargement complet : tous les stagiaires sont renseignés
            </span>
          )}
        </div>
      </div>

      {/* BARRE DE RECHERCHE & FILTRES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrer stagiaire (ex: Lamia, Karim, Chloé...)"
            className={`w-full rounded-xl border border-border-subtle bg-surface-container-lowest py-2.5 pl-10 pr-10 text-sm text-on-surface shadow-xs placeholder:text-outline ${focusRing}`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Filtrer les stagiaires par statut"
          className="flex items-center gap-1 bg-surface-container p-1 rounded-xl overflow-x-auto scrollbar-none"
        >
          {[
            { id: "all" as const, label: `Tous (${trainees.length})` },
            { id: "pending" as const, label: `À saisir (${pendingCount})` },
            { id: "present" as const, label: `Présents (${presentCount})` },
            { id: "late" as const, label: `Retards (${lateCount})` },
            {
              id: "absent" as const,
              label: `Absents (${absentCount + excusedCount})`,
            },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onFilterChange(tab.id)}
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

      {/* TABLEAU DE PRÉSENCE */}
      <section
        aria-labelledby="roster-heading"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 sm:px-6 py-4 bg-surface-container-low">
          <h2 id="roster-heading" className="text-base sm:text-lg font-bold text-primary">
            Liste d&apos;émargement — {formationTitle}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant">
              {filteredTrainees.length} stagiaire{filteredTrainees.length > 1 ? "s" : ""} affiché
              {filteredTrainees.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Vue Mobile (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-3">
          {filteredTrainees.map((trainee) => (
            <TraineeCard
              key={trainee.id}
              trainee={trainee}
              slot={slot}
              date={date}
              record={records[trainee.id]}
              state={rowState[trainee.id] ?? "idle"}
              onSave={onSaveSingle}
              readOnly={!canModify}
            />
          ))}
          {filteredTrainees.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-on-surface-variant bg-surface-container-lowest rounded-xl border border-border-subtle">
              {searchQuery
                ? `Aucun stagiaire ne correspond à « ${searchQuery} ». N'hésitez pas à vérifier l'orthographe ou à réinitialiser le filtre.`
                : "Aucun stagiaire à afficher dans cette catégorie pour le moment. Tout est en ordre !"}
            </div>
          )}
        </div>

        {/* Vue Tablette & Bureau (>= 768px) */}
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
                  onSave={onSaveSingle}
                  readOnly={!canModify}
                />
              ))}
              {filteredTrainees.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm font-semibold text-on-surface-variant">
                    {searchQuery
                      ? `Aucun stagiaire ne correspond à « ${searchQuery} ». N'hésitez pas à vérifier l'orthographe ou à réinitialiser le filtre.`
                      : "Aucun stagiaire à afficher dans cette catégorie pour le moment. Tout est en ordre !"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
