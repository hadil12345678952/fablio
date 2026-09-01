# Plugin Moodle `local_fablio`

Moteur pédagogique servant à la plateforme **Fablio**. Il expose des **web services
sécurisés** que Fablio utilise pour créer des quiz/questions, corriger des
tentatives et lire les résultats — **sans que l'enseignant ait à manipuler
l'administration Moodle** ni à copier d'identifiant.

## Cible (Phase B — version analysée)

| Élément | Valeur |
|---|---|
| **Moodle** | **4.5 (LTS)** — version `2024100700`. Testée jusqu'à 4.5.x ; adaptable 4.4 / 5.x (voir « compatibilité »). |
| **PHP** | 8.1 – 8.3 (requis par Moodle 4.5). |
| **PHPUnit** | non requis (aucun test unitaire fourni dans cette version). |
| **API utilisées** | `add_moduleinfo` (création de module de cours), `question_bank::get_qtype()->save_question` (banque de questions), `quiz_slots` (ajout au quiz), capacités + contextes. |

## Architecture du plugin

```
/local/fablio
├── version.php              # composant local_fablio, requiert Moodle 4.5
├── db/
│   ├── access.php           # capacités local/fablio:manage / :view
│   ├── services.php         # service « fablio-ws » + les 9 fonctions
│   └── install.xml          # table local_fablio_results (tentatives/notes)
├── lang/{en,fr}/local_fablio.php
├── classes/
│   ├── helper.php           # moteur : quiz, questions, slots, correction, résultats
│   └── external.php         # déclarations des fonctions des web services
└── README.md
```

## Web services fournis

| Fonction | Type | Rôle |
|---|---|---|
| `local_fablio_get_site_info` | read | Identifie le site et le compte porteur du jeton |
| `local_fablio_create_quiz` | write | Crée un quiz dans un cours (`courseid, name, intro, maxgrade` → `quizid, coursemoduleid`) |
| `local_fablio_list_quizzes` | read | Liste les quiz d'un cours |
| `local_fablio_create_question` | write | Crée une question (banque) et l'ajoute au quiz (`quizid, qtype, name, questiontext, maxmark, data`-JSON) |
| `local_fablio_get_quiz_detail` | read | Détail du quiz : questions, barème, nombre |
| `local_fablio_set_quiz_visible` | write | Publier / dépublier un quiz |
| `local_fablio_submit_attempt` | write | Corrige une tentative d'élève et renvoie la note |
| `local_fablio_get_attempts` | read | Tentatives + notes (source de vérité) |
| `local_fablio_get_progress` | read | Progression / meilleur score d'un élève |

## Installation du plugin sur Moodle

1. `cd /chemin/vers/moodle` puis `cp -r local/fablio local/` (ou déposez le dossier
   dans `local/`).
2. Purge des caches : `php admin/cli/purge_caches.php` (ou **Site admin → Notifications**).
3. **Site administration → Notifications** : installez le plugin (crée la table
   `local_fablio_results`), puis **Attributions de rôles** : le compte de service
   (`svc-fablio`) doit avoir les capacités `local/fablio:manage` et
   `local/fablio:view` (attribuez le rôle enseignant/gestionnaire).

## Activation du service `fablio-ws`

1. **Administration du site → Fonctionnalités avancées → Web services** : activer.
2. **Serveur → Web services → Protocoles** : activer **REST**.
3. **Serveur → Web services → Services externes → Ajouter** ; choisissez
   « fablio-ws » (auto-déclaré par le plugin) et cochez « Utilisateur
   autorisé » (vous devrez ajouter `svc-fablio`).
4. **Serveur → Web services → Jetons → Ajouter** : utilisateur `svc-fablio`,
   service `fablio-ws`. Copiez le jeton → c'est le `MOODLE_TOKEN` côté Fablio.
5. Le compte `svc-fablio` doit être **enseignant** sur la catégorie de cours
   utilisée (il crée les cours/quiz via le plugin).

## Compatibilité

- **Moodle 4.5** (cible) : `save_question` + `add_moduleinfo` + `quiz_slots` ✔ plus
  stables. En cas d'installation sur **4.4**, retirer la ligne
  `$plugin->requires = 2024100700` (ou l'abaisser) et vérifier `question_match_sub`.
- **Moodle 5.x** : tableau `topic` (futur) et déplacement vers `/public` ; les API
  de banque de questions restent valides mais à re-valider (test fonctionnel recommandé).
- **PHP 8.1–8.3** : typage déclaré, `\core_text::remove_accents`, `mb_*` utilisés.

## Limites documentées

- Le calcul de la note repose sur un correcteur autonome du plugin (tables de
  résultats Fablio), **pas** sur le moteur de tentatives natif de Moodle. Les
  quiz/questions créés sont **réels** (visibles et modifiables dans la banque), les
  notes sont stockées dans `local_fablio_results` (elle-même lisible via WS).
- Les types `ordre`, `video_interactive`, `h5p` n'ont pas d'équivalent natif
  robuste : ils restent **exécutés par Fablio** (moteur natif). Voir MOODLE.md.
