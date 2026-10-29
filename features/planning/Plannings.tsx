"use client";

import { useEffect, useState } from "react";
import { Alert, Loading } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/Field";
import { formatHours, todayIso } from "@/lib/core/dates";
import type { Actor } from "@/lib/data/audit";
import { listSlots } from "@/lib/data/timetable";
import { slotMinutes } from "@/lib/domain/schedule";
import type { TimetableSlot } from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";
import { WeekView } from "@/features/timetable/WeekView";

type View = "trainer" | "formation";

/** Read-only weekly plannings, by trainer or by formation. */
export function Plannings({ actor }: { actor: Actor }) {
  const { data, lookups, error } = useReferenceData();
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [view, setView] = useState<View>(actor.role === "trainer" ? "trainer" : "formation");
  const [trainerId, setTrainerId] = useState(actor.role === "trainer" ? actor.id : "");
  const [formationId, setFormationId] = useState("");

  useEffect(() => {
    listSlots()
      .then(setSlots)
      .catch(() => setSlots([]));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !lookups || !slots) return <Loading />;

  const today = todayIso();
  const current = slots.filter((s) => !s.validTo || s.validTo >= today);
  const teachers = data.staff.filter((u) => current.some((s) => s.trainerId === u.id));
  const selected =
    view === "trainer"
      ? current.filter((s) => s.trainerId === trainerId)
      : current.filter((s) => s.formationId === formationId);
  const minutes = selected.reduce((sum, s) => sum + slotMinutes(s), 0);
  const subjectsTaught = [...new Set(selected.map((s) => lookups.subjectTitle(s.subjectId)))];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <SelectField label="Afficher le planning" value={view} onChange={(e) => setView(e.target.value as View)}>
          <option value="trainer">d&apos;un formateur</option>
          <option value="formation">d&apos;une formation</option>
        </SelectField>
        {view === "trainer" ? (
          <SelectField label="Formateur" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            <option value="">Choisir un formateur</option>
            {teachers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField label="Formation" value={formationId} onChange={(e) => setFormationId(e.target.value)}>
            <option value="">Choisir une formation</option>
            {data.formations
              .filter((f) => f.active !== false)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
          </SelectField>
        )}
      </div>

      {(view === "trainer" ? trainerId : formationId) && (
        <section aria-labelledby="planning-heading" className="flex flex-col gap-3">
          <h2 id="planning-heading" className="text-2xl font-bold">
            {view === "trainer" ? lookups.personName(trainerId) : lookups.formationTitle(formationId)}
          </h2>
          <p>
            {formatHours(minutes / 60)} par semaine
            {subjectsTaught.length > 0 && ` — matières : ${subjectsTaught.join(", ")}`}.
          </p>
          <WeekView
            slots={selected}
            subjectTitle={lookups.subjectTitle}
            detailHeader={view === "trainer" ? "Formation" : "Formateur"}
            detail={(s) => (view === "trainer" ? lookups.formationTitle(s.formationId) : lookups.personName(s.trainerId))}
          />
        </section>
      )}
    </div>
  );
}
