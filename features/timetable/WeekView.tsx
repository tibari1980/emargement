import { Calendar, Clock, MapPin } from "lucide-react";
import { addDays, formatDayAndMonth, formatShortDate, todayIso } from "@/lib/core/dates";
import { byStartTime, isSlotActiveOn } from "@/lib/domain/schedule";
import { WEEKDAYS, WEEKDAY_LABELS, type TimetableSlot } from "@/lib/domain/types";

/**
 * Weekly timetable as one section per weekday:
 * - On mobile (< 768px): ergonomic stacked cards per slot (zero horizontal scroll).
 * - On tablet & desktop (>= 768px): structured accessible table per weekday.
 * - Supports calendar week view (with actual dates and public holiday indicators).
 */
export function WeekView({
  slots,
  subjectTitle,
  detail,
  detailHeader = "Formateur",
  actions,
  weekMonday,
  closedDays,
  closureTitle,
}: {
  slots: TimetableSlot[];
  subjectTitle: (id: string) => string;
  detail: (slot: TimetableSlot) => React.ReactNode;
  detailHeader?: string;
  actions?: (slot: TimetableSlot) => React.ReactNode;
  weekMonday?: string;
  closedDays?: Set<string>;
  closureTitle?: (iso: string) => string | null;
}) {
  const today = todayIso();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {WEEKDAYS.map((day) => {
        const dayDate = weekMonday ? addDays(weekMonday, day - 1) : null;
        const isClosed = Boolean(dayDate && closedDays?.has(dayDate));
        const holidayTitle = isClosed && closureTitle && dayDate ? closureTitle(dayDate) : null;
        const dayLabel = dayDate
          ? `${WEEKDAY_LABELS[day]} (${formatDayAndMonth(dayDate)})`
          : WEEKDAY_LABELS[day];

        const daySlots = (dayDate
          ? slots.filter((s) => isSlotActiveOn(s, dayDate))
          : slots.filter((s) => s.weekday === day)
        ).sort(byStartTime);

        return (
          <section
            key={day}
            aria-labelledby={`day-${day}`}
            className="rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden"
          >
            <h3
              id={`day-${day}`}
              className="border-b border-border-subtle bg-surface-container px-4 py-2.5 text-base font-bold text-primary flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>{dayLabel}</span>
              </span>
              {isClosed ? (
                <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  Férié
                </span>
              ) : daySlots.length > 0 ? (
                <span className="text-xs font-semibold text-on-surface-variant">
                  {daySlots.length} créneau{daySlots.length > 1 ? "x" : ""}
                </span>
              ) : null}
            </h3>

            {isClosed && (
              <div className="p-3.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <span>Jour férié / Fermeture : {holidayTitle || "Jour férié"}</span>
                <span className="text-[11px] opacity-80">(aucun cours tenu ce jour)</span>
              </div>
            )}

            {daySlots.length === 0 ? (
              !isClosed && <p className="p-4 text-sm text-on-surface-variant">Aucun cours programmé ce jour.</p>
            ) : (
              <>
                {/* Vue Cartes sur Smartphone (< 768px) */}
                <div className="md:hidden divide-y divide-border-subtle">
                  {daySlots.map((s) => {
                    const ended = s.validTo !== null && s.validTo < today;
                    const upcoming = s.validFrom > today;
                    return (
                      <article
                        key={s.id}
                        className={`p-3.5 flex flex-col gap-2 ${ended ? "opacity-60" : ""}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-2.5 py-1 font-mono text-xs font-bold text-primary">
                            <Clock className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
                            <span>
                              {s.startTime} – {s.endTime}
                            </span>
                          </span>
                          {s.room && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container-low border border-border-subtle px-2 py-0.5 text-xs font-semibold text-secondary">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>Salle {s.room}</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-sm text-on-surface leading-snug">
                            {subjectTitle(s.subjectId)}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            <span className="font-semibold text-primary">{detailHeader} : </span>
                            {detail(s)}
                          </p>
                          {ended && (
                            <span className="inline-block text-xs font-semibold text-status-late mt-1">
                              Terminé le {formatShortDate(s.validTo!)}
                            </span>
                          )}
                          {upcoming && (
                            <span className="inline-block text-xs font-semibold text-status-present mt-1">
                              À partir du {formatShortDate(s.validFrom)}
                            </span>
                          )}
                        </div>

                        {actions && (
                          <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center justify-end gap-2">
                            {actions(s)}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                {/* Vue Tableau sur Tablette & Ordinateur (>= 768px) */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label={`Emploi du temps du ${WEEKDAY_LABELS[day].toLowerCase()}`}
                  className="hidden md:block overflow-x-auto focus:outline-none focus:ring-4 focus:ring-focus-outer"
                >
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Cours du {WEEKDAY_LABELS[day].toLowerCase()}</caption>
                    <thead className="border-b border-border-subtle bg-surface-container-low text-xs font-bold uppercase text-on-surface">
                      <tr>
                        <th scope="col" className="p-3">Horaire</th>
                        <th scope="col" className="p-3">Matière</th>
                        <th scope="col" className="p-3">{detailHeader}</th>
                        {actions && <th scope="col" className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {daySlots.map((s) => {
                        const ended = s.validTo !== null && s.validTo < today;
                        const upcoming = s.validFrom > today;
                        return (
                          <tr
                            key={s.id}
                            className={`align-top hover:bg-surface-container-low transition-colors ${ended ? "text-outline opacity-60" : ""}`}
                          >
                            <th scope="row" className="whitespace-nowrap p-3 font-mono font-bold text-primary">
                              {s.startTime} – {s.endTime}
                            </th>
                            <td className="p-3">
                              <span className="font-semibold text-on-surface">{subjectTitle(s.subjectId)}</span>
                              {s.room && (
                                <span className="block text-xs text-secondary font-medium mt-0.5">
                                  Salle {s.room}
                                </span>
                              )}
                              {ended && (
                                <span className="block text-xs font-semibold text-status-late mt-0.5">
                                  Terminé le {formatShortDate(s.validTo!)}
                                </span>
                              )}
                              {upcoming && (
                                <span className="block text-xs font-semibold text-status-present mt-0.5">
                                  À partir du {formatShortDate(s.validFrom)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-on-surface-variant font-medium">{detail(s)}</td>
                            {actions && <td className="p-3 text-right">{actions(s)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
