# Fablio — Logique métier

> Toutes les règles ci-dessous sont issues du code (`src/lib/**`, `src/app/api/**`)
> et **vérifiées à l'exécution** sauf mention contraire. Les cas limites observés
> sont signalés par ⚠️.

---

## 1. Acteurs et parcours

### 1.1 Enseignant — parcours principal

1. **Inscription** (`/inscription?role=enseignant`) : nom (2–60), e-mail (regex
   simple), mot de passe ≥ 8 caractères → compte + session immédiate.
2. **Création d'une fable** (`/enseignant/fables/nouvelle`) : titre, texte, morale,
   illustration (lien direct ou de partage), vidéo, difficulté. La fable est créée
   **en brouillon** (`publie = false` par défaut).
3. **Composition du parcours** (`/enseignant/fables/[id]`) : ajout de blocs
   (texte, image, audio, vidéo, exercice), réordonnancement, duplication, suppression.
4. **Création d'exercices** : 8 types, avec barème (`points`, 1–100, défaut 10),
   feedbacks, `maxTentatives` (1–20 ou illimité).
5. **Publication** : bascule `publie = true`, **refusée** si la validation stricte
   échoue (voir §5).
6. **Codes de classe** : génération de codes de parrainage, activation/désactivation.
7. **Suivi** : statistiques par élève / par fable, correction manuelle des réponses
   ouvertes et H5P, export CSV.
8. **Récupération de mot de passe** par lien e-mail (§8).

### 1.2 Élève — parcours principal

1. **Inscription** (`/inscription?role=eleve`) : pseudo (2–20 lettres/chiffres/`_`/`-`,
   sans espace), **code de classe** fourni par l'enseignant, code secret 4–12.
   Aucun e-mail n'est demandé (choix produit assumé, voir `RECUPERATION.md`).
2. **Connexion** : pseudo + code de classe + PIN. Le pseudo est comparé en
   minuscules, le code est mis en majuscules.
3. **Bibliothèque** (`/eleve`) : fables publiées visibles, statut, progression,
   points, badges, reprise conseillée.
4. **Lecture** (`/eleve/fables/[id]`) : parcours par blocs (ou rendu historique si
   aucun bloc), lecture à voix haute, vidéo (interactive ou non), H5P, exercices.
5. **Exercices** : soumission, feedback immédiat, corrigé si erreur, tentatives
   restantes.
6. **Profil** (`/eleve/profil`) : points cumulés, temps total, historique.

---

## 2. Moteur d'exercices — 8 types

Source unique : `src/lib/exercices.ts` (`TYPES_EXERCICES`).

| Type | Payload | Règle de notation (`noterExercice`) | Validation (`validerPayload`) |
|---|---|---|---|
| `qcm` | `{question, options[], corrects[], multiple}` | `ratio = max(0, (bonnes − fausses) / max(1, nbCorrectes))` ; `score = arrondiQuart(points × ratio)` ; `estCorrect = ratio ≥ 1` — **une mauvaise réponse annule une bonne** | 2 à 6 propositions, toutes non vides, ≥ 1 index correct valide, et **si `multiple = false` : une seule bonne réponse** |
| `vrai_faux` | `{enonce, reponse:boolean}` | `score = points` si égalité stricte, sinon `0` | énoncé non vide, `reponse` **booléen** obligatoire |
| `texte_trous` | `{segments[], reponses[][], afficherBanque, banque[]}` | 1 point par trou si la réponse saisie correspond à **une** des réponses acceptées après `normaliser()` (minuscules, accents retirés, apostrophes/guillemets normalisés) ; `score = arrondiQuart(points × bons / total)` | 1 à 12 trous, chaque trou ≥ 1 réponse non vide, texte hors trous ≥ 2 caractères |
| `ordre` | `{elements[]}` (dans le **bon** ordre) | 1 point par position correcte (`rep[i] === i`), ratio sur le nombre d'éléments | 2 à 8 éléments non vides |
| `association` | `{paires:[{gauche,droite}]}` | 1 point par paire correctement associée (`rep[i] === i`), ratio sur le nombre de paires | 2 à 8 paires complètes, **éléments de droite distincts** (comparaison normalisée) |
| `question_ouverte` | `{question, corrigeType, reponsesAcceptees[]}` | si `reponsesAcceptees` non vide → correction automatique par égalité stricte normalisée ; **sinon `score = null` et `estCorrect = null`** = correction manuelle | question obligatoire |
| `video_interactive` | `{videoUrl, arrets:[{temps,question,options[],correct,explication}]}` | 1 point par arrêt correct, ratio sur le nombre d'arrêts | URL obligatoire, 1 à 10 arrêts, `temps ≥ 0`, question non vide, ≥ 2 options non vides, index correct valide |
| `h5p` | `{embedUrl, titre, hauteur, validationAutomatique, demanderScore}` | si `validationAutomatique` → **toute la note immédiatement** ; sinon `null`/`null` = correction manuelle | `embedUrl` non vide **et HTTPS**, hauteur 200–1400 |

**Règle transverse** : tous les scores sont arrondis au **quart de point**
(`Math.round(n × 4) / 4`).

**Mélanges déterministes** (`fabriquerPresentation`) : pour ne pas avantager un élève,
l'ordre des éléments (`ordre`), la colonne de droite (`association`) et la banque de
mots (`texte_trous` avec `afficherBanque`) sont mélangés par un PRNG ensemencé par
`"${exerciceId}:${eleveId}"`. Conséquence **reproductible** : un élève donné voit
toujours le même ordre pour un exercice donné — un rechargement ne change rien.

---

## 3. Soumission d'une réponse — `POST /api/exercices/[id]/soumettre`

Ordre **exact** des contrôles (garde-fous à préserver en cas de réécriture) :

1. session élève valide → sinon `401` ;
2. exercice **publié** → sinon `404` ;
3. fable **publiée** ET appartenant au **même enseignant** que l'élève → sinon `403` ;
4. **ciblage** : si `cibleCodeIds` non vide, le code de l'élève doit y figurer → sinon `403` ;
5. **quota** : si `maxTentatives` non nul et déjà atteint → `403` « Tu as utilisé toutes
   tes tentatives » ;
6. présence du champ `reponse` → sinon `400` ;
7. `dureeSecondes` borné à **[0, 3600]** (valeur non numérique → 0) ;
8. notation (`noterExercice`) puis INSERT d'une ligne `tentatives`
   (`numero = tentatives existantes + 1`) ;
9. réponse : `feedback` = feedback personnalisé de l'enseignant, sinon message par
   défaut ; message spécifique si correction en attente ; **`correction[]` renvoyé
   uniquement lorsque `est_correct === false`**.

**Implicite important** : `est_correct = false` est mémorisé pour toujours. Un exercice
n'est « réussi » que si **au moins une** tentative a `est_correct = true`
(`reussi: de.some(t => t.estCorrect === true)`).

---

## 4. Visibilité des fables et ciblage par classe

- Une fable n'est visible par les élèves que si **`publie = true`**.
- `cible_code_ids = []` (JSON vide) ⇒ visible par **tous** les élèves de l'enseignant.
- `cible_code_ids = [idCodeA, …]` ⇒ visible seulement par les élèves dont
  `eleve.code_id` ∈ la liste (un élève sans code ne voit rien de ciblé).
- Le filtrage est appliqué **deux fois** : à l'affichage (`fablesPourEleve`,
  `fablePourEleve`) **et** à la soumission — un élève ne peut donc pas contourner
  l'affectation en appelant directement l'API (vérifié).

---

## 5. Publication d'une fable (brouillon → publié)

`validerFablePourPublication()` (`src/lib/blocs/publication.ts`) exige :

1. titre non vide, difficulté renseignée ;
2. **au moins un bloc visible** ;
3. pour **chaque bloc visible**, la validation **stricte** du contenu :
   - `texte` : markdown non vide ; le HTML actif (`<script|iframe|object|embed`) est
     refusé **en toutes circonstances**, même en brouillon ;
   - `image` : URL non vide **et** `alt` non vide (accessibilité) ;
   - `audio` : URL non vide ;
   - `video` : URL non vide **et** source reconnue (YouTube, Vimeo, Drive ou fichier) ;
   - `exercice` : référence présente, exercice existant **et publié**.
4. En cas d'échec : `400` avec `erreur` = 1ʳᵉ erreur et **`detailsValidation: string[]`**
   (toutes les erreurs). Vérifié.

La **dépublication** est toujours autorisée et ne déclenche aucune validation.
Les exercices dépubliés disparaissent côté élève (y compris de la soumission → `404`).

---

## 6. Moteur de blocs (`src/lib/blocs/**`)

- **Registre** (`registre.ts`) : 5 types actifs (`texte`, `image`, `audio`, `video`,
  `exercice`) et 9 types annoncés « bientôt » (`document`, `pdf`, `citation`,
  `encadre`, `tableau`, `galerie`, `question`, `activite`, `h5p`). Ajouter un type =
  une entrée de registre + un rendu ; l'API refuse tout type inactif (`400`).
- **Deux niveaux de validation** : *brouillon* (défaut) tolère les champs vides mais
  refuse des données présentes **mais invalides** ; *strict* (publication) exige un
  bloc complet.
- **Invariant `ordre` contigu 0..n-1** sur chaque fable, maintenu par des transactions
  avec `FOR UPDATE` et renumérotation en deux passes ; `reordonnerBlocs()` **vérifie**
  l'invariant après coup et lève une erreur sinon.
- **Suppression d'un bloc** : supprime **uniquement** le bloc. L'exercice référencé et
  **toutes ses tentatives d'élèves sont conservés** (règle écrite dans le code ;
  re-vérifiée à l'exécution : l'exercice reste listé dans la fable et l'historique de
  l'élève est intact).
- **Duplication** : contenu JSON cloné, **nouvel identifiant**, inséré juste après la
  source ; pour un bloc `exercice`, la **même** référence d'exercice est réutilisée
  (aucun doublon d'exercice créé).
- **Résilience de déploiement** : si la table `blocs_fable` n'existe pas
  (migration non exécutée), les lectures renvoient `[]` (**jamais de 500**), l'UI
  bascule sur le rendu historique, et la création de bloc répond `400` avec
  « La base n'est pas encore migrée : exécutez « node scripts/setup-db.mjs »… ».
  Un avertissement est journalisé **une fois par instance de module** :
  `[fablio] ⚠ La table blocs_fable n'existe pas dans la base …` (vérifié).

> ✅ **Défaut corrigé (2026-10) — l'ordre des blocs est préservé.**
>
> **Ce qui se passait** : `normaliserOrdres()` (appelée uniquement par la création et
> la suppression de bloc) décalait les rangs vers le **négatif**
> (`UPDATE blocs_fable SET ordre = -ordre - 1`) avant de renuméroter avec
> `ROW_NUMBER() OVER (ORDER BY ordre, cree_le)`. Ces valeurs négatives étant
> **décroissantes**, le tri de la seconde passe classait les blocs à l'envers : chaque
> création/suppression **inversait le parcours** et le nouveau bloc arrivait en tête.
>
> **Ce qui a été changé** (voir `docs/correctifs-appliques.md` §2) : décalage
> **monotone** (`ordre + 1 000 000`, qui ne modifie pas le tri), départage déterministe
> `ORDER BY ordre, cree_le, id`, et insertion positionnée par **un seul**
> `UPDATE … SET ordre = ordre + 1`.
>
> **Comportement vérifié après correction** (fable neuve, état relu après chaque appel) :
>
> ```
> POST texte  (ordre renvoyé 0)  → T@0
> POST image  (ordre renvoyé 1)  → T@0 I@1
> POST audio  (ordre renvoyé 2)  → T@0 I@1 A@2
> POST video  (ordre renvoyé 3)  → T@0 I@1 A@2 V@3
> POST position:1                → T@0 T@1 I@2 A@3 V@4     (le bloc inséré est bien en 1)
> suppression du bloc @2         → T@0 T@1 A@2 V@3
> duplication du bloc @0         → le nouveau bloc est en 1 (juste après la source)
> ```
>
> L'invariant de contiguïté `0..n-1` est vérifié après chacune de ces opérations
> (`PUT …/blocs/ordre` continue de le valider et de lever une erreur sinon).
> **Aucune migration de données n'est nécessaire** : l'invariant n'a jamais été violé,
> seul l'ordre relatif était faux (voir « Données existantes » dans le document des
> correctifs).

---

## 7. Statistiques — définitions exactes

Toutes les valeurs proviennent de la base réelle (aucune donnée simulée).

| Indicateur | Définition dans le code |
|---|---|
| Pourcentage d'un essai | `score / maxScore × 100` ; `null` si `score` est `null` |
| `scoreMoyenPct` | moyenne des pourcentages **des essais notés** (les corrections en attente sont exclues) |
| `tauxReussite` | `est_correct = true` ÷ **essais corrigés** (`est_correct !== null`) — un essai en attente ne dégrade pas le taux |
| Série 14 jours | itération sur les 14 derniers jours **locaux**, tentatives du jour, moyenne des pourcentages (arrondie) |
| `nbElevesActifs` (fable) | nombre d'élèves ayant au moins une tentative sur la fable |
| Distribution QCM | pour chaque option, nombre d'essais l'ayant sélectionnée + `correct` |
| Distribution vrai/faux | « Vrai » / « Faux » sur les valeurs brutes stockées |
| Distribution vidéo | par arrêt : nombre d'essais avec l'option correcte |
| `erreursTrous` | par trou : réponses fausses comptées et normalisées, top 4, `tauxErreur = fautes / essais` en % |
| `enAttente` | essais `est_correct IS NULL` des types `question_ouverte` et `h5p` (file de correction) |
| `pointsCumules` (élève) | somme des **meilleurs** scores par exercice |
| `parFable[].meilleureNotePct` | moyenne des pourcentages des **meilleurs** scores par exercice de la fable |
| Progression élève | `exercicesReussis / exercicesTotal` (exercices publiés des fables visibles) |

**Export CSV** : lignes triées par date croissante, séparateur `;`, BOM UTF-8 (Excel),
échappement des guillemets (doublés) ; `Score`/`Reussi` valent « en attente » pour les
corrections non faites ; dates en ISO 8601.

---

## 8. Récupération de mot de passe

### Enseignant (e-mail)

| Règle | Valeur |
|---|---|
| Entropie du jeton | 32 octets aléatoires, encodage `base64url` (43 caractères — mesuré) |
| Stockage | **SHA-256** uniquement, index unique (64 caractères hex — vérifié) ; le jeton en clair n'existe que dans le message |
| Durée de vie | 60 minutes |
| Usage unique | `utilise_le` renseigné à la consommation ; un rejeu renvoie « Ce lien a déjà été utilisé… » |
| Un seul jeton actif | toute nouvelle demande marque les jetons antérieurs non utilisés comme consommés (vérifié : le jeton précédent devient invalide) |
| Quota | **3 demandes / 15 min / compte** (vérifié : la 4ᵉ n'crée rien et renvoie la même réponse) |
| Anti-énumération | réponse HTTP **identique** (même corps JSON) que le compte existe ou non — empreintes MD5 comparées |
| Fuite côté client | aucune : ni le jeton ni un lien n'apparaissent dans la réponse HTTP |
| Effet de bord final | dans une transaction : mise à jour du hash, consommation du jeton, **suppression de toutes les sessions du compte** (vérifié : 5 sessions → 0, seule une reconnexion crée une nouvelle session) |
| Livraison | Resend si `RESEND_API_KEY`, sinon **journal serveur** (`[fablio:courriel] (non configuré — journalisé)`) — c'est le chemin utilisé dans cette reproduction |

### Élève (sans e-mail)

L'élève prévient l'enseignant, qui saisit un nouveau PIN (4–12) depuis
`/enseignant/eleves/[id]` → `PATCH /api/enseignant/stats/eleves/[id]`. Contrôles :
session enseignant **et** propriété de l'élève (sinon `404`). Vérifié : l'ancien PIN
est refusé et le nouveau accepté immédiatement.

---

## 9. Lecture à voix haute (`POST /api/tts`)

1. session requise (enseignant ou élève) → sinon `401` ;
2. texte non vide (≥ 2 caractères), tronqué à 4 000 ;
3. **si `OPENAI_API_KEY`** : `gpt-4o-mini-tts` / voix `shimmer` (paramétrables),
   `speed = 0.95` → MP3 ;
4. **sinon** : Google Translate TTS, texte découpé en segments ≤ 190 caractères
   (coupe sur la ponctuation, puis les virgules/espaces) et trames MP3 concaténées ;
5. si OpenAI échoue alors qu'une clé existe : repli automatique sur Google ;
6. si tout échoue : **502** avec un message invitant à utiliser la voix du navigateur ;
   côté client, `lecteur-vocal.tsx` bascule alors sur `speechSynthesis` (voix `fr`),
   et considère comme échec un audio de moins de 500 octets.

---

## 10. Tableau de bord élève (`src/lib/eleve/tableau-de-bord.ts`)

| Notion | Règle exacte |
|---|---|
| Statut d'une fable | `terminee` si nbRéussis ≥ nbExercices publiés (> 0) ; sinon `en_cours` si ≥ 1 exercice tenté ; sinon `a_commencer` |
| Points d'une fable | somme des **meilleurs** scores par exercice (arrondie au centième) ; `pointsMax` = somme des barèmes des exercices publiés |
| Reprise conseillée | 1) fable `en_cours` la plus récente ; 2) sinon première `a_commencer` ; 3) sinon dernière `terminée` (action `revoir`) |
| Activités récentes | 6 dernières tentatives, toutes fables confondues |
| `progressionGlobalePct` | `exercicesRéussis / exercicesTotal × 100` |
| Badges (7) | `premier_pas` 1 exercice réussi · `petit_lecteur` 1 fable terminée · `perseverant` 10 tentatives · `explorateur` 4 types d'exercices différents · `collectionneur` 3 fables terminées · `etoile_or` 100 points · `champion` 300 points. Chaque badge expose `obtenu`, `avancement` (0..1) et `detail` « x / cible unité » |

**Règle implicite notable** : une activité **ouverte mais non validée** (score `null`)
n'est **jamais** comptée comme réussie ; un score partiel (`7.5/15`) ne rend pas
l'exercice « réussi » tant qu'aucune tentative n'a `est_correct = true`.

---

## 11. Normalisation des médias (`src/lib/medias.ts`)

| Entrée | Transformation | Vérifié |
|---|---|---|
| `drive.google.com/file/d/ID/view`, `/open?id=`, `/uc?id=`, `docs.google.com/uc?id=` | → `https://lh3.googleusercontent.com/d/ID=w1600` | oui (test API) |
| URL `lh3.googleusercontent.com` | inchangée | — |
| Dropbox | `dl=0` → `raw=1`, hôte → `dl.dropboxusercontent.com` | — |
| OneDrive / `1drv.ms` | ajout de `?download=1` si absent | — |
| Chemin local `/…` ou `https://…` | conservé | — |
| Vidéo YouTube (`watch?v=`, `youtu.be`, `embed`, `shorts`, `youtube-nocookie`) | iframe `youtube-nocookie.com/embed/ID?rel=0&modestbranding=1&enablejsapi=1`, `interactif: true` | — |
| Fichier `.mp4/.webm/.ogg/.ogv/.m4v` (ou chemin local) | balise `<video>`, `interactif: true` | — |
| Vimeo | `player.vimeo.com/video/ID`, `interactif: false` | — |
| Google Drive (vidéo) | `/preview`, `interactif: false` | — |
| H5P : code `<iframe src="…">` | extraction de l'URL `src` | — |
| `h5p.org/node/ID` ou `h5p.org/ID` | → `h5p.org/h5p/embed/ID` | — |
| `*.h5p.com/content/ID` | → `…/embed` | — |

Une vidéo **non reconnue** fait échouer la création/mise à jour d'une fable (`400`),
et un bloc vidéo dont l'URL est non reconnue est refusé (`400`) — y compris en brouillon.

---

## 12. Codes de parrainage

- Format : préfixe = étiquette en majuscules, caractères non alphanumériques retirés,
  6 caractères max (`CE2 · Groupe A` → `CE2GROUPE`), puis `-` et 5 caractères tirés de
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (alphabet sans `I`, `O`, `0`, `1` pour éviter les
  confusions à l'oral). Exemple réel du seed : `CE2A-DEMO1` (le seed impose ses codes).
- Unicité garantie par la base ; jusqu'à 5 tentatives en cas de collision (`500` ensuite).
- Un code **désactivé** bloque connexion **et** inscription (`401`/`404`).
- Supprimer un code ne supprime pas les élèves : `code_id` passe à `NULL`
  (ils perdent alors l'accès aux fables **ciblées**, mais conservent tout leur historique).

---

## 13. Cas limites, règles implicites et pièges pour une réécriture

1. **Un score en attente n'est pas un zéro** : ne pas confondre `score = 0` et
   `score = null` dans les agrégats, le CSV et la file de correction.
2. **Taux de réussite calculé sur les essais corrigés uniquement** — utilisez
   `est_correct IS NOT NULL` comme dénominateur, sinon les statistiques d'une classe
   qui vient d'envoyer une question ouverte s'effondrent.
3. **QCM additif** : une mauvaise réponse retire une bonne. Un élève qui coche tout
   obtient 0.
4. **`maxTentatives` compte les tentatives déjà en base**, y compris celles créées
   avant la modification du barème (effet rétroactif — vérifié : après passage de
   `null` à `1`, la soumission a été refusée car une tentative existait déjà).
5. **Les exercices sont triés par `(ordre, cree_le)`** ; à ordre égal, l'ordre de
   création tranche.
6. **Le ciblage est réévalué à chaque requête** : retirer un code d'une fable masque
   immédiatement la fable et rend les exercices non soumettables (`403`).
7. **Message d'erreur d'authentification volontairement générique**
   (« Pseudo ou code secret incorrect. ») — ne pas le rendre plus précis.
8. **Le pseudo est unique par enseignant, pas globalement** : deux classes peuvent
   avoir un « lina ».
9. **Le pseudo est comparé en `lower()`** côté SQL, mais stocké tel que saisi.
10. **`POST /api/enseignant/fables` accepte `publie: true` directement** : la
    validation de publication *stricte* n'est appliquée que par la bascule dédiée
    (`PUT … {publie:true}`). Créer une fable « publiée » via un POST de formulaire
    contourne donc `validerFablePourPublication` — comportement du code source,
    **conservé** ; à traiter avec prudence lors d'une refonte.
11. **`GET /api/enseignant/fables/[id]` ne renvoie pas les blocs** ; l'éditeur charge
    les blocs via `/blocs`.
12. **Aucune limite de taille n'est imposée sur `fables.texte`** (seulement ≥ 10
    caractères) ni sur `payload` : la taille dépend de PostgreSQL/JSONB.
13. **Les corrections manuelles peuvent être refaites** : `PATCH /reponses/[id]` ne
    vérifie pas que l'essai est déjà corrigé (un enseignant peut réévaluer un score).
14. **La suppression d'un bloc exercice ne supprime pas l'exercice**, mais supprimer
    l'**exercice** supprime les blocs qui le référencent (cascade SQL) et toutes les
    tentatives associées — asymétrie voulue par la conception.
15. **`normaliserUrlImage` accepte les chemins locaux** (`/images/…`) mais le dépôt
    ne contient **aucun dossier `public/`** : les illustrations du seed et l'image du
    héros (`/images/hero-livre-magique.png`) sont introuvables (404) dans la
    reproduction comme dans un déploiement fait depuis ce dépôt seul.
16. **Aucune limitation de débit sur la connexion/inscription** (contrairement à la
    récupération de mot de passe), et aucun mécanisme anti-bruteforce sur le PIN élève
    (4 à 12 caractères) — **[à confirmer avec le propriétaire : risque accepté ?]**.
17. **Confiance implicite dans `payload`** : la notation lit le JSON stocké sans le
    revalider à chaque fois ; une donnée corrompue en base produirait des scores
    incohérents plutôt qu'une erreur (les payloads ne sont validés qu'à l'écriture).
