<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RÈGLES D'OR DU PROJET — ESRP / CFRP VALENTIN HAÜY (OBLIGATOIRES SUR CHAQUE PROMPT)

Ce fichier définit les règles architecturales, fonctionnelles, de sécurité, d'accessibilité et de méthodologie que tout agent IA doit **obligatoirement consulter et respecter sans aucune exception avant de traiter tout prompt**.

---

## 0. Consultation Préalable Obligatoire de ce Fichier sur TOUS les Prompts
- **Avant toute modification de code, de composant, de route ou de logique métier**, l'agent doit impérativement relire et appliquer l'intégralité des règles ci-dessous.
- Aucune régression ne sera tolérée sur l'accessibilité, les calculs d'heures certifiées ou la séparation des rôles.

---

## 1. Interdiction Stricte des Tests Automatisés Navigateur (Chrome / Puppeteer / Playwright)
- **NE JAMAIS** lancer, créer ou exécuter de scripts de test automatisés ouvrant un navigateur (Google Chrome, Puppeteer, Playwright, etc.). Cela bloque le poste de travail et ralentit le développement.
- Pour vérifier le code, utiliser **exclusivement** :
  1. `npx tsc --noEmit` (vérification stricte du typage TypeScript)
  2. `npx vitest run` (tests unitaires du domaine métier et des permissions)
  3. `npm run build` (compilation de production Next.js)

---

## 2. Séparation Stricte du Code par Profil (Architecture 3 Couches Anti-Conflits)
Pour garantir qu'une modification sur un profil ne crée jamais de conflit ou de régression de sécurité sur un autre profil, toujours respecter l'isolation suivante :
- **Couche 1 — Domaine & Accès aux Données (`lib/domain/*`, `lib/data/*`)** :
  - Fonctions pures, calculs d'heures certifiées (`hoursCalculator.ts`), règles horaires (`schedule.ts`), permissions (`permissions.ts`) et cache temps réel (`useReferenceData.ts`).
- **Couche 2 — Atomes UI Partagés (`components/ui/*`, `features/attendance/SharedAttendanceParts.tsx`, `features/attendance/TraineeRow.tsx`, `features/timetable/WeekView.tsx`)** :
  - Composants purement visuels pilotés par des props explicites (`readOnly`, etc.), sans logique de rôle interne.
- **Couche 3 — Vues & Routes Isolées par Rôle** :
  - **Profil Formateur (`trainer`)** :
    - Émargement : `features/attendance/TrainerAttendanceSheet.tsx` (route `/trainer/emargement`). Ne doit contenir **aucun** code de régularisation administrative ni de gestion d'absence formateur.
    - Planning : `features/planning/TrainerPlanningView.tsx`. Confidentialité stricte : un formateur ne voit que son propre planning individuel ou celui d'une promotion (jamais celui d'un autre formateur).
  - **Profils Supervision (`secretary`, `pedagogical_lead`, `admin`)** :
    - Émargement Multi-Filières & Régularisations : `features/attendance/StaffAttendanceSupervisor.tsx` (routes `/secretary/emargement` et `/pedagogical/emargement`).
    - Plannings Multi-Filières & Multi-Formateurs : `features/planning/StaffPlanningSupervisor.tsx`.
  - **Dispatchers (`AttendanceSheet.tsx`, `Plannings.tsx`, `lib/core/navigation.ts`)** :
    - Aiguillent automatiquement chaque utilisateur vers le composant et l'URL correspondant à son rôle (`emargementHrefFor(role)`).

---

## 3. Verrouillage Temporel Strict (`Europe/Paris`) — Tous Profils
- L'horloge est synchronisée avec le serveur (`/api/time` via `syncServerClock()`) sur le fuseau `Europe/Paris`.
- **AUCUN profil (`trainer`, `secretary`, `pedagogical_lead`, `admin`) ne peut JAMAIS émarger une séance dans le futur (`status === "future"`, c'est-à-dire une date future `date > todayIso()` ou avant l'heure de début `startTime` le jour même)**.
- **Un formateur (`trainer`) ne peut JAMAIS émarger avant le début de la séance (`status === "future"`) ni après la clôture de la séance (`endTime + 15 min`, `status === "ended_today"` ou `"past"`)**.
- Cette règle doit toujours être vérifiée :
  1. À l'affichage (`canModify` désactive les boutons Présent/Retard/Absent, le bouton « Marquer tous présents » et le champ `<input type="time">` d'heure d'arrivée via `isUnlockedForTrainer` / `isUnlockedForStaff`).
  2. À l'instant exact du clic dans `save()` (`getSessionTemporalStatus(slot, date, nowTime(), todayIso())`).
  3. Dans la couche de données (`saveAttendances` dans `lib/data/attendances.ts`).
- Seuls les profils `secretary`, `pedagogical_lead` et `admin` peuvent régulariser une séance **passée** (`ended_today` ou `past`) ou gérer l'absence d'un formateur (`TrainerAbsenceModal`).

---

## 4. Cohérence des 15 Filières & Journée Standard (`09:00–17:00`)
- Toujours dédupliquer les formations via `deduplicateFormationsList()` et privilégier lors de la fusion l'enregistrement ayant des stagiaires inscrits (`traineeIds.length > 0`).
- Lorsqu'une formation active n'a pas de créneau spécifique dans `timetableSlots` un jour ouvré (lundi au vendredi hors jours fériés), l'application génère automatiquement la journée réglementaire standard (`09:00–17:00`, 7h/jour, 35h/semaine) de manière **100 % cohérente** entre :
  - L'Émargement (`buildDaySessions`),
  - Les Justificatifs d'absence (`JustificationManager.tsx`),
  - Les Rapports mensuels certifiés DGEFP / ASP (`hoursCalculator.ts`).

---

## 5. Accessibilité RGAA 4.1 / WCAG 2.2 Niveau AAA & Lecteurs d'Écran (NVDA, JAWS, VoiceOver, Orca)
- L'application est destinée en priorité aux personnes aveugles et malvoyantes (ESRP / CFRP Valentin Haüy).
- **Règle WCAG 2.5.3 (Label in Name / Étiquette dans le nom)** :
  - Le nom accessible (accessible name) d'un lien ou d'un bouton DOIT OBLIGATOIREMENT commencer par son texte visible.
  - **INTERDICTION STRICTE** de placer un `aria-label` qui écrase la première lettre du libellé visible : par exemple, le lien visible « Connexion » ne doit JAMAIS avoir `aria-label="Accéder à l'espace..."`, sinon NVDA le classe sous la lettre **A** au lieu de **C** dans `NVDA + F7` (Boîte de dialogue de la liste des éléments).
- **Compatibilité multi-lecteurs d'écran garantie** :
  - **NVDA** (Windows) : touches directes `K` (liens), `B` (boutons), `H` (titres), `D` (landmarks/régions) et `NVDA + F7`.
  - **JAWS** (Windows) : `Insert + F7` (liens), raccourcis de navigation rapide.
  - **VoiceOver** (macOS / iOS) : rotor tactile et clavier `VO + U`.
  - **Orca** (Linux) : navigation tabulaire et liste d'éléments.
- **Raccourcis Clavier Dédiés de la Plateforme** :
  - `Alt + M` : Basculer instantanément entre mode standard et mode sombre.
  - `Alt + A` : Ouvrir la boîte modale des options d'accessibilité visuelle (taille de texte, contrastes, espacements).
  - `Alt + N` : Ouvrir le centre de notifications flottant.
  - `P` / `R` / `A` : Marquer Présent / Retard / Absent sur la ligne de stagiaire sélectionnée.
  - `Escape` : Fermer tout tiroir ou dialogue modal.
- **3 Modes de Contraste** : Lisibilité parfaite et sans artefact dans les 3 modes (`Standard`, `Sombre`, `Haut Contraste Jaune sur Noir`).
- **Composants Flottants & Modales** : Rendu obligatoire via `createPortal(..., document.body)` avec focus trap, fond opaque, bordure nette et annonces vocales `useAnnounce()` (`role="status"` ou `aria-live="polite"`).

---

## 6. Protection des Justificatifs d'Absence & Intégrité du Moteur de Calcul ASP / DGEFP
- Toute absence justifiée enregistrée par le secrétariat (`status === "excused"`) est **sanctuarisée** :
  1. Dans la feuille d'émargement (`TraineeRow.tsx` et `TraineeCard`), les boutons `Retard` et `Absent` sont **désactivés** (`disabled`, `aria-disabled="true"`). Les raccourcis clavier `R` et `A` sont neutralisés.
  2. L'action collective « Marquer tous présents » (`markAllPresent`) ignore strictement les stagiaires excusés.
  3. Si un stagiaire arrive de manière imprévue en cours, le passage en Présent déclenche obligatoirement la modale de confirmation `ExcusedOverrideDialog` avant d'annuler le justificatif administratif au profit d'une présence physique.
- **Moteur de Calcul Certifié (`hoursCalculator.ts`)** :
  - Les heures excusées entrent strictement dans `aspExcusedHours` et génèrent **STRICTEMENT 0 HEURE DE DÉDUCTION ASP (`aspDeductibleHours = 0`)**.
  - Seules les absences injustifiées (`status === "absent"`) et les retards non régularisés constituent des heures déductibles de l'allocation stagiaire.

---

## 7. Performance, Scalabilité & Zéro Latence
- Toujours initialiser les états React des données de référence de manière **synchrone (`0 ms`)** via le cache mémoire / `localStorage` (`getInitialFormations`, `getInitialSlots`, `getInitialSubjects`, `getInitialHolidays`, `getInitialStaff`, `getUsersByIdsSync`), puis rafraîchir en arrière-plan (pattern *Stale-While-Revalidate*).
- Conserver la déduplication des requêtes en vol (`inFlight`) dans `lib/data/*` pour éviter les appels Firestore redondants.

---

## 8. Crédits & Copyright Officiels
- Toujours conserver dans le pied de page (`components/AppFooter.tsx`) et les métadonnées (`app/layout.tsx`) la mention officielle :
  **Copyright © 2026 — Application développée par Tibari Zeroual, Ingénieur de développement**.
