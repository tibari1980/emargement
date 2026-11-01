# RÈGLES D'OR DU PROJET — ESRP / CFRP VALENTIN HAÜY (OBLIGATOIRES SUR CHAQUE PROMPT)

Ce fichier (`CLAUDE.md` / `AGENTS.md`) est chargé automatiquement par l'assistant IA à chaque prompt. Toutes les règles ci-dessous sont **strictement obligatoires**.

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

## 3. Verrouillage Temporel Strict Formateur (`Europe/Paris`)
- L'horloge est synchronisée avec le serveur (`/api/time` via `syncServerClock()`) sur le fuseau `Europe/Paris`.
- **Un formateur (`trainer`) ne peut JAMAIS émarger avant le début de la séance (`status === "future"`) ni après la clôture de la séance (`endTime + 15 min`, `status === "ended_today"` ou `"past"`)**.
- Cette règle doit toujours être vérifiée :
  1. À l'affichage (`canModify` désactive les boutons Présent/Retard/Absent et le champ `<input type="time">` d'heure d'arrivée).
  2. À l'instant exact du clic dans `save()` (`getSessionTemporalStatus(slot, date, nowTime(), todayIso())`).
- Seuls les profils `secretary`, `pedagogical_lead` et `admin` peuvent régulariser une séance passée ou gérer l'absence d'un formateur (`TrainerAbsenceModal`).

---

## 4. Cohérence des 15 Filières & Journée Standard (`09:00–17:00`)
- Toujours dédupliquer les formations via `deduplicateFormationsList()` et privilégier lors de la fusion l'enregistrement ayant des stagiaires inscrits (`traineeIds.length > 0`).
- Lorsqu'une formation active n'a pas de créneau spécifique dans `timetableSlots` un jour ouvré (lundi au vendredi hors jours fériés), l'application génère automatiquement la journée réglementaire standard (`09:00–17:00`, 7h/jour, 35h/semaine) de manière **100 % cohérente** entre :
  - L'Émargement (`buildDaySessions`),
  - Les Justificatifs d'absence (`JustificationManager.tsx`),
  - Les Rapports mensuels certifiés DGEFP / ASP (`hoursCalculator.ts`).

---

## 5. Accessibilité RGAA 4.1 Niveau AAA & Modes de Contraste
- L'application est destinée à l'ESRP / CFRP Valentin Haüy (personnes aveugles et malvoyantes).
- Toujours garantir une lisibilité parfaite dans les **3 modes de contraste** (`Standard`, `Sombre`, `Haut Contraste Jaune sur Noir`).
- Les panneaux flottants et tiroirs (ex. `NotificationBell.tsx`) doivent être rendus via `createPortal(..., document.body)` avec un fond opaque et une bordure nette pour ne jamais être tronqués par un conteneur parent.
- Préserver les raccourcis clavier (`P` Présent, `R` Retard, `A` Absent, `Alt + N` Notifications, `Escape` Fermer) et les annonces vocales ARIA (`useAnnounce()`) pour NVDA, JAWS et VoiceOver.

---

## 6. Performance, Scalabilité & Zéro Latence
- Toujours initialiser les états React des données de référence de manière **synchrone (`0 ms`)** via le cache mémoire / `localStorage` (`getInitialFormations`, `getInitialSlots`, `getInitialSubjects`, `getInitialHolidays`, `getInitialStaff`, `getUsersByIdsSync`), puis rafraîchir en arrière-plan (pattern *Stale-While-Revalidate*).
- Conserver la déduplication des requêtes en vol (`inFlight`) dans `lib/data/*` pour éviter les appels Firestore redondants.

---

## 7. Crédits & Copyright Officiels
- Toujours conserver dans le pied de page (`components/AppFooter.tsx`) et les métadonnées (`app/layout.tsx`) la mention officielle :
  **Copyright © 2026 — Application développée par Tibari Zeroual, Ingénieur de développement**.
