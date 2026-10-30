import type { FormationCategory } from "./types";

export interface CatalogFormation {
  title: string;
  category: FormationCategory;
  duration: string;
  certification: string;
  description: string;
  yearLevel?: number | null;
  totalYears?: number | null;
  shortCode?: string;
  sectorGroup?: "informatique" | "kine" | "tertiaire" | "autonomie" | "modules";
}

/**
 * Offre de formation réelle et actualisée de l'ESRP / CFRP Valentin Haüy
 * (5 rue Duroc, 75007 Paris).
 * 
 * Intègre la structure par années de cursus :
 * - Filière Informatique (TIP 1ère année, TIP 2ème année, Prépa Info 1 an)
 * - Filière Masso-Kinésithérapie (Prépa Scientifique 1 an + Cursus d'État K1, K2, K3, K4 sur 4 ans = 5 ans au total)
 * - Filière Tertiaire / Secrétariat (CAGA 1ère année, CAGA 2ème année sur 2 ans)
 * - Filières Métiers (Cycles 1 an, Massages bien-être 1 an)
 * - Dispositifs d'autonomie (Adaptation 1 an, Tremplin-DV 5 mois)
 * - Modules transversaux d'autonomie
 */
export const FORMATION_CATALOG: CatalogFormation[] = [
  // 1. FILIÈRE INFORMATIQUE (NUMÉRIQUE)
  {
    title: "Technicien informatique de proximité — 1ère année (TIP 1)",
    category: "professional",
    duration: "1ère année (sur 2 ans — 21 mois / 2 800 h)",
    certification: "Titre professionnel RNCP Niveau 4 (Bac)",
    shortCode: "TIP 1",
    yearLevel: 1,
    totalYears: 2,
    sectorGroup: "informatique",
    description: "1ère année : Assistance aux utilisateurs, installation et configuration des postes de travail et logiciels adaptés, maintenance matérielle, architecture réseau local et adressage IP.",
  },
  {
    title: "Technicien informatique de proximité — 2ème année (TIP 2)",
    category: "professional",
    duration: "2ème année (sur 2 ans — 21 mois / 2 800 h dont 490 h de stage)",
    certification: "Titre professionnel RNCP Niveau 4 (Bac)",
    shortCode: "TIP 2",
    yearLevel: 2,
    totalYears: 2,
    sectorGroup: "informatique",
    description: "2ème année : Virtualisation, administration des serveurs (Windows/Linux) et services réseaux, téléassistance, sécurité, projets d'intégration et préparation au Titre Professionnel.",
  },
  {
    title: "Préparatoire informatique (1 an)",
    category: "preparatory",
    duration: "10 mois — 1 400 heures",
    certification: "Attestation de compétences pré-qualifiantes",
    shortCode: "PREPA-INFO",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "informatique",
    description: "Parcours préparatoire d'un an : logique algorithmique, architecture des systèmes d'exploitation, bureautique avancée et maîtrise experte des outils adaptés (NVDA, JAWS, plages braille, loupes) pour intégrer le cursus TIP ou supérieur.",
  },

  // 2. FILIÈRE MASSO-KINÉSITHÉRAPIE (IFMK VALENTIN HAÜY — 5 ANS TOTAL)
  {
    title: "Mise à niveau scientifique (Prépa Kiné — 1 an)",
    category: "preparatory",
    duration: "10 mois — 1 400 heures",
    certification: "Attestation de mise à niveau scientifique",
    shortCode: "PREPA-KINE",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "kine",
    description: "Année préparatoire scientifique : remise à niveau approfondie en biologie cellulaire, anatomie, physique-chimie et méthodologie de travail en vue de l'entrée à l'IFMK Valentin Haüy.",
  },
  {
    title: "DE Masseur-Kinésithérapeute — 1ère année (K1)",
    category: "professional",
    duration: "1ère année (cursus 4 ans)",
    certification: "Diplôme d'État de Masseur-Kinésithérapeute (Niveau 7 / Grade Master)",
    shortCode: "K1",
    yearLevel: 1,
    totalYears: 4,
    sectorGroup: "kine",
    description: "1ère année IFMK (K1) : anatomie descriptive et palpatoire adaptée, biomécanique, massothérapie fondamentale, physiologie humaine, ergonomie du geste.",
  },
  {
    title: "DE Masseur-Kinésithérapeute — 2ème année (K2)",
    category: "professional",
    duration: "2ème année (cursus 4 ans)",
    certification: "Diplôme d'État de Masseur-Kinésithérapeute",
    shortCode: "K2",
    yearLevel: 2,
    totalYears: 4,
    sectorGroup: "kine",
    description: "2ème année IFMK (K2) : kinésithérapie respiratoire, cardiovasculaire, rhumatologie, électrophysiothérapie et premiers stages en milieu hospitalier.",
  },
  {
    title: "DE Masseur-Kinésithérapeute — 3ème année (K3)",
    category: "professional",
    duration: "3ème année (cursus 4 ans)",
    certification: "Diplôme d'État de Masseur-Kinésithérapeute",
    shortCode: "K3",
    yearLevel: 3,
    totalYears: 4,
    sectorGroup: "kine",
    description: "3ème année IFMK (K3) : neurologie centrale et périphérique, traumatologie et orthopédie du sport, pédiatrie, raisonnement clinique et stages cliniques avancés.",
  },
  {
    title: "DE Masseur-Kinésithérapeute — 4ème année (K4)",
    category: "professional",
    duration: "4ème année (cursus 4 ans)",
    certification: "Diplôme d'État de Masseur-Kinésithérapeute (Grade Master)",
    shortCode: "K4",
    yearLevel: 4,
    totalYears: 4,
    sectorGroup: "kine",
    description: "4ème année IFMK (K4) : rééducation complexe, droit et éthique de la santé, mémoire de fin d'études et préparation aux épreuves du Diplôme d'État.",
  },

  // 3. FILIÈRE TERTIAIRE / GESTION ADMINISTRATIVE (SUR 2 ANS)
  {
    title: "Chargé(e) d'accueil et de gestion administrative — 1ère année (CAGA 1)",
    category: "professional",
    duration: "1ère année (sur 2 ans — 21 mois / 2 800 h)",
    certification: "Titre professionnel RNCP Niveau 4",
    shortCode: "CAGA 1",
    yearLevel: 1,
    totalYears: 2,
    sectorGroup: "tertiaire",
    description: "1ère année : Accueil physique et téléphonique, communication professionnelle, bureautique adaptée et gestion courante des dossiers administratifs.",
  },
  {
    title: "Chargé(e) d'accueil et de gestion administrative — 2ème année (CAGA 2)",
    category: "professional",
    duration: "2ème année (sur 2 ans — 21 mois / 2 800 h dont 455 h de stage)",
    certification: "Titre professionnel RNCP Niveau 4",
    shortCode: "CAGA 2",
    yearLevel: 2,
    totalYears: 2,
    sectorGroup: "tertiaire",
    description: "2ème année : Comptabilité de premier niveau, suivi commercial et achats, organisation logistique d'événements et examen du Titre Professionnel.",
  },

  // 4. AUTRES FORMATIONS PROFESSIONNELLES QUALIFIANTES (SUR 1 AN)
  {
    title: "Mécanicien(ne) cycles (1 an)",
    category: "professional",
    duration: "10,5 mois — 1 400 heures dont 315 heures de stage",
    certification: "Titre professionnel de mécanicien cycles",
    shortCode: "CYCLES",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "tertiaire",
    description: "Formation professionnelle : entretien, réglage, diagnostic de pannes mécaniques et électriques, réparation de vélos et VAE en atelier technique adapté.",
  },
  {
    title: "Praticien(ne) en massages de bien-être (1 an)",
    category: "professional",
    duration: "10,5 mois — 1 400 heures dont 280 heures de stage",
    certification: "Titre à finalité professionnelle",
    shortCode: "BIEN-ETRE",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "tertiaire",
    description: "Techniques de modelage bien-être, relaxation corporelle, accueil et installation de la clientèle, hygiène, déontologie et ergonomie gestuelle adaptée.",
  },

  // 5. DISPOSITIFS D'ADAPTATION, REMOBILISATION ET AUTONOMIE (1 AN OU COURT)
  {
    title: "Adaptation aux outils et à l'autonomie (1 an)",
    category: "preparatory",
    duration: "10,5 mois — 1 400 heures",
    certification: "Attestation de réadaptation professionnelle",
    shortCode: "ADAPT",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "autonomie",
    description: "Parcours fondamental : apprentissage intensif du braille (lecture, écriture), maîtrise des outils informatiques adaptés (synthèse vocale, plage tactile, loupes), locomotion et autonomie personnelle au quotidien.",
  },
  {
    title: "Tremplin-DV (5 mois)",
    category: "preparatory",
    duration: "5 mois — 665 heures",
    certification: "Attestation de parcours Tremplin-DV",
    shortCode: "TREMPLIN",
    yearLevel: 1,
    totalYears: 1,
    sectorGroup: "autonomie",
    description: "Dispositif passerelle de remobilisation : bilan des compétences, apprentissage de l'autonomie dans les déplacements, prise en main des outils numériques adaptés et élaboration de projet.",
  },

  // 6. MODULES TRANSVERSAUX ET ATELIERS D'AUTONOMIE
  {
    title: "Activité de la vie journalière (AVJ)",
    category: "module",
    duration: "Modules individualisés (35 h à 140 h)",
    certification: "",
    shortCode: "AVJ",
    sectorGroup: "modules",
    description: "Ateliers d'apprentissage et d'adaptation des gestes de la vie quotidienne pour personnes malvoyantes et non-voyantes.",
  },
  {
    title: "Braille (Intégral & Abrégé)",
    category: "module",
    duration: "Ateliers continus (35 h à 140 h)",
    certification: "",
    shortCode: "BRAILLE",
    sectorGroup: "modules",
    description: "Apprentissage et perfectionnement de la lecture et de l'écriture braille sur bloc-notes et supports papier.",
  },
  {
    title: "Locomotion & Déplacements autonomes",
    category: "module",
    duration: "Séances individuelles (35 h à 105 h)",
    certification: "",
    shortCode: "LOCO",
    sectorGroup: "modules",
    description: "Techniques de canne blanche, repérage spatial, utilisation des transports en commun et autonomie urbaine.",
  },
  {
    title: "Outils adaptés & Technologies d'assistance",
    category: "module",
    duration: "Ateliers techniques (35 h à 140 h)",
    certification: "",
    shortCode: "A11Y-TOOLS",
    sectorGroup: "modules",
    description: "Prise en main des lecteurs d'écran (NVDA, JAWS, VoiceOver), téléagrandisseurs et périphériques adaptés.",
  },
  {
    title: "Bureautique adaptée",
    category: "module",
    duration: "Modules pratiques (70 h à 210 h)",
    certification: "",
    shortCode: "BUR-ADAPT",
    sectorGroup: "modules",
    description: "Traitement de texte, tableur et messagerie électronique avec raccourcis clavier et synthèse vocale.",
  },
  {
    title: "Comprendre la déficience visuelle",
    category: "module",
    duration: "Module de sensibilisation (35 h)",
    certification: "",
    shortCode: "SENSI-DV",
    sectorGroup: "modules",
    description: "Comprendre les pathologies visuelles, les impacts fonctionnels et les attitudes adaptées.",
  },
];

/** Matières enseignées couramment dans les formations du CFRP. */
export const SUBJECT_CATALOG: { title: string; description: string }[] = [
  { title: "Braille", description: "Apprentissage et perfectionnement du braille intégral et abrégé." },
  { title: "Français — Remise à niveau", description: "Grammaire, orthographe, expression écrite." },
  { title: "Français — Techniques d'écriture avancées", description: "Rédaction professionnelle, synthèse." },
  { title: "Bureautique", description: "Traitement de texte, tableur, messagerie avec outils adaptés." },
  { title: "Outils adaptés", description: "Lecteurs d'écran (NVDA, JAWS), plage braille, loupes." },
  { title: "Téléphonie accessible", description: "Smartphones iOS et Android avec VoiceOver / TalkBack." },
  { title: "Locomotion", description: "Techniques de déplacement autonome, canne blanche." },
  { title: "Activités de la vie journalière", description: "Autonomie au quotidien." },
  { title: "Mathématiques & Algorithmique", description: "Remise à niveau scientifique et logique de programmation." },
  { title: "Systèmes d'exploitation & Réseaux", description: "Architecture poste de travail, Windows, Linux, routage IP et services réseaux." },
  { title: "Support matériel & Téléassistance", description: "Diagnostic, maintenance, dépannage et accompagnement utilisateurs." },
  { title: "Anatomie & Biomécanique", description: "Anatomie palpatoire et descriptive, physiologie du mouvement." },
  { title: "Communication professionnelle", description: "Techniques de communication orale, accueil et posture professionnelle." },
];
