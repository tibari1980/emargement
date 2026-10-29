# Émargement — ESRP Valentin Haüy

Application web accessible de suivi de présence des stagiaires (voir `document_prd_projet_avh.md`).

- **Next.js 16** (App Router, TypeScript), **Tailwind CSS 4**, **Radix UI** (boîtes de dialogue)
- **Firebase** : Authentication (email / mot de passe) et Firestore
- Exports **PDF** (pdf-lib) et **Excel** (exceljs), import **CSV / XLSX** (papaparse, read-excel-file)

## Mise en route

1. `npm install`
2. Configuration Firebase dans `.env.local` (modèle : `.env.example`). Les clés web du projet
   `cfrp-emargement-projet` y sont déjà.
3. **Publier les règles de sécurité** : console Firebase → Firestore Database → onglet *Règles* →
   remplacer le contenu par celui du fichier `firestore.rules` → *Publier*.
4. `npm run dev` puis ouvrir http://localhost:3000
5. Premier lancement : la page de connexion propose **Installer l'application**, qui crée le compte
   administrateur (page `/installation`, utilisable une seule fois).
6. Optionnel : `npm run seed-demo` crée un compte de test par rôle et des données de démonstration.

Aucune clé de compte de service n'est nécessaire : l'application n'utilise que la configuration web
Firebase, et les droits sont garantis par les règles Firestore. Le fournisseur de connexion
**Adresse e-mail / Mot de passe** doit être activé (Authentication → Sign-in method).

Optionnel, avec une clé de compte de service enregistrée sous `service-account.json` (ignorée par git) :
`npm run deploy-rules` publie les règles et `npm run create-admin` crée ou promeut un administrateur.

### Comptes de démonstration (`npm run seed-demo`)

Mot de passe commun : `AvhTest2026!` (à supprimer avant la mise en production).

| Rôle | Email |
| --- | --- |
| Administrateur | admin@avh-test.fr |
| Secrétariat | secretariat@avh-test.fr |
| Responsable pédagogique | responsable@avh-test.fr |
| Formateur | formateur@avh-test.fr |
| Stagiaires | 6 fiches sans connexion, inscrites en « Technicien informatique de proximité » |

## Scénario de test

1. Connectez-vous avec le compte administrateur.
2. **Utilisateurs** : créez un formateur, un responsable pédagogique, une secrétaire.
3. **Formations et horaires** : « Créer les formations du catalogue ESRP », puis modifiez une formation
   pour cocher le formateur.
4. **Import de stagiaires** : importez un fichier CSV (`Nom;Prénom;Email`) dans cette formation.
5. **Calendrier** : ajoutez les jours fériés de l'année et une période de vacances.
6. **Émargement** (connecté en formateur) : présent / absent / en retard avec l'heure d'arrivée.
7. **Justificatifs d'absence** : justifiez une absence.
8. **Rapports mensuels** : vérifiez le calcul et téléchargez les exports PDF et Excel.

## Rôles

| Rôle | Pages |
| --- | --- |
| Administrateur | toutes |
| Secrétariat | import de stagiaires, calendrier, justificatifs d'absence |
| Responsable pédagogique | formations et horaires, rapports mensuels et exports |
| Formateur | émargement des formations qui lui sont attribuées |
| Stagiaire | pas de connexion (fiche uniquement) |

Les droits sont appliqués par `firestore.rules` (données) et par les routes API d'export (`requireRole`) ;
les gardes côté interface ne servent qu'à l'ergonomie.

## Données (Firestore)

Schéma du PRD (section 6), avec ces ajouts :

- `courses.trainerIds` : formateurs autorisés à faire l'émargement d'une formation ;
- `attendances.month` (`"AAAA-MM"`) : les requêtes mensuelles se font par égalité et ne nécessitent aucun index composite ;
- identifiant d'émargement déterministe `{courseId}_{traineeId}_{date}` (un seul enregistrement par jour) ;
- secteurs `technical` et `preparatory` ajoutés pour couvrir tout le catalogue de la section 3.

## Calcul des heures (`lib/hoursCalculator.ts`)

- Jours de formation = lundis à vendredis du mois, hors jours fériés et vacances.
- Heures théoriques = jours de formation × heures quotidiennes de la formation.
- Total absences = absences non justifiées + absences justifiées + minutes de retard / 60
  (retard mesuré par rapport à l'heure de début de la formation).
- Présence effective = heures théoriques − total absences.
- Les jours sans émargement sont signalés (« jours non saisis ») et comptés comme présents.

## Accessibilité

HTML sémantique (tableaux avec `caption` / `th scope`, `fieldset` / `legend`, libellés liés), lien
d'évitement, focus visible à fort contraste, annonces vocales via une région `aria-live`
(`components/AccessibleAnnouncer.tsx`), focus déplacé sur le titre à chaque page, police
Atkinson Hyperlegible, navigation 100 % clavier (flèches dans les groupes de statut).

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | développement / production |
| `npm test` | tests unitaires (calcul, import, jours fériés, exports) |
| `npm run lint` / `typecheck` | qualité du code |
| `npm run seed-demo` | comptes de test par rôle et données de démonstration |
| `npm run deploy-rules` | publie `firestore.rules` (clé de service requise) |
| `npm run create-admin` | crée ou promeut un administrateur (clé de service requise) |
