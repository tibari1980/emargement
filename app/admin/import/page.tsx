"use client";

import { useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { RoleGuard } from "@/components/RoleGuard";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseTraineeFile, type TraineeParseResult } from "@/lib/csvParser";
import { importTrainees, listCourses } from "@/lib/firestore";
import { rolesFor } from "@/lib/navigation";
import type { Course } from "@/lib/types";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import de stagiaires"
        description="Inscrivez un groupe de stagiaires dans une formation à partir d'un fichier CSV ou Excel (.xlsx)."
      />
      <RoleGuard roles={rolesFor("/admin/import")}>{() => <TraineeImport />}</RoleGuard>
    </>
  );
}

function TraineeImport() {
  const announce = useAnnounce();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<TraineeParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    listCourses().then(setCourses).catch(() => setError("Impossible de charger les formations."));
  }, []);

  const course = courses?.find((c) => c.id === courseId) ?? null;

  const handleFile = async (file: File | undefined) => {
    setDone(null);
    setError(null);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = await parseTraineeFile(file);
      setResult(parsed);
      announce(
        `Fichier analysé : ${parsed.trainees.length} stagiaire${parsed.trainees.length > 1 ? "s" : ""} prêt${parsed.trainees.length > 1 ? "s" : ""} à importer, ${parsed.errors.length} ligne${parsed.errors.length > 1 ? "s" : ""} en erreur.`,
      );
      setTimeout(() => previewHeading.current?.focus(), 0);
    } catch {
      setError("Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier CSV ou Excel valide.");
    }
  };

  const confirmImport = async () => {
    if (!course || !result?.trainees.length) return;
    setBusy(true);
    setError(null);
    try {
      const { created, reused } = await importTrainees(course.id, course.sector, result.trainees);
      const message = `${created + reused} stagiaires inscrits en « ${course.title} » : ${created} nouveaux, ${reused} déjà connus.`;
      setDone(message);
      announce(message);
      setResult(null);
      setFileName("");
      if (fileInput.current) fileInput.current.value = "";
      setCourses(await listCourses());
    } catch {
      setError("L'import a échoué. Aucune donnée n'a été perdue : vous pouvez relancer l'import.");
    } finally {
      setBusy(false);
    }
  };

  if (!courses) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="format-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="format-heading" className="mb-2 text-xl font-bold">
          Format attendu
        </h2>
        <p>La première ligne du fichier contient les titres de colonnes :</p>
        <ul className="ml-6 mt-2 list-disc">
          <li>
            <strong>Nom</strong> et <strong>Prénom</strong> (ou une seule colonne <strong>Nom complet</strong>) —
            obligatoire ;
          </li>
          <li>
            <strong>Email</strong> — facultatif, permet d&apos;éviter les doublons entre plusieurs imports.
          </li>
        </ul>
        <p className="mt-2">Les fichiers CSV peuvent utiliser la virgule ou le point-virgule comme séparateur.</p>
      </section>

      {done && <Alert tone="success">{done}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <section aria-labelledby="upload-heading" className="flex flex-col gap-4 rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="upload-heading" className="text-xl font-bold">
          Fichier et formation
        </h2>
        <SelectField label="Formation de destination" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Choisir une formation</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.traineeIds?.length ?? 0} inscrits)
            </option>
          ))}
        </SelectField>
        <div className="flex flex-col gap-1">
          <label htmlFor="import-file" className="font-semibold">
            Fichier des stagiaires (.csv ou .xlsx)
          </label>
          <input
            ref={fileInput}
            id="import-file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className={`rounded-md border-2 border-gray-700 bg-white p-2 file:mr-4 file:rounded file:border-0 file:bg-blue-800 file:px-4 file:py-2 file:font-semibold file:text-white ${focusRing}`}
          />
        </div>
      </section>

      {result && (
        <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
          <h2 id="preview-heading" ref={previewHeading} tabIndex={-1} className="text-xl font-bold outline-none">
            Aperçu de « {fileName} »
          </h2>
          <p className="text-lg">
            {result.trainees.length} stagiaire(s) valide(s), {result.errors.length} ligne(s) en erreur.
          </p>

          {result.errors.length > 0 && (
            <Alert tone="warning">
              <h3 className="font-bold">Lignes ignorées</h3>
              <ul className="ml-6 mt-2 list-disc">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.line > 0 ? `Ligne ${e.line} : ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {result.trainees.length > 0 && (
            <>
              <div className="max-h-96 overflow-auto rounded-lg border-2 border-gray-300 bg-white">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Stagiaires qui seront importés</caption>
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th scope="col" className="p-3">Ligne</th>
                      <th scope="col" className="p-3">Nom complet</th>
                      <th scope="col" className="p-3">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trainees.map((t) => (
                      <tr key={t.line} className="border-t-2 border-gray-200">
                        <td className="p-3">{t.line}</td>
                        <th scope="row" className="p-3 font-semibold">{t.fullName}</th>
                        <td className="p-3">{t.email ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!course && <Alert tone="info">Choisissez la formation de destination pour lancer l&apos;import.</Alert>}
              <div>
                <Button onClick={confirmImport} disabled={!course || busy}>
                  {busy
                    ? "Import en cours…"
                    : `Inscrire ${result.trainees.length} stagiaire(s)${course ? ` en « ${course.title} »` : ""}`}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
