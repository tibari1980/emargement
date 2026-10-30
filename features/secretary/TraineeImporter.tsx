"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { ImportGuide } from "@/components/ImportGuide";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button, focusRing } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField } from "@/components/ui/Field";
import type { Actor } from "@/lib/data/audit";
import {
  cleanDuplicateFormationsInDb,
  clearFormationTrainees,
  groupFormations,
  importTrainees,
  listFormations,
  purgeAllTrainees,
  repairFormationDurations,
  syncCatalogFormations,
} from "@/lib/data/formations";
import { parseTraineeFile, type ParsedTrainee, type TraineeParseResult } from "@/lib/domain/csvParser";
import { downloadTraineeCsvTemplate, downloadTraineeExcelTemplate } from "@/lib/domain/templates";
import type { Formation } from "@/lib/domain/types";

export function TraineeImporter({ actor }: { actor: Actor }) {
  const announce = useAnnounce();
  const searchParams = useSearchParams();
  const initialFormationId = searchParams.get("formationId") || "";

  const [formations, setFormations] = useState<Formation[] | null>(null);
  const [formationId, setFormationId] = useState(initialFormationId);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [result, setResult] = useState<TraineeParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const maintenanceRanRef = useRef(false);

  // Background auto-maintenance: deduplicate formations and ensure durations are persisted
  useEffect(() => {
    if (maintenanceRanRef.current) return;
    maintenanceRanRef.current = true;
    Promise.all([
      cleanDuplicateFormationsInDb(actor),
      repairFormationDurations(actor),
    ])
      .then(([{ cleanedCount }, { updatedCount }]) => {
        if (cleanedCount > 0 || updatedCount > 0) {
          listFormations(true).then((fresh) => setFormations(fresh)).catch(() => {});
        }
      })
      .catch((err) => console.warn("Import maintenance:", err));
  }, [actor]);

  useEffect(() => {
    let stale = false;
    listFormations()
      .then((fList) => {
        if (!stale) {
          setFormations(fList);
          if (!formationId && initialFormationId) {
            setFormationId(initialFormationId);
          }
        }
      })
      .catch((err) => {
        console.warn("Import: listFormations failed", err);
        if (!stale) setFormations([]);
      });
    return () => {
      stale = true;
    };
  }, [initialFormationId, formationId]);

  const formation = formations?.find((f) => f.id === formationId) ?? null;
  const groupedFormations = formations ? groupFormations(formations) : [];
  const hasMultiYearFormations = Boolean(
    formations?.some(
      (f) =>
        f.active !== false &&
        (f.yearLevel || f.title.includes("1ère année") || f.title.includes("2ème année") || f.title.includes("K1"))
    )
  );

  const handleFile = async (file: File | undefined) => {
    setDone(null);
    setError(null);
    setResult(null);
    if (!file) {
      setFileName("");
      setFileSize(null);
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const parsed = await parseTraineeFile(file);
      setResult(parsed);
      announce(
        `Fichier analysé : ${parsed.trainees.length} stagiaire${parsed.trainees.length > 1 ? "s" : ""} valide${parsed.trainees.length > 1 ? "s" : ""}, ${parsed.errors.length} ligne${parsed.errors.length > 1 ? "s" : ""} en anomalie.`,
      );
      setTimeout(() => previewHeading.current?.focus(), 50);
    } catch {
      setError("Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier .csv ou .xlsx valide.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const resetFile = () => {
    setFileName("");
    setFileSize(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDownloadCsv = () => {
    try {
      downloadTraineeCsvTemplate();
      announce("Modèle CSV téléchargé.");
    } catch {
      announce("Erreur lors du téléchargement du modèle CSV.", "assertive");
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await downloadTraineeExcelTemplate();
      announce("Modèle Excel (.xlsx) téléchargé.");
    } catch {
      announce("Erreur lors du téléchargement du modèle Excel.", "assertive");
    } finally {
      setDownloadingExcel(false);
    }
  };

  const confirmImport = async () => {
    if (!formation || !result?.trainees.length) return;
    setBusy(true);
    setError(null);
    try {
      const { created, reused } = await importTrainees(actor, formation, result.trainees, { replaceExisting });
      const message = `${created + reused} stagiaires inscrits en « ${formation.title} » (${created} nouveau${created > 1 ? "x" : ""}, ${reused} déjà existant${reused > 1 ? "s" : ""}).`;
      setDone(message);
      announce(message);
      resetFile();
      setFormations(await listFormations());
    } catch {
      setError("L'import a échoué. Aucune donnée n'a été perdue : vous pouvez relancer l'import.");
    } finally {
      setBusy(false);
    }
  };

  if (!formations) return error ? <Alert tone="error">{error}</Alert> : <Loading label="Chargement des formations..." />;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1048576).toFixed(1)} Mo`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Guide interactif pas-à-pas avec téléchargement des modèles */}
      <ImportGuide />

      {done && (
        <Alert tone="success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
            <span className="font-semibold">{done}</span>
          </div>
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* 2. Zone de sélection de la formation et dépôt de fichier */}
      <section
        aria-labelledby="upload-heading"
        className="flex flex-col gap-5 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <h2 id="upload-heading" className="text-xl font-bold text-primary flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            <span>Sélection du fichier et de la formation</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">Modèles vierges :</span>
            <Button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              variant="secondary"
              className="!min-h-9 !px-2.5 text-xs inline-flex items-center gap-1.5 rounded-xl text-primary"
              aria-label="Télécharger le modèle Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#0f6f43]" aria-hidden="true" />
              <span>{downloadingExcel ? "…" : "Modèle .xlsx"}</span>
            </Button>
            <Button
              onClick={handleDownloadCsv}
              variant="secondary"
              className="!min-h-9 !px-2.5 text-xs inline-flex items-center gap-1.5 rounded-xl text-primary"
              aria-label="Télécharger le modèle CSV"
            >
              <FileText className="h-4 w-4 text-secondary" aria-hidden="true" />
              <span>Modèle .csv</span>
            </Button>
          </div>
        </div>

        {/* Alerte / Raccourci pour activer les promotions par année si elles manquent */}
        {!hasMultiYearFormations && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border-2 border-secondary/40 bg-surface-container-low shadow-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
                <h3 className="font-bold text-base text-primary">Promotions par année (1ère année, 2ème année, Kiné K1-K4...)</h3>
              </div>
              <p className="text-xs text-on-surface-variant max-w-2xl">
                Votre base contient des formations génériques sans distinction de promotion. Activez en un clic les promotions réelles du CFRP Valentin Haüy pour pouvoir inscrire les stagiaires spécifiquement en <strong>1ère année</strong> ou en <strong>2ème année</strong>.
              </p>
            </div>
            <Button
              variant="primary"
              className="!min-h-10 !px-4 text-xs font-bold shrink-0 inline-flex items-center gap-2"
              onClick={async () => {
                setBusy(true);
                try {
                  await syncCatalogFormations(actor);
                  const fresh = await listFormations();
                  setFormations(fresh);
                  announce("Promotions 1ère et 2ème année activées avec succès.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? "Activation…" : "Activer les promotions du CFRP"}</span>
            </Button>
          </div>
        )}

        {/* Sélection de la formation */}
        <div className="max-w-2xl flex flex-col gap-3">
          <SelectField
            label="Formation et promotion de destination"
            value={formationId}
            onChange={(e) => setFormationId(e.target.value)}
            required
            hint="Choisissez la promotion exacte (1ère année, 2ème année...) dans laquelle inscrire les stagiaires."
          >
            <option value="">-- Sélectionnez une promotion de destination --</option>
            {groupedFormations.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({f.traineeIds?.length ?? 0} stagiaires actuels)
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>

          {/* Action pour vider les stagiaires de la formation sélectionnée */}
          {formation && (formation.traineeIds?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-surface-container-low text-xs">
              <span className="text-on-surface">
                Cette formation compte actuellement <strong>{formation.traineeIds?.length} stagiaire(s)</strong>.
              </span>
              <ConfirmDialog
                triggerLabel={`Vider les ${formation.traineeIds?.length} stagiaire(s)`}
                triggerAccessibleLabel={`Vider les stagiaires de ${formation.title}`}
                title="Vider les stagiaires actuels ?"
                description={`Supprimer tous les stagiaires actuellement inscrits en « ${formation.title} » pour repartir d'une liste vierge (0 stagiaire) avant votre nouvel import ?`}
                confirmLabel="Vider la formation"
                onConfirm={async () => {
                  await clearFormationTrainees(actor, formation);
                  const fresh = await listFormations();
                  setFormations(fresh);
                  announce(`Les stagiaires de ${formation.title} ont été réinitialisés à 0.`);
                }}
              />
            </div>
          )}

          {/* Action globale de purge pour supprimer toutes les données de test */}
          {formations.some((f) => (f.traineeIds?.length ?? 0) > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-secondary/30 bg-surface-container-low text-xs">
              <span className="text-on-surface">
                Vous souhaitez supprimer tous les stagiaires de test existants de toutes les formations ?
              </span>
              <ConfirmDialog
                triggerLabel="Purger toutes les données fictives"
                triggerAccessibleLabel="Purger tous les stagiaires de test de toutes les formations"
                title="Purger toutes les données de test ?"
                description="Cette action va vider la liste des stagiaires de toutes les formations (remise à zéro) et supprimer les profils de stagiaires fictifs de la base de données. Les comptes du personnel (administrateur, formateurs, secrétariat) sont préservés."
                confirmLabel="Purger et remettre à zéro"
                onConfirm={async () => {
                  const res = await purgeAllTrainees(actor);
                  const fresh = await listFormations();
                  setFormations(fresh);
                  announce(`Purge terminée : ${res.formationsReset} formations réinitialisées, ${res.traineesDeleted} stagiaires supprimés.`);
                }}
              />
            </div>
          )}
        </div>

        {/* Zone de glisser-déposer de fichier */}
        <div className="flex flex-col gap-2">
          <span className="font-bold text-primary text-sm">
            Fichier des stagiaires (.csv ou .xlsx) <span className="text-status-absent">*</span>
          </span>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
              isDragging
                ? "border-secondary bg-secondary-fixed/30"
                : fileName
                  ? "border-status-present/60 bg-status-present-bg/20"
                  : "border-border-strong bg-surface-container-low hover:border-secondary hover:bg-surface-container"
            }`}
          >
            <input
              ref={fileInput}
              id="import-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="sr-only"
            />

            {fileName ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-status-present-bg text-status-present shadow-xs">
                  <FileCheck2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold text-primary text-base sm:text-lg break-all">
                    {fileName}
                  </p>
                  {fileSize && (
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                      Taille : {formatBytes(fileSize)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <label
                    htmlFor="import-file"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-surface-container px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-high transition-colors focus:ring-2 focus:ring-focus-outer"
                  >
                    <span>Changer de fichier</span>
                  </label>
                  <Button
                    variant="secondary"
                    onClick={resetFile}
                    className="!min-h-8 !px-3 text-xs text-status-absent inline-flex items-center gap-1 rounded-xl"
                    aria-label="Supprimer le fichier sélectionné"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Retirer</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-secondary shadow-xs">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <label
                    htmlFor="import-file"
                    className="cursor-pointer font-bold text-secondary hover:underline focus:outline-none focus:ring-2 focus:ring-focus-outer rounded-md text-base"
                  >
                    Cliquez pour choisir un fichier
                  </label>{" "}
                  <span className="text-on-surface-variant text-sm">ou glissez-déposez ici</span>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Formats acceptés : <strong>.xlsx</strong> (Microsoft Excel) ou <strong>.csv</strong> (séparateur virgule ou point-virgule)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Aperçu des données détectées avant confirmation */}
      {result && (
        <section
          aria-labelledby="preview-heading"
          className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div>
              <h2
                id="preview-heading"
                ref={previewHeading}
                tabIndex={-1}
                className="text-xl font-bold text-primary outline-none"
              >
                Aperçu : {fileName}
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-0.5">
                <strong className="text-status-present">{result.trainees.length} stagiaire(s) valide(s)</strong> prêt(s) à être inscrit(s).
                {result.errors.length > 0 && (
                  <span className="text-status-absent ml-2">
                    ({result.errors.length} ligne(s) non prise(s) en compte)
                  </span>
                )}
              </p>
            </div>

            {formation && (
              <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-surface-container text-primary">
                Destination : <strong>{formation.title}</strong>
              </div>
            )}
          </div>

          {result.errors.length > 0 && (
            <Alert tone="warning">
              <h3 className="font-bold text-sm mb-1">Lignes ignorées ou invalides</h3>
              <ul className="ml-5 list-disc text-xs space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.line > 0 ? `Ligne ${e.line} : ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {result.trainees.length > 0 ? (
            <>
              <div
                tabIndex={0}
                role="region"
                aria-label={`Aperçu des ${result.trainees.length} stagiaires à inscrire`}
                className="max-h-96 overflow-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
              >
                <table className="w-full border-collapse text-left text-sm min-w-[500px]">
                  <caption className="sr-only">Liste des stagiaires à inscrire</caption>
                  <thead className="sticky top-0 border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
                    <tr>
                      <th scope="col" className="p-3 sm:p-4 w-16">Ligne</th>
                      <th scope="col" className="p-3 sm:p-4">Stagiaire</th>
                      <th scope="col" className="p-3 sm:p-4">Adresse email</th>
                      <th scope="col" className="p-3 sm:p-4 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {result.trainees.map((t: ParsedTrainee) => (
                      <tr key={t.line} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3 sm:p-4 font-mono text-xs text-outline">{t.line}</td>
                        <th scope="row" className="p-3 sm:p-4 font-bold text-on-surface">
                          {t.fullName}
                        </th>
                        <td className="p-3 sm:p-4 text-on-surface-variant font-medium text-xs sm:text-sm">
                          {t.email ?? <span className="text-outline italic">Non renseigné</span>}
                        </td>
                        <td className="p-3 sm:p-4 text-right">
                          <span className="inline-flex rounded-full bg-status-present-bg px-2.5 py-0.5 text-xs font-bold text-status-present">
                            Prêt
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {formation && (formation.traineeIds?.length ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-subtle bg-surface-container-low">
                  <input
                    type="checkbox"
                    id="replace-existing-trainees"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="h-5 w-5 rounded border-outline text-primary focus:ring-focus-outer cursor-pointer"
                  />
                  <label htmlFor="replace-existing-trainees" className="text-sm text-on-surface cursor-pointer select-none">
                    <strong>Remplacer les {formation.traineeIds?.length} stagiaire(s) actuels</strong> par les {result.trainees.length} du fichier (remise à zéro de la promotion avant import).
                  </label>
                </div>
              )}

              {!formation && (
                <Alert tone="info">
                  Veuillez choisir la <strong>formation de destination</strong> ci-dessus pour activer le bouton d&apos;inscription.
                </Alert>
              )}

              <div className="pt-2">
                <Button
                  onClick={confirmImport}
                  disabled={!formation || busy}
                  className="min-h-12 !px-6 text-sm font-bold shadow-sm"
                >
                  {busy
                    ? "Inscription en cours…"
                    : replaceExisting
                    ? `Remplacer et inscrire les ${result.trainees.length} stagiaire(s) en « ${formation?.title ?? ""} »`
                    : `Inscrire définitivement ${result.trainees.length} stagiaire(s) en « ${formation?.title ?? ""} »`}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-sm text-on-surface-variant rounded-xl border border-border-subtle bg-surface-container-low">
              Aucun stagiaire valide n&apos;a été détecté dans ce fichier. Vérifiez le format en consultant le guide ci-dessus.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
