# Rapport de retrait de l'intégration Moodle — PHASE 0

Date d'exécution : phase 0 du chantier « éditeur pédagogique modulaire ».
Branche : `refactor/internal-pedagogical-engine`
Commit de référence (rollback) : **`012f46a`** — *etat-avant-refonte* (branche `main`)

Ce document conserve la mémoire de l'intégration supprimée. Il est le **seul**
fichier du dépôt autorisé à mentionner Moodle.

---

## 1. Sauvegardes réalisées avant toute suppression

| Élément | Emplacement | Vérification |
|---|---|---|
| Dump PostgreSQL complet (format custom) | `sauvegardes/avant-refonte.dump` | 30 075 octets |
| Empreinte SHA-256 | `sauvegardes/avant-refonte.dump.sha256` | `de626f9c6e2a256b632b6ace8d264977188122376e52abd0b2ecacea852a57b4` |
| **Test de restauration réel** | base jetable `app_db_verif` | ✅ 3 fables · 9 exercices · 35 tentatives · 4 élèves · 5 liens utilisateurs · 2 liens cours · 23 journaux |
| Commit Git de référence | `main` → `012f46a` | 116 fichiers suivis |

## 2. Données Moodle historiques exportées (conservées)

| Fichier | Lignes | Contenu |
|---|---:|---|
| `sauvegardes/liens_moodle_utilisateurs.csv` | 5 | mapping compte plateforme ↔ compte Moodle |
| `sauvegardes/liens_moodle_cours.csv` | 2 | mapping classe ↔ cours Moodle |
| `sauvegardes/journal_moodle.csv` | 23 | journal des synchronisations |
| `sauvegardes/exercices_moodle_quiz_id.csv` | 4 | exercice → quiz Moodle |
| `sauvegardes/baseline-stats.json` | — | baseline statistique complète (global, par exercice, par élève) |

Correspondances `moodle_quiz_id` conservées dans le CSV :

| Fable | Type d'exercice | Quiz Moodle |
|---|---|---:|
| La Cigale et la Fourmi | QCM | 42 |
| La Cigale et la Fourmi | Vrai/Faux | 43 |
| La Cigale et la Fourmi | Texte à trous | 44 |
| Le Lièvre et la Tortue | QCM | 45 |

## 3. Preuves d'innocuité (établies avant suppression)

1. **Aucune note Moodle persistée** : la table `tentatives` ne contient que
   `score`, `max_score`, `est_correct` alimentés par le moteur interne Fablio.
   Les 35 scores sont donc d'origine locale.
2. **Champ `moodle` de l'API non consommé** : aucun composant client ne lisait
   la propriété `moodle` renvoyée par `/api/exercices/[id]/soumettre`.
3. **Aucune dépendance npm** liée à Moodle dans `package.json`.
4. **21 tentatives** portaient sur des exercices liés à un quiz Moodle : leur
   score provenait du moteur local, elles sont intégralement conservées.

## 4. Ce qui a été supprimé

### Fichiers et répertoires

```text
src/integrations/moodle/            (10 fichiers : client, config, conversion,
                                     cours, creation, index, journal, quiz,
                                     types, utilisateurs)
src/app/api/integrations/           (6 routes API)
src/app/enseignant/integrations/    (page « Moodle (LMS) »)
src/components/enseignant/integrations-moodle.tsx
src/components/enseignant/panneau-moodle-quiz.tsx
local/fablio/                       (plugin Moodle PHP complet)
scripts/mock-moodle.mjs             (harnais de test)
MOODLE.md                           (documentation d'intégration)
```

### Routes API retirées

```text
GET  /api/integrations/moodle/statut
POST /api/integrations/moodle/tester
POST /api/integrations/moodle/synchroniser
POST /api/integrations/moodle/activite
POST /api/integrations/moodle/migrer
GET  /api/integrations/moodle/quiz/[id]/tentatives
```

### Base de données

```sql
BEGIN;
DROP TABLE IF EXISTS liens_moodle_utilisateurs;   -- 5 lignes exportées
DROP TABLE IF EXISTS liens_moodle_cours;          -- 2 lignes exportées
DROP TABLE IF EXISTS journal_moodle;              -- 23 lignes exportées
ALTER TABLE exercices DROP COLUMN IF EXISTS moodle_quiz_id;  -- 4 valeurs exportées
COMMIT;
```

Tables restantes (7, toutes métier) : `enseignants`, `codes_parrainage`,
`eleves`, `fables`, `exercices`, `tentatives`, `sessions`.

### Variables d'environnement retirées de la documentation

```text
MOODLE_URL   MOODLE_TOKEN   MOODLE_SERVICE   MOODLE_CATEGORY_ID
```

## 5. Ce qui a été conservé (aucune régression)

- Le **moteur d'exercices** et ses **8 types** : `qcm`, `vrai_faux`,
  `texte_trous`, `ordre`, `association`, `question_ouverte`,
  `video_interactive`, `h5p` — code non modifié.
- `noterExercice()`, `corrigeExercice()`, `validerPayload()` : **inchangés**.
- Les 35 tentatives, leurs scores, durées et UUID.
- Les statistiques (élève, fable, exercice), l'export CSV, la correction manuelle.
- La synthèse vocale, la vidéo interactive, les médias par lien, H5P.
- Les codes de parrainage, les comptes, les sessions, les permissions.

> **H5P reste un type d'exercice à part entière.** Seules les phrases citant
> Moodle comme hébergeur possible ont été reformulées (« votre LMS ») ; la
> fonctionnalité accepte toujours n'importe quelle URL d'intégration HTTPS.

## 6. Vérifications après suppression

| Contrôle | Attendu | Obtenu |
|---|---|---|
| `grep -ri moodle src/ scripts/` | 0 | ✅ 0 |
| Tables `liens_moodle_*` / `journal_moodle` | absentes | ✅ absentes |
| Colonne `exercices.moodle_quiz_id` | absente | ✅ absente |
| Colonnes contenant « moodle » | 0 | ✅ 0 |
| Fables | 3 | ✅ 3 |
| Exercices | 9 | ✅ 9 |
| Tentatives | 35 | ✅ 35 |
| Exercices testés | 9 | ✅ 9 |
| Score moyen | 9,34 | ✅ 9,34 |
| Score total | 289,50 | ✅ 289,50 |
| Durée cumulée | 2 221 s | ✅ 2 221 s |
| Tentatives réussies | 19 | ✅ 19 |
| Tentatives en attente | 4 | ✅ 4 |
| `drizzle-kit push` | schéma synchronisé | ✅ *No changes detected* |
| `next typegen` / `tsc` / `build` | verts | ✅ verts |

## 7. Procédure de rollback

### Code

```bash
git checkout main            # état avant refonte (012f46a)
# ou, pour annuler uniquement la phase 0 :
git revert <sha-du-commit-phase-0>
```

### Base de données

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pg_restore -d "$DATABASE_URL" sauvegardes/avant-refonte.dump
# vérifier l'empreinte au préalable :
sha256sum -c sauvegardes/avant-refonte.dump.sha256
```

### Instance Moodle externe (le cas échéant)

Si le plugin `local_fablio` avait été installé sur un Moodle réel, il doit être
désinstallé séparément depuis **Administration du site → Plugins → Vue
d'ensemble → local_fablio → Désinstaller**, puis le jeton du service
`fablio-ws` doit être révoqué. Aucune action n'est requise si le plugin n'a
jamais été déployé (cas du présent projet : validé uniquement via harnais).
