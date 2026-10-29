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
  detail: (slot: TimetableSlot) => string;
  detailHeader?: string;
  actions?: (slot: TimetableSlot) => React.ReactNode;
}) {
  const today = todayIso();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {WEEKDAYS.map((day) => {
        const daySlots = slots.filter((s) => s.weekday === day).sort(byStartTime);
        return (
          <section key={day} aria-labelledby={`day-${day}`} className="rounded-lg border-2 border-gray-300 bg-white">
            <h3 id={`day-${day}`} className="border-b-2 border-gray-300 bg-gray-100 px-4 py-2 text-lg font-bold">
              {WEEKDAY_LABELS[day]}
            </h3>
            {daySlots.length === 0 ? (
              <p className="p-4 text-gray-700">Aucun cours.</p>
            ) : (
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Cours du {WEEKDAY_LABELS[day].toLowerCase()}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-3">Horaire</th>
                    <th scope="col" className="p-3">Matière</th>
                    <th scope="col" className="p-3">{detailHeader}</th>
                    {actions && <th scope="col" className="p-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {daySlots.map((s) => {
                    const ended = s.validTo !== null && s.validTo < today;
                    const upcoming = s.validFrom > today;
                    return (
                      <tr key={s.id} className={`border-t-2 border-gray-200 align-top ${ended ? "text-gray-600" : ""}`}>
                        <th scope="row" className="whitespace-nowrap p-3 font-semibold">
                          {s.startTime} – {s.endTime}
                        </th>
                        <td className="p-3">
                          {subjectTitle(s.subjectId)}
                          {s.room && <span className="block text-sm text-gray-700">Salle {s.room}</span>}
                          {ended && <span className="block text-sm font-semibold">Terminé le {formatShortDate(s.validTo!)}</span>}
                          {upcoming && <span className="block text-sm font-semibold">À partir du {formatShortDate(s.validFrom)}</span>}
                        </td>
                        <td className="p-3">{detail(s)}</td>
                        {actions && <td className="p-3">{actions(s)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
