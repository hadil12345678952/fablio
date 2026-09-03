# Plan d'implémentation — Éditeur pédagogique modulaire par blocs

Document de pilotage. Chaque phase est **indépendante, testable, commitable et réversible**.
Règle absolue : aucune phase ne démarre tant que la précédente n'est pas validée.

Référence : rapport d'audit (état constaté au démarrage).

| Élément | Valeur constatée |
|---|---:|
| Fables | 3 |
| Exercices | 9 (les 8 types représentés) |
| Tentatives | 35 |
| Score moyen | 9,34 |
| Durée cumulée | 2 221 s |
| `liens_moodle_utilisateurs` | 5 |
| `liens_moodle_cours` | 2 |
| `journal_moodle` | 23 |
| Exercices avec `moodle_quiz_id` | 4 (42, 43, 44, 45) |
| Blocs attendus après migration | **15** (3 TEXTE + 3 IMAGE + 9 EXERCICE) |

---

## PHASE 0 — Nettoyage Moodle

**Objectif** : supprimer toute dépendance fonctionnelle Moodle sans perdre une seule donnée historique.

### 0.1 Prérequis de sauvegarde (bloquant)

1. `git init`, commit de référence `etat-avant-refonte`, puis branche `refactor/internal-pedagogical-engine`.
2. Dump PostgreSQL format custom : `pg_dump -Fc` → `sauvegardes/avant-refonte.dump` + checksum SHA-256.
3. **Test de restauration** du dump dans une base jetable (`app_db_verif`) : obligatoire avant toute suppression.
4. Export CSV des données Moodle historiques dans `sauvegardes/` :
   - `liens_moodle_utilisateurs.csv` (5 lignes)
   - `liens_moodle_cours.csv` (2 lignes)
   - `exercices_moodle_quiz_id.csv` (4 lignes : UUID exercice → ID quiz)
   - `journal_moodle.csv` (23 lignes)
5. Capture de la **baseline statistique** dans `sauvegardes/baseline-stats.json` :
   tentatives, exercices testés, score moyen, durée totale, réussite par exercice, points par élève.

### 0.2 Confirmation d'innocuité (résultat de l'audit)

- Les notes Moodle **n'ont jamais été persistées** dans `tentatives` : la table ne contient que des scores du moteur interne.
- `moodle_quiz_id` est un **identifiant externe**, sans contenu pédagogique.
- Aucune dépendance npm spécifique à Moodle.
- Le client `JoueurExercice` **n'exploite pas** le champ `moodle` renvoyé par l'API : sa suppression est transparente côté élève.

→ La suppression est sûre, à condition de respecter l'ordre ci-dessous.

### 0.3 Ordre de suppression (feuilles → racine, build vert à chaque étape)

| # | Action | Fichier(s) |
|---|---|---|
| 1 | Retirer la notation Moodle et le champ `moodle` de la réponse | `src/app/api/exercices/[id]/soumettre/route.ts` |
| 2 | Retirer bouton « Envoyer à Moodle », champ ID quiz, états `moodlePush`/`moodleMsg`, import `estMappableMoodle` | `src/components/enseignant/gestion-exercices.tsx` |
| 3 | Retirer le panneau des tentatives Moodle | `src/app/enseignant/statistiques/page.tsx` |
| 4 | Retirer l'entrée de navigation « Moodle (LMS) » | `src/components/enseignant/nav-enseignant.tsx` |
| 5 | Supprimer page et composants | `src/app/enseignant/integrations/page.tsx`, `integrations-moodle.tsx`, `panneau-moodle-quiz.tsx` |
| 6 | Supprimer les 6 routes API | `src/app/api/integrations/moodle/**` |
| 7 | Supprimer la couche d'intégration (10 fichiers) | `src/integrations/moodle/` |
| 8 | Supprimer plugin, harnais, doc | `local/fablio/`, `scripts/mock-moodle.mjs`, `MOODLE.md` |
| 9 | Nettoyer les types `moodleQuizId` | `validation.ts`, `queries.ts`, `statistiques.ts` |
| 10 | Retirer les mentions Moodle **textuelles** (H5P conservé comme type) | `exercices.ts`, `activite-h5p.tsx`, `app/page.tsx` |
| 11 | Supprimer schéma : 3 tables + colonne | `src/db/schema.ts` puis `drizzle-kit push` |
| 12 | Nettoyer la documentation + rédiger le rapport | `README.md`, `DEPLOIEMENT.md`, `.env.example`, **`MOODLE_REMOVAL.md`** |

> H5P **reste** un des 8 types d'exercices. Seules les phrases citant Moodle comme hébergeur sont réécrites.

### 0.4 Tests de sortie

```text
grep -ri "moodle" src/ scripts/ local/     → 0 résultat (hors MOODLE_REMOVAL.md)
tables liens_moodle_* / journal_moodle     → absentes
colonne exercices.moodle_quiz_id           → absente
tentatives                                  → 35 (inchangé)
score moyen                                 → 9,34 (inchangé)
soumission des 8 types                      → notes identiques à la baseline
next typegen + tsc + build + /api/health    → verts
```

**Rollback** : `git revert` du commit de phase + restauration du dump.

---

## PHASE 1 — Nouveau modèle de données

**Objectif** : créer la structure des blocs. **Aucune écriture de données, aucune suppression de colonne.**

### 1.1 Table `blocs_fable`

| Colonne | Type | Règle |
|---|---|---|
| `id` | UUID PK | `defaultRandom()` |
| `fable_id` | UUID FK → `fables.id` | `ON DELETE CASCADE` |
| `type` | text | `texte` \| `image` \| `audio` \| `video` \| `exercice` |
| `ordre` | integer | 0-based, contigu, `CHECK (ordre >= 0)` |
| `titre` | text | défaut `''` (titre facultatif du bloc) |
| `contenu` | JSONB | configuration propre au type |
| `exercice_id` | UUID FK → `exercices.id` nullable | `ON DELETE CASCADE` — **colonne dédiée, pas un ID enfoui dans le JSON** |
| `visible` | boolean | défaut `true` |
| `cree_le` / `modifie_le` | timestamptz | horodatage |

Index : `(fable_id, ordre)` et `(exercice_id)`.

> Pas de contrainte `UNIQUE(fable_id, ordre)` : elle rendrait le réordonnancement multi-lignes fragile.
> L'invariant est garanti par transaction (voir 4.3).

### 1.2 Registre extensible

```text
src/lib/blocs/
├── types.ts        # TypeBloc, contenus typés, discriminated unions
├── registre.ts     # icône, nom, description, valeur par défaut, actif/inactif
├── validation.ts   # validerContenuBloc(type, contenu)
└── queries.ts      # lecture groupée des blocs d'une fable
```

Ajouter un futur type (`document`, `citation`, `tableau`, `galerie`…) = **une entrée dans le registre**, sans toucher à l'éditeur.

### 1.3 Métadonnées de la fable

Ajout additif : `fables.auteur` et `fables.niveau_scolaire` (`difficulte` conservée, distincte du niveau).

### 1.4 Tests de sortie

Table créée, contraintes vérifiées, application **strictement inchangée** (aucun rendu ne lit encore les blocs).

---

## PHASE 2 — Migration des anciennes fables

**Objectif** : convertir l'existant en blocs, sans perte, de façon vérifiable et réversible.

### 2.1 Script `scripts/migrer-blocs.mjs`

Modes : `--dry-run` (par défaut), `--execute`, `--verify`, `--rollback`.
**Idempotent** : une fable possédant déjà des blocs est ignorée.

### 2.2 Algorithme par fable (une transaction par fable)

```text
1. si des blocs existent déjà → ignorer
2. texte non vide      → bloc TEXTE     (ordre 0, markdown = texte intégral)
3. image_url renseignée → bloc IMAGE    (alt = "Illustration de {titre}")
4. audio_url renseignée → bloc AUDIO
5. video_url renseignée → bloc VIDEO
6. pour chaque exercice (ordre actuel) → bloc EXERCICE (exercice_id = UUID existant)
7. normaliser les ordres 0..n-1
8. commit
```

Règles strictes : **aucun exercice recréé**, **aucun ID modifié**, **aucune tentative touchée**, **aucune notation modifiée**.
Visibilité initiale : `bloc exercice.visible = exercice.publie` ; autres blocs `visible = true`.

### 2.3 Résultat attendu sur la base actuelle

| Fable | TEXTE | IMAGE | EXERCICE | Total |
|---|---:|---:|---:|---:|
| La Cigale et la Fourmi | 1 | 1 | 3 | 5 |
| Le Corbeau et le Renard | 1 | 1 | 3 | 5 |
| Le Lièvre et la Tortue | 1 | 1 | 3 | 5 |
| **Total** | **3** | **3** | **9** | **15** |

### 2.4 Vérifications `--verify`

- 15 blocs, ordres contigus par fable ;
- chaque exercice possède exactement 1 bloc ; aucun `exercice_id` orphelin ;
- contenu texte du bloc **identique caractère par caractère** à `fables.texte` ;
- exercices = 9, tentatives = 35, score moyen = 9,34 (inchangés).

### 2.5 Réversibilité

`--rollback` supprime les blocs générés. Les colonnes `texte`, `image_url`, `audio_url`, `video_url` **restent en place** : l'ancien rendu redevient opérationnel immédiatement.

---

## PHASE 3 — Affichage des blocs (lecture seule)

**Objectif** : afficher avant de permettre de modifier.

### 3.1 Renderer partagé

```text
RenduParcoursFable(blocs, mode)
   mode = "eleve"  → JoueurExercice mode="jeu"
   mode = "apercu" → JoueurExercice mode="apercu"
```

Aiguillage par type : `RenduTexte`, `RenduImage`, `RenduAudio`, `RenduVideo`, `RenduBlocExercice`.

### 3.2 Stratégie de transition (pas de big bang)

```text
si la fable possède des blocs → rendu par blocs
sinon                          → rendu historique actuel
```

### 3.3 Performance imposée

```text
1 requête fable + 1 requête blocs ordonnés
+ 1 requête groupée exercices + 1 requête groupée médias
+ 1 requête tentatives élève
```
Aucune requête par bloc.

### 3.4 Tests de sortie

Les 3 fables s'affichent à l'identique côté élève ; blocs masqués non rendus ; les 8 types d'exercices restent jouables ; scoring inchangé.

---

## PHASE 4 — Gestion des blocs

### 4.1 API

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/enseignant/fables/[id]/blocs` | Liste ordonnée |
| `POST` | `/api/enseignant/fables/[id]/blocs` | Ajouter (position facultative) |
| `PUT` | `/api/enseignant/blocs/[id]` | Modifier contenu / titre / visibilité |
| `DELETE` | `/api/enseignant/blocs/[id]` | Supprimer le bloc **uniquement** |
| `POST` | `/api/enseignant/blocs/[id]/dupliquer` | Copie indépendante |
| `PUT` | `/api/enseignant/fables/[id]/blocs/ordre` | Réordonner (liste d'IDs) |

Chaque route vérifie la propriété enseignant → fable → bloc.

### 4.2 Suppression et duplication

- Supprimer un bloc exercice **ne supprime ni l'exercice ni ses tentatives** (test SQL obligatoire).
- Confirmation explicite avant suppression.
- Dupliquer un bloc exercice = **clone profond de l'exercice** (nouvel UUID, payload copié, 0 tentative). Jamais deux blocs sur la même donnée modifiable.

### 4.3 Normalisation de l'ordre (transaction)

```text
BEGIN → SELECT ... FOR UPDATE (blocs de la fable)
      → positions temporaires (évite les collisions)
      → réécriture stricte 0..n-1
COMMIT
```
Après chaque opération : assertion « ordres contigus et uniques ».

### 4.4 Réordonnancement UI

Flèches ↑/↓ **livrées en V1** (fiables, accessibles, tactiles). Glisser-déposer ajouté ensuite, en conservant les flèches comme secours.

---

## PHASE 5 — Types de blocs

| Sous-phase | Type | Contenu | Validation |
|---|---|---|---|
| 5.1 | **TEXTE** | `{ markdown }` | Markdown existant (paragraphes, gras, italique) + listes et liens ; HTML brut refusé ; non vide |
| 5.2 | **IMAGE** | `{ source, url\|mediaId, alt, legende }` | JPG/JPEG/PNG/WebP, ≤ 5 Mo, **alt obligatoire** avant publication |
| 5.3 | **AUDIO** | `{ source, url\|mediaId, titre, description }` | MP3/WAV/OGG, ≤ 20 Mo, lecteur intégré |
| 5.4 | **VIDÉO** | `{ source: youtube\|vimeo\|bibliotheque, url\|mediaId }` | Liste blanche stricte des domaines ; MP4/WebM ≤ 100 Mo |
| 5.5 | **EXERCICE** | `exercice_id` (colonne FK) | Exercice existant, appartenant à la fable ; **moteur inchangé** |

### 5.6 Bibliothèque de médias (table `medias`)

`id, enseignant_id, type, nom, url, cle_stockage, mime_type, taille_octets, cree_le`.
Stockage objet (Vercel Blob) — **jamais de binaire dans PostgreSQL**. Validation extension + MIME + taille.
Si le stockage n'est pas configuré : upload désactivé proprement, saisie par URL toujours disponible.

### 5.7 Règle non négociable

Les 8 types d'exercices ne sont **ni recodés, ni modifiés, ni renumérotés**. Le bloc ne fait que **référencer** l'exercice ; notation, correction, tentatives et statistiques restent le moteur actuel.

---

## PHASE 6 — Interface enseignant

### 6.1 Éditeur modulaire

```text
┌──────────────────────────────────────────┐
│ LE CORBEAU ET LE RENARD    [Brouillon]   │
│  ✏️ Édition        👁️ Aperçu élève       │
│                                          │
│ [📝 Texte]      ⋮ modifier dupliquer ↑↓ │
│        + Ajouter un contenu              │
│ [🖼️ Illustration]                        │
│        + Ajouter un contenu              │
│ [📝 Exercice — QCM]                      │
└──────────────────────────────────────────┘
```

### 6.2 Modale « Ajouter un contenu »

Grille de **cartes visuelles** (jamais un `<select>`) : icône + nom + description courte + état actif/inactif.
Cartes V1 : Texte, Image, Audio, Vidéo, Exercice.
Cartes futures grisées « bientôt » : Document, PDF, Citation, Encadré, Tableau, Galerie, Question, Activité, H5P autonome.

### 6.3 Actions par bloc

Modifier · Dupliquer · Monter · Descendre · Masquer/Afficher · Supprimer (avec confirmation).

### 6.4 Sauvegarde automatique

Débounce 700–1 000 ms par bloc, requêtes sérialisées, indicateur `⟳ Enregistrement…` / `✓ Enregistré` / `⚠ Échec — réessayer`, bouton manuel conservé.

---

## PHASE 7 — Prévisualisation

- Bascule **Édition / Aperçu élève** utilisant le **même renderer** que la page élève (garantie de fidélité).
- En aperçu : aucune commande d'édition, aucune information technique, seuls les blocs visibles.
- Brouillon / Publié avec validateur avant publication : titre, niveau, ≥ 1 bloc visible, textes non vides, images avec alt, médias valides, vidéos de source autorisée, exercices existants et publiés, aucune référence orpheline. La dépublication reste toujours possible.

---

## PHASE 8 — Vérifications finales

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Création d'une fable neuve | Parcours construit uniquement en blocs |
| 2 | Ancienne fable migrée | 15 blocs, contenu identique à l'origine |
| 3 | Ajout des 5 types | Créés, validés, rendus |
| 4 | Modification | Persistée, `modifie_le` mis à jour |
| 5 | Suppression | Bloc supprimé ; exercice et tentatives intacts |
| 6 | Déplacement / réorganisation | Ordre toujours `0..n-1`, jamais `1,3,3,7` |
| 7 | Plusieurs blocs du même type | Indépendants (duplication testée) |
| 8 | Les 8 types d'exercices | Fonctionnels comme avant |
| 9 | Correction & scoring | Identiques à la baseline |
| 10 | Statistiques | 35 tentatives, score moyen 9,34, distributions inchangées |
| 11 | Données historiques | Aucun UUID modifié |
| 12 | Utilisateurs & permissions | Enseignant A ne voit ni ne modifie les blocs de B ; élève sans accès aux routes d'édition |
| 13 | Affichage mobile | Éditeur et parcours utilisables sur tablette/téléphone |
| 14 | Absence de Moodle | `grep -ri moodle src/` → 0 |
| 15 | Multi-utilisateur | 2 enseignants + 2 élèves en simultané, sans collision d'ordre |

Clôture : `next typegen` + `tsc` + `npm run build` + `build_and_start` + `/api/health`, puis mise à jour `README.md`, `MOODLE_REMOVAL.md` et documentation de rollback.

---

## Synthèse des risques et parades

| Risque | Parade |
|---|---|
| Perte de données historiques | Dump testé + exports CSV + baseline avant toute suppression |
| Suppression accidentelle d'un exercice | `DELETE` bloc ne touche que `blocs_fable` ; test SQL dédié |
| Duplication partageant la même donnée | Clone profond avec nouvel UUID |
| Collisions d'ordre | Transaction + verrouillage + réécriture complète |
| Statistiques faussées | Progression active = blocs visibles ; historique = tous les exercices |
| Média cassé / trop lourd | Liste blanche, validation MIME + taille, stockage objet |
| Régression du moteur d'exercices | Interdiction de modifier `noterExercice`, baseline comparée à chaque phase |

## Ordre des commits

```text
phase-0-suppression-moodle
phase-1-modele-blocs
phase-2-migration-blocs
phase-3-affichage-blocs
phase-4-gestion-blocs
phase-5-types-blocs
phase-6-editeur-enseignant
phase-7-previsualisation
phase-8-verifications
```

Chaque commit est précédé de : tests ciblés → `next typegen` → `tsc` → `build` → compte rendu (modifié / non modifié / à tester / risques).
