# Intégration Moodle — moteur pédagogique (LMS) de Fablio

Ce document décrit l'intégration **progressive, sécurisée et réversible** de Moodle
comme moteur LMS de la plateforme Fablio.

## 1. Architecture cible

```
 Élève / Enseignant (interface Fablio — fables, navigation, dashboards)
        │
        ▼ Next.js (backend plateforme — couche métier spécialisée)
        │
        ▼ Couche d'intégration dédiée  src/integrations/moodle/   (serveur uniquement)
        │  client(HTTP, timeout, retry, erreurs) + utilisateurs + cours + quiz + journal
        │
        ▼ Moodle Web Services — POST {MOODLE_URL}/webservice/rest/server.php
   Moodle : comptes, cours, inscriptions, quiz, tentatives, notes
```

**Règles** : aucun appel Moodle depuis un composant client ; le jeton
(`MOODLE_TOKEN`) vit uniquement dans les variables d'environnement du serveur ;
aucune donnée pédagogique n'est *dupliquée* — seuls des **identifiants de liaison**
sont stockés (tables `liens_moodle_*`) ; sans configuration, la plateforme
fonctionne **exactement** comme avant (mode dégradé par conception).

## 2. Matrice des responsabilités (mapping Plateforme ↔ Moodle)

| Fonction | Plateforme Fablio | Moodle |
|---|---|---|
| Identité visuelle, navigation, expérience | ✅ source | — |
| Comptes (enseignant, élèves) | ✅ source maîtresse | 🔁 synchronisés (1↔1, idempotent) |
| Classes / codes de parrainage | ✅ un code = une classe | 🔁 un cours Moodle par code |
| Fables, textes, morale, auteurs, niveaux | ✅ source | référence dans le cours |
| Exercices natifs (8 types) + notation | ✅ moteur local | option : liaison à un quiz existant |
| Tentatives Moodle, notes de quiz | 📊 affichage dans Statistiques | ✅ source de vérité |
| Tentatives natives + progression plateforme | ✅ source | — |
| Configuration connexion (URL, jeton) | ✅ serveur (env) | ← alimente |

## 3. Correspondance des types d'exercices (Phase 7 — analyse)

| Exercice plateforme | Équivalent Moodle le plus proche | Statut dans cette version |
|---|---|---|
| QCM | `qtype_multichoice` dans un quiz | Lien manuel vers quiz existant (`moodleQuizId`) |
| Vrai / Faux | `qtype_truefalse` | Lien manuel |
| Question ouverte (auto) | `qtype_shortanswer` | Lien manuel |
| Question numérique | `qtype_numerical` | Lien manuel |
| Texte à trous | `qtype_multianswer` (Cloze) | Lien manuel |
| Remise en ordre | *(pas d'équivalent natif ; plugin)* | Reste plateforme |
| Association | `qtype_match` | Reste plateforme (ou quiz manuel) |
| Vidéo interactive | *(pas d'équivalent natif)* | Reste plateforme |
| Activité H5P | H5P via onglet d'intégration Fablio | Reste plateforme |

> **Résolution de la contrainte WS cœur** : le plugin **`local/fablio`**
> (voir _Évolution — moteur pédagogique_) expose les fonctions de création de
> quiz/questions et de notation, que la couche Fablio appelle. **Plus aucun
> copier-coller d'ID Moodle** : l'enseignant crée ses activités depuis Fablio et
> Fablio stocke seul le mapping `exercices.moodle_quiz_id`.

## 4. Mise en place côté Moodle (une fois)

1. **Activer les web services** : Administration du site → Fonctionnalités avancées →
   *Web services* → « Activer ». Puis *Protocoles* → activer **REST**.
2. **Créer un service externe** : Administration → Serveur → Web services → Services
   externes → **Ajouter** (ex. nom : `fablio-ws`).
3. **Fonctions à autoriser** (le strict nécessaire) :
   - `core_webservice_get_site_info`
   - `core_user_get_users`, `core_user_get_users_by_field`, `core_user_create_users`
   - `core_course_get_courses_by_field`, `core_course_create_courses`
   - `enrol_manual_enrol_users`
   - `mod_quiz_get_quizzes_by_courses`, `mod_quiz_get_user_attempts`
   - `core_user_get_users_by_field`
4. **Créer le compte de service** : utilisateur `svc-fablio` avec rôle
   **enseignant** (ou gestionnaire) sur la catégorie cible.
5. **Créer le jeton** : Administration → Web services → Jetons → Ajouter →
   utilisateur `svc-fablio` + service `fablio-ws`. Copier le jeton (secret).
6. **Variables côté Fablio** :
   ```env
   MOODLE_URL=https://votre-moodle.tn
   MOODLE_TOKEN=<jeton>
   MOODLE_SERVICE=fablio-ws        # optionnel (affichage)
   MOODLE_CATEGORY_ID=1            # optionnel (catégorie des cours créés)
   ```
7. **Tester** : page enseignant « **Moodle (LMS)** » → *Tester la connexion*.
   Le test appelle `core_webservice_get_site_info` et affiche le nom/version du site.

## 5. Synchronisation (idempotente)

Bouton « Synchroniser comptes, cours et inscriptions » :

```
Enseignant → compte Moodle (email réel ; rattachement si déjà existant)
   ↓ mapping liens_moodle_utilisateurs
Élèves de l'enseignant → comptes Moodle (email technique <pseudo>.<id>@eleves.fablio.local)
   ↓ mapping
Chaque code de classe → cours « Fables françaises — <classe> » (shortname fablio-<CODE>)
   ↓ inscription : enseignant (rôle 3), élèves (rôle 5)
```

Relancer la synchronisation ne crée **jamais** de doublon (mapping local en priorité,
sinon recherche par email/shortname, sinon création). Toutes les opérations sont
tracées dans le **journal** de la page d'intégration.

## 6. Lier un exercice à un quiz Moodle

1. Créez le quiz dans Moodle (types `multichoice`, `truefalse`, `shortanswer`…).
2. Notez son **ID** (visible dans l'URL `mod/quiz/view.php?id=…`).
3. Fablio → fiche exercice → « Lien avec un quiz Moodle » → collez l'ID.
4. La page **Statistiques** affiche alors, sous l'exercice, le panneau
   « Tentatives du quiz Moodle » (nom, note max, tentatives par utilisateur,
   dates début/fin) — Moodle reste la source.

## 7. Mode dégradé et gestion des erreurs

- Sans `MOODLE_URL`/`MOODLE_TOKEN` : la page d'intégration indique la configuration à
  faire ; tout le reste (fables, exercices, statistiques natives) fonctionne.
- Moodle injoignable (timeout 12 s × 2, erreurs 5xx, exceptions Moodle) :
  message lisible « Le service d'évaluation est temporairement indisponible » et
  les pages plates n'échouent jamais — les détails techniques vont au journal.
- **Réversible à 100 %** : supprimez les variables d'environnement pour désactiver
  l'intégration ; les tables `liens_moodle_*` n'impactent rien.

## 8. Harnais de test (sans Moodle réel)

`node scripts/mock-moodle.mjs` émule le point d'entrée REST (comptes, cours,
inscriptions, quiz, tentatives) sur `http://127.0.0.1:8901` :

```bash
node scripts/mock-moodle.mjs &
echo 'MOODLE_URL=http://127.0.0.1:8901' >> .env
echo 'MOODLE_TOKEN=demo-token' >> .env
# … relancer l'app, puis sur la page « Moodle (LMS) » :
# 1) « Tester la connexion »  2) « Synchroniser »
curl http://127.0.0.1:8901/__etat   # assertions : utilisateurs/cous créés
```

## 9. Table des routes d'API ajoutées

| Route | Rôle |
|---|---|
| `GET /api/integrations/moodle/statut` | État (config, liaisons, journal) — enseignant |
| `POST /api/integrations/moodle/tester` | Test jeton + joignabilité (`get_site_info`) |
| `POST /api/integrations/moodle/synchroniser` | Comptes + cours + inscriptions (idempotent) |
| `POST /api/integrations/moodle/activite` | **Crée le quiz + questions Moodle depuis un exercice** (aucun ID à saisir) |
| `POST /api/integrations/moodle/migrer` | **Migration** des exercices existants vers Moodle |
| `GET /api/integrations/moodle/quiz/[id]/tentatives` | Tentatives + notes d'un quiz lié |

---

# ÉVOLUTION — Moodle comme véritable moteur pédagogique

## A. Principe

L'enseignant crée son activité **uniquement dans Fablio** (fable, niveau,
compétence, type, questions, réponses, points). Fablio appelle le plugin
`local_fablio`, qui crée le quiz + les questions dans Moodle, renvoie l'ID, et
Fablo le stocke. L'élève reste dans Fablio ; à la validation, Fablio transmet la
réponse au plugin, **Moodle corrige et calcule la note** (source de vérité), puis
Fablo l'affiche dans ses dashboards.

## B. Web services du plugin `local_fablio`

| Fonction | Création/lecture | But |
|---|---|---|
| `local_fablio_create_quiz` | write | quiz + coursemoduleid |
| `local_fablio_create_question` | write | question (banque) + ajout au quiz |
| `local_fablio_get_quiz_detail` / `list_quizzes` | read | détail, barème, questions |
| `local_fablio_set_quiz_visible` | write | publier / dépublier |
| `local_fablio_submit_attempt` | write | corrige une tentative, renvoie note |
| `local_fablio_get_attempts` / `get_progress` | read | notes et progression |

## C. Correspondance Fablio → Moodle (automatique)

| Type Fablio | Question Moodle | Push |
|---|---|---|
| QCM | `multichoice` | ✅ automatique |
| Vrai / Faux | `truefalse` | ✅ automatique |
| Question courte (auto) | `shortanswer` | ✅ automatique |
| Texte à trous | N × `shortanswer` (un par trou) | ✅ automatique |
| Association | `matching` | à venir |
| Ordre / Vidéo interactive / H5P | — | reste Fablio (moteur natif) |

## D. Installation du plugin

Voir `local/fablio/README.md` : copier `local/fablio` dans `/local`, purger les
caches, installer via **Notifications**, puis configurer le service `fablio-ws`
(Activer web services → REST → Service externe `fablio-ws` → Jeton pour
`svc-fablio` qui possède `local/fablio:manage` et `:view`).

## E. Création d'une activité (côté Fablio)

1. Fiche fable → « Envoyer à Moodle » sur un exercice convertible (QCM, V/F,
   réponse courte auto, texte à trous) → Fablio crée quiz + questions.
2. Le bouton affiche alors « Moodle n°X » (re-cliquer recrée/relie).
3. « Tout synchroniser » (route `/migrer`) migre progressivement les exercices
   existants non encore liés.
4. À la soumission d'un exercice lié, Fablio demande la note au plugin : si
   Moodle est indisponible, **le score natif Fablio est conservé** (mode dégradé).

## F. Limites connues

- Correcteur autonome (table `local_fablio_results`) : les quiz/questions créés
  sont réels et éditables dans la banque ; la note vient de ce moteur interne.
- `association`, `ordre`, `video_interactive`, `h5p` restent natifs Fablio.
- Un quiz Moodle = un exercice Fablio, hébergé dans le cours de la première
  classe ciblée (ciblage multi-classes à venir).
- Plugin validé par **harnais** (`node scripts/mock-moodle.mjs`) ; à ré-éprouver
  sur l'instance Moodle 4.5 réelle (PHP 8.1–8.3) avant mise en production.
