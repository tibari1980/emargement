"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Button } from "@/components/ui/Button";
import { downloadTraineeCsvTemplate, downloadTraineeExcelTemplate } from "@/lib/domain/templates";

export function ImportGuide({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const announce = useAnnounce();
  const [open, setOpen] = useState(defaultOpen);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const handleDownloadCsv = () => {
    try {
      downloadTraineeCsvTemplate();
      announce("Modèle CSV téléchargé. Remplissez-le avec vos données de stagiaires.");
    } catch {
      announce("Erreur lors du téléchargement du modèle CSV.", "assertive");
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await downloadTraineeExcelTemplate();
      announce("Modèle Excel (.xlsx) téléchargé. Remplissez-le avec vos données de stagiaires.");
    } catch {
      announce("Erreur lors du téléchargement du modèle Excel.", "assertive");
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <section
      aria-labelledby="guide-heading"
      className="rounded-2xl border-2 border-secondary/20 bg-surface-container-lowest p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-primary font-bold shadow-xs"
            aria-hidden="true"
          >
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="guide-heading" className="text-lg sm:text-xl font-bold text-primary">
              Guide pas-à-pas : Importer des stagiaires
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Téléchargez un modèle pré-rempli, ajoutez vos stagiaires et importez-le en 3 étapes simples.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container transition-colors cursor-pointer"
        >
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
              <span>Masquer le guide</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              <span>Afficher le guide</span>
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-5 flex flex-col gap-6">
          {/* Les 3 étapes */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Étape 1 */}
            <div className="rounded-xl border border-border-subtle bg-surface-container-low p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                    1
                  </span>
                  <h3 className="font-bold text-primary text-sm sm:text-base">
                    Télécharger un modèle
                  </h3>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
                  Obtenez un fichier exemple prêt à l&apos;emploi avec les bons en-têtes et des données d&apos;exemple.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel}
                  className="!min-h-10 !px-3 text-xs w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-[#0f6f43] hover:!bg-[#0c5936] text-white"
                  aria-label="Télécharger le fichier exemple Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{downloadingExcel ? "Téléchargement…" : "Modèle Excel (.xlsx)"}</span>
                </Button>

                <Button
                  onClick={handleDownloadCsv}
                  variant="secondary"
                  className="!min-h-10 !px-3 text-xs w-full inline-flex items-center justify-center gap-2 rounded-xl"
                  aria-label="Télécharger le fichier exemple CSV (.csv)"
                >
                  <FileText className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                  <span>Modèle CSV (.csv)</span>
                </Button>
              </div>
            </div>

            {/* Étape 2 */}
            <div className="rounded-xl border border-border-subtle bg-surface-container-low p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                    2
                  </span>
                  <h3 className="font-bold text-primary text-sm sm:text-base">
                    Remplir avec vos données
                  </h3>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
                  Ouvrez le fichier dans Excel, LibreOffice ou un tableur, remplacez les exemples par vos vrais stagiaires puis enregistrez.
                </p>
              </div>

              <div className="rounded-lg bg-surface-container-lowest p-2.5 border border-border-subtle text-xs text-on-surface">
                <div className="font-bold text-primary mb-1 flex items-center gap-1">
                  <FileCheck2 className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                  <span>Colonnes reconnues :</span>
                </div>
                <ul className="list-disc ml-4 space-y-0.5 text-on-surface-variant">
                  <li><strong className="text-on-surface">Nom</strong> &amp; <strong className="text-on-surface">Prénom</strong> (ou <em>Nom complet</em>)</li>
                  <li><strong className="text-on-surface">Email</strong> (recommandé pour éviter doublons)</li>
                </ul>
              </div>
            </div>

            {/* Étape 3 */}
            <div className="rounded-xl border border-border-subtle bg-surface-container-low p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                    3
                  </span>
                  <h3 className="font-bold text-primary text-sm sm:text-base">
                    Importer et valider
                  </h3>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
                  Sélectionnez la formation, déposez votre fichier ci-dessous. Le système contrôle chaque ligne et affiche un aperçu avant inscription.
                </p>
              </div>

              <div className="rounded-lg bg-status-present-bg/40 p-2.5 border border-status-present-border/30 text-xs text-status-present flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-semibold">Contrôle anti-doublon et validation immédiate</span>
              </div>
            </div>
          </div>

          {/* Tableau détaillé des spécifications de format */}
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest">
            <table className="w-full border-collapse text-left text-xs min-w-[500px]">
              <caption className="sr-only">Structure détaillée des colonnes du fichier</caption>
              <thead className="bg-surface-container text-primary font-bold uppercase">
                <tr>
                  <th scope="col" className="p-2.5 sm:p-3">Colonne</th>
                  <th scope="col" className="p-2.5 sm:p-3">Statut</th>
                  <th scope="col" className="p-2.5 sm:p-3">Description</th>
                  <th scope="col" className="p-2.5 sm:p-3">Exemple</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface">
                <tr>
                  <th scope="row" className="p-2.5 sm:p-3 font-bold font-mono">Nom</th>
                  <td className="p-2.5 sm:p-3">
                    <span className="inline-flex rounded-full bg-status-absent-bg px-2 py-0.5 font-bold text-status-absent text-[11px]">
                      Obligatoire
                    </span>
                  </td>
                  <td className="p-2.5 sm:p-3 text-on-surface-variant">Nom de famille du stagiaire</td>
                  <td className="p-2.5 sm:p-3 font-medium text-primary">Dupont</td>
                </tr>
                <tr>
                  <th scope="row" className="p-2.5 sm:p-3 font-bold font-mono">Prénom</th>
                  <td className="p-2.5 sm:p-3">
                    <span className="inline-flex rounded-full bg-status-absent-bg px-2 py-0.5 font-bold text-status-absent text-[11px]">
                      Obligatoire
                    </span>
                  </td>
                  <td className="p-2.5 sm:p-3 text-on-surface-variant">Prénom du stagiaire</td>
                  <td className="p-2.5 sm:p-3 font-medium text-primary">Claire</td>
                </tr>
                <tr>
                  <th scope="row" className="p-2.5 sm:p-3 font-bold font-mono">Email</th>
                  <td className="p-2.5 sm:p-3">
                    <span className="inline-flex rounded-full bg-status-late-bg px-2 py-0.5 font-bold text-status-late text-[11px]">
                      Facultatif
                    </span>
                  </td>
                  <td className="p-2.5 sm:p-3 text-on-surface-variant">Adresse email personnelle ou professionnelle</td>
                  <td className="p-2.5 sm:p-3 font-medium text-primary">claire.dupont@exemple.fr</td>
                </tr>
                <tr>
                  <th scope="row" className="p-2.5 sm:p-3 font-bold font-mono">Nom complet</th>
                  <td className="p-2.5 sm:p-3">
                    <span className="inline-flex rounded-full bg-surface-container px-2 py-0.5 font-bold text-outline text-[11px]">
                      Alternative
                    </span>
                  </td>
                  <td className="p-2.5 sm:p-3 text-on-surface-variant">À utiliser si Nom et Prénom sont réunis en une seule colonne</td>
                  <td className="p-2.5 sm:p-3 font-medium text-primary">Claire Dupont</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
