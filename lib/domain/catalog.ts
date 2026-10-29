import type { FormationCategory } from "./types";

/**
 * Training offer of the CFRP Valentin Haüy (5 rue Duroc, 75007 Paris),
 * as published on https://www.cfrp-avh.fr/le-centre/ (October 2026).
 */
export const FORMATION_CATALOG: {
  title: string;
  category: FormationCategory;
  duration: string;
  certification: string;
  description: string;
}[] = [
  {
    title: "Chargé(e) d'accueil et de gestion administrative",
    category: "professional",
    duration: "21 mois — 2 800 heures dont 455 heures de stage",
    certification: "Titre professionnel de niveau 4",
    description: "Assurer les activités d'accueil et gérer les activités administratives d'une structure.",
  },
  {
    title: "Mécanicien(ne) cycles",
    category: "professional",
    duration: "",
    certification: "",
    description: "Entretien et réparation de cycles.",
  },
  {
    title: "Technicien informatique de proximité",
    category: "professional",
    duration: "21 mois — 2 800 heures dont 490 heures de stage",
    certification: "Titre professionnel de niveau 4",
    description: "Support aux utilisateurs, mise en service des équipements numériques, intervention sur les infrastructures.",
  },
  {
    title: "Praticien(ne) en massages de bien-être",
    category: "professional",
    duration: "",
    certification: "",
    description: "Pratique des massages de bien-être.",
  },
  {
    title: "DE Masseur(euse) Kinésithérapeute",
    category: "professional",
    duration: "",
    certification: "Diplôme d'État",
    description: "Préparation au diplôme d'État de masseur-kinésithérapeute.",
  },
  {
    title: "Adaptation aux outils et à l'autonomie",
    category: "preparatory",
    duration: "10,5 mois — 1 400 heures",
    certification: "",
    description: "Braille, outils informatiques adaptés, techniques de déplacement et de communication.",
  },
  {
    title: "Tremplin-DV",
    category: "preparatory",
    duration: "5 mois — 665 heures",
    certification: "",
    description: "Connaissance de la déficience visuelle, outils numériques adaptés, braille, communication, locomotion.",
  },
  {
    title: "Préparatoire informatique",
    category: "preparatory",
    duration: "",
    certification: "",
    description: "Préparation à l'entrée en formation informatique.",
  },
  {
    title: "Mise à niveau scientifique",
    category: "preparatory",
    duration: "",
    certification: "",
    description: "Remise à niveau en sciences avant une formation qualifiante.",
  },
  { title: "Activité de la vie journalière", category: "module", duration: "", certification: "", description: "" },
  { title: "Braille", category: "module", duration: "", certification: "", description: "" },
  { title: "Locomotion", category: "module", duration: "", certification: "", description: "" },
  { title: "Outils adaptés", category: "module", duration: "", certification: "", description: "" },
  { title: "Bureautique", category: "module", duration: "", certification: "", description: "" },
  { title: "Comprendre la déficience visuelle", category: "module", duration: "", certification: "", description: "" },
];

/** Subjects commonly taught across the CFRP formations. */
export const SUBJECT_CATALOG: { title: string; description: string }[] = [
  { title: "Braille", description: "Apprentissage et perfectionnement du braille intégral et abrégé." },
  { title: "Français — Remise à niveau", description: "Grammaire, orthographe, expression écrite." },
  { title: "Français — Techniques d'écriture avancées", description: "Rédaction professionnelle, synthèse." },
  { title: "Bureautique", description: "Traitement de texte, tableur, messagerie avec outils adaptés." },
  { title: "Outils adaptés", description: "Lecteurs d'écran (NVDA, JAWS), plage braille, loupes." },
  { title: "Téléphonie accessible", description: "Smartphones iOS et Android avec VoiceOver / TalkBack." },
  { title: "Locomotion", description: "Techniques de déplacement autonome, canne blanche." },
  { title: "Activités de la vie journalière", description: "Autonomie au quotidien." },
  { title: "Mathématiques", description: "Remise à niveau scientifique." },
  { title: "Communication", description: "Techniques de communication orale et professionnelle." },
];
