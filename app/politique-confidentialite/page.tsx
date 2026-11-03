import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  FileCheck,
  FileText,
  Lock,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { focusRing } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Politique de Confidentialité & Protection des Données (RGPD)",
  description:
    "Engagement officiel de conformité RGPD, protection des données personnelles et sécurité des comptes de l'ESRP / CFRP Valentin Haüy.",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      {/* Bouton retour */}
      <div className="mb-6">
        <Link
          href="/"
          className={`inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à l&apos;accueil
        </Link>
      </div>

      {/* En-tête */}
      <header className="mb-8 border-b border-border-subtle pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15 text-secondary shrink-0">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-0.5 text-xs font-bold text-primary mb-1">
              <Scale className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              Règlement Général sur la Protection des Données (UE 2016/679)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
              Politique de Confidentialité &amp; Sécurité des Données
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm sm:text-base text-on-surface-variant leading-relaxed">
          Le Centre de Formation et de Réadaptation Professionnelle (CFRP) Valentin Haüy, géré par l&apos;Association Valentin Haüy, s&apos;engage à protéger la vie privée de l&apos;ensemble des stagiaires, formateurs et membres du personnel conformément aux exigences du RGPD et de la loi Informatique et Libertés.
        </p>
      </header>

      {/* Corps des mentions RGPD */}
      <div className="flex flex-col gap-8">
        {/* Section 1 : Responsable du traitement */}
        <section aria-labelledby="section-responsable" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-responsable" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            1. Responsable du Traitement &amp; DPO
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-2">
            <p>
              Le responsable du traitement des données à caractère personnel est l&apos;<strong>Association Valentin Haüy au service des personnes aveugles et malvoyantes</strong> (reconnue d&apos;utilité publique), opérant pour le compte de l&apos;ESRP / CFRP Valentin Haüy.
            </p>
            <p>
              Pour toute question relative à vos données personnelles ou pour faire valoir vos droits, vous pouvez contacter notre <strong>Délégué à la Protection des Données (DPO)</strong> :
            </p>
            <div className="rounded-xl border border-border-subtle bg-surface-container p-4 mt-2">
              <p className="font-semibold text-primary">Délégué à la Protection des Données (DPO)</p>
              <p>Email : <a href="mailto:dpo@avh.asso.fr" className="font-semibold text-secondary hover:underline">dpo@avh.asso.fr</a></p>
              <p>Adresse : Association Valentin Haüy — 5 rue Duroc, 75007 Paris</p>
            </div>
          </div>
        </section>

        {/* Section 2 : Finalités & Bases Légales */}
        <section aria-labelledby="section-finalites" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-finalites" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <FileCheck className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            2. Finalités du Traitement &amp; Base Légale
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-3">
            <p>
              Les données à caractère personnel traitées au sein de cette plateforme ont pour finalités exclusives :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>L&apos;émargement électronique certifié des stagiaires à chaque session de formation ;</li>
              <li>Le suivi régulier de l&apos;assiduité, le décompte des heures de présence et la gestion des absences ;</li>
              <li>La justification des absences au regard des motifs légaux de formation professionnelle ;</li>
              <li>L&apos;édition des relevés mensuels d&apos;assiduité obligatoires destinés à l&apos;ASP (Agence de Services et de Paiement).</li>
            </ul>
            <div className="rounded-xl border border-border-subtle bg-surface-container p-4">
              <p className="font-bold text-primary mb-1">Base Légale (Article 6.1.c et 6.1.e du RGPD) :</p>
              <p>
                Ce traitement est nécessaire au respect d&apos;une <strong>obligation légale</strong> incombant au CFRP en qualité d&apos;organisme de formation certifié (Code du Travail, articles L.6353-8 et R.6341-28 et suivants régissant le contrôle de la présence et du financement des stagiaires).
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 : Données collectées & Minimisation */}
        <section aria-labelledby="section-donnees" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-donnees" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <Database className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            3. Données Collectées &amp; Principe de Minimisation
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-2">
            <p>
              Conformément au principe de minimisation des données (Article 5.1.c du RGPD), seules les données strictement indispensables à l&apos;exécution du service sont collectées :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Personnels et formateurs :</strong> nom, prénom, adresse email professionnelle, rôle dans l&apos;établissement, spécialité d&apos;enseignement, bureau habituel, historique d&apos;activité ;</li>
              <li><strong>Stagiaires :</strong> nom, prénom, promotion/filière, statut d&apos;assiduité aux séances, motifs légaux d&apos;absence.</li>
            </ul>
            <p className="text-xs text-on-surface-variant font-medium mt-2">
              Aucune donnée de santé détaillée n&apos;est conservée : seuls les justificatifs administratifs de présence/dispense font foi sans mention médicale diagnostique.
            </p>
          </div>
        </section>

        {/* Section 4 : Durée de conservation */}
        <section aria-labelledby="section-conservation" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-conservation" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            4. Durée de Conservation des Données
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-2">
            <p>
              Les données relatives aux feuilles d&apos;émargement et aux relevés d&apos;heures sont conservées pendant une durée de <strong>5 ans à compter de la fin de l&apos;année civile de réalisation de la session de formation</strong>.
            </p>
            <p>
              Ce délai correspond aux obligations légales et réglementaires de contrôle administratif et comptable fixées par le Code du Travail et les organismes financeurs publics. À l&apos;issue de ce délai, les données sont définitivement purgées ou anonymisées.
            </p>
          </div>
        </section>

        {/* Section 5 : Sécurité & Mesures Techniques de Protection */}
        <section aria-labelledby="section-securite" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-securite" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <Lock className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            5. Mesures Techniques de Sécurité &amp; Anti-Piratage
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-3">
            <p>
              Pour prévenir tout risque de piratage, d&apos;intrusion, d&apos;altération ou de fuite de données, les mesures suivantes sont déployées :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border-subtle bg-surface-container p-3.5">
                <p className="font-bold text-primary text-xs uppercase tracking-wide">Chiffrement de bout en bout</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Communications chiffrées sous TLS 1.3 / HSTS (Strict-Transport-Security), données de base chiffrées au repos.
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-container p-3.5">
                <p className="font-bold text-primary text-xs uppercase tracking-wide">Contrôle d&apos;Accès RBAC Strict</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Règles de sécurité Firestore empêchant toute élévation de privilèges ou accès non habilité.
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-container p-3.5">
                <p className="font-bold text-primary text-xs uppercase tracking-wide">Protection Anti-Brute-Force</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Verrouillage automatique progressif en cas de tentatives répétées et politiques de mots de passe renforcées (ANSSI).
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-container p-3.5">
                <p className="font-bold text-primary text-xs uppercase tracking-wide">Journaux d&apos;Audit Immuables</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Traçabilité cryptographique et horodatage de chaque action (création, modification, suppression).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 : Vos Droits RGPD */}
        <section aria-labelledby="section-droits" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-droits" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <UserCheck className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            6. Vos Droits &amp; Modalités d&apos;Exercice
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-3">
            <p>
              Conformément aux Articles 15 à 22 du RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong>Droit d&apos;accès et de portabilité (Art. 15 &amp; 20) :</strong> Vous pouvez télécharger directement l&apos;intégralité de vos données personnelles au format JSON depuis votre espace « Mon profil » ;</li>
              <li><strong>Droit de rectification (Art. 16) :</strong> Vous pouvez rectifier vos coordonnées et informations professionnelles à tout moment ;</li>
              <li><strong>Droit à l&apos;effacement (Art. 17) :</strong> Applicable sous réserve du respect des délais de conservation légaux obligatoires ;</li>
              <li><strong>Droit à la limitation du traitement (Art. 18) :</strong> En cas de contestation de l&apos;exactitude des données.</li>
            </ul>
            <div className="rounded-xl border border-border-subtle bg-surface-container p-4 mt-2">
              <p className="font-semibold text-primary">Réclamation auprès de l&apos;autorité de contrôle :</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Si vous estimez, après nous avoir contactés, que vos droits Informatique et Libertés ne sont pas respectés, vous pouvez adresser une réclamation en ligne à la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) sur son site officiel :{" "}
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="font-semibold text-secondary underline">
                  www.cnil.fr
                </a>.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 : Cookies & Données Techniques */}
        <section aria-labelledby="section-cookies" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
          <h2 id="section-cookies" className="text-xl font-bold text-primary flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
            7. Cookies &amp; Stockage Local Exempté de Consentement
          </h2>
          <div className="text-sm text-on-surface-variant leading-relaxed space-y-2">
            <p>
              Cette application n&apos;utilise <strong>aucun traceur publicitaire, aucun cookie tiers, ni aucun outil de pistage comportemental</strong>.
            </p>
            <p>
              Les seules données stockées sur votre terminal sont :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Préférences d&apos;accessibilité (LocalStorage) :</strong> mode de contraste (standard, sombre, jaune sur noir) et taille de police pour les personnes malvoyantes ;</li>
              <li><strong>Jeton d&apos;authentification de session :</strong> strictement nécessaire au maintien de votre session sécurisée.</li>
            </ul>
            <p className="text-xs text-on-surface-variant font-medium mt-1">
              Conformément aux lignes directrices de la CNIL relatives aux cookies et autres traceurs, ces données techniques sont strictement nécessaires à la fourniture du service et sont donc dispensées du recueil préalable de consentement.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
