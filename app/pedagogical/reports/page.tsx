"use client";

import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { authFetch, downloadBlob, fileNameFromResponse } from "@/lib/apiClient";
import { currentMonth, formatHours, formatMonth, formatShortDate, monthBounds, todayIso } from "@/lib/dates";
import { listAttendancesForPeriod, listCourses, listHolidays, listUsersByIds } from "@/lib/firestore";
import { computeMonthlyReport, type MonthlyReport } from "@/lib/hoursCalculator";
import { rolesFor } from "@/lib/navigation";
import type { Course } from "@/lib/types";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Rapports mensuels"
        description="Heures théoriques, présence effective, absences et retards par stagiaire. Les week-ends, jours fériés et périodes de fermeture sont exclus automatiquement."
      />
      <RoleGuard roles={rolesFor("/pedagogical/reports")}>{() => <MonthlyReports />}</RoleGuard>
    </>
  );
}

function MonthlyReports() {
  const announce = useAnnounce();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [monthNumber, setMonthNumber] = useState(currentMonth().slice(5, 7));
  // Result of the last calculation, tagged with the course and month it belongs to.
  const [result, setResult] = useState<{ key: string; report?: MonthlyReport; error?: string } | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const month = `${year}-${monthNumber}`;
  const course = courses?.find((c) => c.id === courseId) ?? null;
  const key = course ? `${course.id}|${month}` : null;
  const current = result && result.key === key ? result : null;
  const report = current?.report ?? null;
  const loading = key !== null && !current;

  useEffect(() => {
    listCourses()
      .then((courses) => {
        setCourses(courses);
        if (courses.length === 1) setCourseId(courses[0].id);
      })
      .catch(() => setError("Impossible de charger les formations."));
  }, []);

  useEffect(() => {
    if (!course || !key) return;
    let stale = false;
    const { start, end } = monthBounds(month);
    Promise.all([
      listUsersByIds(course.traineeIds ?? []),
      listAttendancesForPeriod(course.id, start, end),
      listHolidays(),
    ])
      .then(([trainees, attendances, holidays]) => {
        if (stale) return;
        const report = computeMonthlyReport({ month, course, trainees, attendances, holidays, today: todayIso() });
        setResult({ key, report });
        announce(
          `Rapport de ${formatMonth(month)} calculé : ${report.trainees.length} stagiaires, ${formatHours(report.theoreticalHours)} théoriques chacun.`,
        );
      })
      .catch(() => !stale && setResult({ key, error: "Le calcul du rapport a échoué." }));
    return () => {
      stale = true;
    };
  }, [course, key, month, announce]);

  const exportReport = async (format: "pdf" | "excel") => {
    if (!report) return;
    setExporting(format);
    try {
      const response = await authFetch(`/api/export-${format}`, { report });
      const extension = format === "pdf" ? "pdf" : "xlsx";
      downloadBlob(await response.blob(), fileNameFromResponse(response, `emargement-${month}.${extension}`));
      announce(`Export ${format === "pdf" ? "PDF" : "Excel"} téléchargé.`);
    } catch (e) {
      announce(`Échec de l'export : ${(e as Error).message}`, "assertive");
    } finally {
      setExporting(null);
    }
  };

  if (!courses) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  const thisYear = Number(currentMonth().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(thisYear - 4 + i));

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="filters-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="filters-heading" className="mb-4 text-xl font-bold">
          Période et formation
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Formation" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Choisir une formation</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="Mois" value={monthNumber} onChange={(e) => setMonthNumber(e.target.value)}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={String(i + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Année" value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {current?.error && <Alert tone="error">{current.error}</Alert>}
      {loading && <Loading label="Calcul du rapport en cours…" />}

      {report && !loading && (
        <section aria-labelledby="report-heading" className="flex flex-col gap-4">
          <h2 id="report-heading" className="text-2xl font-bold">
            {report.courseTitle} — {formatMonth(report.month)}
          </h2>
          <dl className="grid gap-3 rounded-lg border-2 border-gray-300 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-gray-700">Jours de formation</dt>
              <dd className="text-2xl font-bold">{report.workingDays.length}</dd>
            </div>
            <div>
              <dt className="text-gray-700">Jours de fermeture exclus</dt>
              <dd className="text-2xl font-bold">{report.closedDays.length}</dd>
            </div>
            <div>
              <dt className="text-gray-700">Heures théoriques par stagiaire</dt>
              <dd className="text-2xl font-bold">{formatHours(report.theoreticalHours)}</dd>
            </div>
            <div>
              <dt className="text-gray-700">Total des absences</dt>
              <dd className="text-2xl font-bold">{formatHours(report.totals.totalAbsenceHours)}</dd>
            </div>
          </dl>
          {report.closedDays.length > 0 && (
            <p>Jours fermés : {report.closedDays.map(formatShortDate).join(", ")}.</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => exportReport("pdf")} disabled={exporting !== null}>
              {exporting === "pdf" ? "Génération du PDF…" : "Exporter en PDF (financeurs)"}
            </Button>
            <Button variant="secondary" onClick={() => exportReport("excel")} disabled={exporting !== null}>
              {exporting === "excel" ? "Génération du fichier Excel…" : "Exporter en Excel (RH)"}
            </Button>
          </div>

          {report.trainees.length === 0 ? (
            <Alert tone="info">Aucun stagiaire inscrit dans cette formation.</Alert>
          ) : (
            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
              <table className="w-full border-collapse text-left">
                <caption className="p-3 text-left font-semibold">
                  Heures par stagiaire, {formatMonth(report.month)}
                </caption>
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="p-3">Stagiaire</th>
                    <th scope="col" className="p-3">Présence effective</th>
                    <th scope="col" className="p-3">Absences non justifiées</th>
                    <th scope="col" className="p-3">Absences justifiées</th>
                    <th scope="col" className="p-3">Retards</th>
                    <th scope="col" className="p-3">Total absences</th>
                    <th scope="col" className="p-3">Taux de présence</th>
                    <th scope="col" className="p-3">Jours non saisis</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trainees.map((t) => (
                    <tr key={t.traineeId} className="border-t-2 border-gray-200">
                      <th scope="row" className="p-3 font-semibold">{t.fullName}</th>
                      <td className="p-3">{formatHours(t.effectivePresenceHours)}</td>
                      <td className="p-3">
                        {formatHours(t.absentHours)} ({t.absentDays} j)
                      </td>
                      <td className="p-3">
                        {formatHours(t.excusedHours)} ({t.excusedDays} j)
                      </td>
                      <td className="p-3">
                        {t.lateCount} ({t.lateMinutes} min)
                      </td>
                      <td className="p-3">{formatHours(t.totalAbsenceHours)}</td>
                      <td className="p-3">{(t.attendanceRate * 100).toFixed(1)} %</td>
                      <td className={`p-3 ${t.unrecordedDays ? "font-semibold text-amber-900" : ""}`}>
                        {t.unrecordedDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-gray-800">
            Les jours non saisis (sans émargement) sont comptés comme présents dans ce calcul : vérifiez-les avant
            d&apos;envoyer un relevé.
          </p>
        </section>
      )}
    </div>
  );
}
