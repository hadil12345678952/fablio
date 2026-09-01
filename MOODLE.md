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

> **Contrainte du protocole officiel (documentée)** : les web services *cœur* de
> Moodle ne permettent **pas** de créer des quiz / banques de questions à distance,
> et `mod_quiz_start_attempt` / `save_attempt` s'exécutent **au nom de l'utilisateur
> du jeton** (impossible de faire passer une tentative « pour » un autre élève avec
> un jeton unique). Options d'évolution, sans changer d'architecture :
> 1. créer les quiz dans Moodle (interface Moodle) puis les lier via `moodleQuizId` ;
> 2. émettre un jeton **par utilisateur** Moodle (SSO de tentatives) ;
> 3. installer un **plugin Moodle local** (ex. `local_wsquiz`) exposant la création
>    de questions — la couche `src/integrations/moodle` est prête pour ces fonctions.

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
| `GET /api/integrations/moodle/quiz/[id]/tentatives` | Tentatives + notes d'un quiz lié |
