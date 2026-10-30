import { Calendar } from "lucide-react";
import { formatShortDate, todayIso } from "@/lib/core/dates";
import { byStartTime } from "@/lib/domain/schedule";
import { WEEKDAYS, WEEKDAY_LABELS, type TimetableSlot } from "@/lib/domain/types";

/**
 * Weekly timetable as one table per weekday: easier to browse with a screen
 * reader than a visual grid (headings to jump from day to day).
 */
export function WeekView({
  slots,
  subjectTitle,
  detail,
  detailHeader = "Formateur",
  actions,
}: {
  slots: TimetableSlot[];
  subjectTitle: (id: string) => string;
  detail: (slot: TimetableSlot) => React.ReactNode;
  detailHeader?: string;
  actions?: (slot: TimetableSlot) => React.ReactNode;
}) {
  const today = todayIso();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {WEEKDAYS.map((day) => {
        const daySlots = slots.filter((s) => s.weekday === day).sort(byStartTime);
        return (
          <section key={day} aria-labelledby={`day-${day}`} className="rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs overflow-hidden">
            <h3 id={`day-${day}`} className="border-b border-border-subtle bg-surface-container px-4 py-2.5 text-base font-bold text-primary flex items-center gap-2">
              <Calendar className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span>{WEEKDAY_LABELS[day]}</span>
            </h3>
            {daySlots.length === 0 ? (
              <p className="p-4 text-sm text-on-surface-variant">Aucun cours programmé ce jour.</p>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label={`Emploi du temps du ${WEEKDAY_LABELS[day].toLowerCase()}`}
                className="overflow-x-auto focus:outline-none focus:ring-4 focus:ring-focus-outer"
              >
                <table className="w-full border-collapse text-left text-sm min-w-[460px]">
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
                        <tr key={s.id} className={`align-top hover:bg-surface-container-low transition-colors ${ended ? "text-outline opacity-60" : ""}`}>
                          <th scope="row" className="whitespace-nowrap p-3 font-mono font-bold text-primary">
                            {s.startTime} – {s.endTime}
                          </th>
                          <td className="p-3">
                            <span className="font-semibold text-on-surface">{subjectTitle(s.subjectId)}</span>
                            {s.room && <span className="block text-xs text-secondary font-medium mt-0.5">Salle {s.room}</span>}
                            {ended && <span className="block text-xs font-semibold text-status-late mt-0.5">Terminé le {formatShortDate(s.validTo!)}</span>}
                            {upcoming && <span className="block text-xs font-semibold text-status-present mt-0.5">À partir du {formatShortDate(s.validFrom)}</span>}
                          </td>
                          <td className="p-3 text-on-surface-variant font-medium">{detail(s)}</td>
                          {actions && <td className="p-3 text-right">{actions(s)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
