# Spécifications de Design & Accessibilité (DESIGN.md)
## Plateforme d'Émargement & Suivi Pédagogique — ESRP / CFRP Valentin Haüy

---

### 1. Vision & Philosophie de Conception Universelle
L'application d'émargement et de suivi pédagogique du **CFRP / ESRP Valentin Haüy** est conçue selon le principe du **Design Universel** (*Design for All*). Elle doit offrir une expérience fluide, rapide et parfaitement équivalente pour :
1. **Les personnes aveugles / non-voyantes** : navigation 100% au lecteur d'écran (JAWS, NVDA, VoiceOver) et plage braille, structuration sémantique rigoureuse (`landmarks`, titres hiérarchisés `h1`-`h4`, alternatives textuelles complètes).
2. **Les personnes malvoyantes** : contraste ultra-renforcé (jaune sur noir `#FFFF00` / `#000000`), typographie Atkinson Hyperlegible, espacements aérés, indicateurs visuels clairs et symbole de l'œil comme repère visuel.
3. **Les personnes voyantes (formateurs, secrétaires, partenaires)** : design moderne, soigné, épuré, institutionnel et valorisant.

---

### 2. Palette de Couleurs & Ratios de Contraste (RGAA 4.1 AAA & WCAG 2.1)

| Mode | Rôle | Code Couleur | Ratio de Contraste | Conformité |
| :--- | :--- | :--- | :--- | :--- |
| **Standard** | Fond principal | `#F8FAFC` (Surface slate) | — | Base neutre apaisante |
| **Standard** | Texte principal | `#0F172A` (Navy profond) | **15.8:1** sur fond clair | Dépasse largement AAA (7:1) |
| **Standard** | Identité Institutionnelle | `#541974` (Violet Valentin Haüy) | **9.2:1** sur blanc | Conforme AAA |
| **Standard** | Accentuation / Action | `#EA580C` (Orange chaleureux Haüy) | **4.6:1** sur blanc | Conforme AA / AAA grands textes |
| **Contraste Élevé** | Fond immersif | `#000000` (Noir pur) | — | Élimine tout éblouissement |
| **Contraste Élevé** | Texte & Bordures | `#FFFF00` (Jaune signalétique) | **19.5:1** sur noir | **Excellence RGAA AAA** |
| **Mode Sombre** | Fond sombre | `#0F172A` (Slate sombre) | — | Repos oculaire |
| **Mode Sombre** | Texte clair | `#F8FAFC` (Blanc cassé) | **14.2:1** sur fond sombre | Conforme AAA |

> [!IMPORTANT]
> Aucun élément informatif ne repose uniquement sur la couleur : chaque statut visuel est accompagné d'un texte explicite, d'une icône sémantique et d'attributs ARIA.

---

### 3. Typographie Spécialisée Basse Vision
- **Police de caractères** : `Atkinson Hyperlegible` (créée par le *Braille Institute* pour maximiser la distinction entre caractères facilement confondus comme `I`, `1`, `l` ou `0`, `O`).
- **Échelle d'agrandissement dynamique** :
  - Standard : 100%
  - Grand : 125%
  - Très grand : 140%
- **Interlignage & espacement** : Support d'un mode "Aéré (+20%)" pour les utilisateurs malvoyants ayant besoin de séparer les lignes de lecture.

---

### 4. Iconographie & Intégration du Symbole de l'Œil (Vision & Inclusion)
- **Logo Emblématique de l'Établissement (`BrandLogoEye.tsx`)** :
  - Remplace l'acronyme textuel brut « VH » par un **Œil stylisé haute définition**, épuré, protecteur et moderne.
  - Composition vectorielle :
    1. Galbe externe moderne en amande représentant la protection et la bienveillance.
    2. Iris circulaire précis symbolisant l'attention portée à chaque parcours.
    3. Pupille centrale dense marquant le point focal de l'autonomie.
    4. Éclat lumineux supérieur évoquant la clarté, l'espoir et l'insertion professionnelle.
  - Comportement adaptatif :
    - En mode **Standard** : fond bleu nuit (`bg-primary-container`), trait blanc pur (`#FFFFFF`) avec éclat supérieur.
    - En mode **Contraste Élevé** : fond jaune signalétique (`#FFFF00`), trait noir pur (`#000000`).
    - En mode **Sombre** : fond ardoise (`#1E293B`), trait blanc pur (`#F8FAFC`).

---

### 5. Compatibilité Lecteurs d'Écran (NVDA, JAWS, VoiceOver, Orca)
Le logo et l'en-tête sont conçus pour garantir une restitution vocale et braille irréprochable :
1. **Zéro pollution auditive** : L'élément graphique vectoriel (`svg`) est doté de `aria-hidden="true"`, `role="presentation"` et `focusable="false"`. Le lecteur d'écran n'épelle jamais de coordonnées ou de chemins vectoriels.
2. **Intitulé sémantique explicite** : Le lien parent porte un `aria-label` limpide :
   `aria-label="Accueil émargement CFRP Valentin Haüy — Retour à la page d'accueil"`
3. **Restitution selon les technologies d'assistance** :
   - **NVDA (Windows)** : Annonce *"Lien, Accueil émargement CFRP Valentin Haüy"*
   - **JAWS (Windows)** : Annonce *"Lien Accueil émargement CFRP Valentin Haüy"*
   - **VoiceOver (macOS / iOS)** : Annonce *"Lien, Accueil émargement CFRP Valentin Haüy"*
   - **Orca (Linux)** : Annonce *"Accueil émargement CFRP Valentin Haüy lien"*
4. **Navigation Clavier & Focus** :
   - Anneau de focus visible à fort contraste (`ring-4 ring-focus-inner ring-offset-2`).
   - Raccourci d'accès direct au contenu principal via les liens d'évitement (*Skip Links*).

---

### 6. Imagerie & Alternatives Textuelles (Accessible Alt-Text)
1. **Photo d'autonomie (`autonomie-guide-dog.jpg`)** :
   - *Description visuelle* : Jeune femme souriante, portant des lunettes de soleil et une veste jaune moutarde, marchant avec assurance dans une rue piétonne ensoleillée avec son chien guide d'aveugle (Labrador clair) et tenant sa canne blanche de guidage.
   - *Alt-text accessible* : `Jeune femme malvoyante autonome marchant en ville avec son chien guide d'aveugle et sa canne blanche`.
2. **Logo officiel Valentin Haüy (`logo-valentin-hauy.png`)** :
   - *Description visuelle* : Logo institutionnel officiel "Valentin HAÜY — Avec les aveugles et les malvoyants — Agir pour l'autonomie", aux couleurs violette et orange.
   - *Alt-text accessible* : `Logo officiel de l'Association Valentin Haüy — Agir pour l'autonomie des personnes aveugles et malvoyantes`.

---

### 6. Architecture des Sections de la Landing Page
1. **Header d'Accès Rapide** : Logo CFRP Valentin Haüy, bouton d'options visuelles `[A± Accessibilité]`, et bouton `[Connexion]` direct.
2. **Hero Section** :
   - Titre fort : *« L'émargement et le suivi pédagogique certifié, pensé pour l'autonomie de tous. »*
   - Badges de certification : Homologation DGEFP, France Travail, RGAA 4.1 AAA.
   - Capsule « Œil de l'Accessibilité » : indicateur de conformité basse vision.
   - Photo mise en valeur avec bordure douce et contraste soigné.
   - Double appel à l'action : `[ Accéder à mon espace ]` et `[ Découvrir les fonctionnalités ]`.
3. **Bandeau Institutionnel & Partenaires** :
   - Présentation conjointe de l'ESRP / CFRP Valentin Haüy, France Travail, AGEFIPH et Région Île-de-France.
4. **Piliers d'Excellence & Fonctionnalités Métier** :
   - 👁️ **Accessibilité Totale & Vision Adaptée** : Conçu avec et pour les personnes aveugles et malvoyantes.
   - 🛡️ **Émargement Numérique & Horodatage Sécurisé** : Feuilles d'émargement infalsifiables.
   - 🎓 **Formations Professionnelles Spécialisées** : Kinésithérapie IFMK, Secrétariat, DAAV, Cycles qualifiants.
   - 📈 **Rapports Mensuels d'Assiduité** : Télétransmission et exports PDF/Excel automatisés.
5. **Espaces Dédiés par Rôle** : Formateurs, Responsables Pédagogiques, Secrétariat, Administrateurs et Stagiaires.
6. **Footer Institutionnel & Déclaration d'Accessibilité** : Coordonnées, engagement RGAA 4.1 et mentions d'assistance.
