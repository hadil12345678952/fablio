# Fablio — Rapport de tests

> Toutes les commandes et tous les résultats ci-dessous ont été **réellement exécutés**
> dans le Workspace. Aucun résultat n'est extrapolé ; les tests non exécutables sont
> listés au §5 avec leur raison exacte.

---

## 1. Environnement de test

| Élément | Valeur |
|---|---|
| Système | conteneur Linux, **aucun accès réseau sortant** sauf `github.com`, `registry.npmjs.org`, `pypi.org` (contrainte de l'environnement d'analyse) |
| Node.js / npm | `v22.22.3` / `10.9.8` |
| Application | Next.js **16.2.6**, React **19.2.6**, TypeScript 5.9.3, Tailwind CSS 4.1.17, Drizzle ORM 0.45.2, `pg` 8.20.0, `bcryptjs` 3.0.3 |
| Base de données | PostgreSQL **16.2** local (`scripts/pg-local.sh`), base `app_db`, port 5432 |
| Serveur applicatif | `npx next start -H 0.0.0.0 -p 3000` (build de production), journal `/tmp/serveur-fablio.log` |
| Données | jeu de démonstration du dépôt : 3 fables, 9 exercices, 3 élèves, 2 codes, **23 tentatives**, **16 blocs** |
| Identifiants utilisés | `demo.enseignant@fablio.tn` / `demo1234` · élèves `lina` `samy` `nour` / code `CE2A-DEMO1` ou `CE2B-DEMO2` / code secret `1234` (identifiants **de démonstration, publics dans le dépôt**) |

---

## 2. Commandes exécutées et résultats

| # | Commande | Code de sortie | Résultat observé |
|---|---|---|---|
| 1 | `npm install` | 0 | Dépendances installées. **Le dépôt n'a pas de lockfile** → un `package-lock.json` a été **généré** (non suivi par Git). L'audit de sécurité correspondant est la ligne 14 (3 vulnérabilités) |
| 2 | `node scripts/setup-db.mjs` | 0 | 9 tables + index + contraintes créés (idempotent, relançable) |
| 3 | `node scripts/seed.mjs` | 0 | `Base de démonstration prête (23 tentatives enregistrées).` |
| 4 | `node scripts/migrer-blocs.mjs --dry-run` | 0 | 16 blocs cibles annoncés, base non modifiée |
| 5 | `node scripts/migrer-blocs.mjs --execute` | 0 | 16 blocs créés (`texte=3 image=3 audio=0 video=1 exercice=9`), `5/5/6` par fable |
| 6 | `node scripts/migrer-blocs.mjs --execute` (relance) | 0 | **Idempotent** : « ignorée (déjà 5/5/6 blocs) », total inchangé |
| 7 | `node scripts/migrer-blocs.mjs --verify` | 0 | `✓ VERIFY OK (6 blocs, 3 exercices)` par fable + `BASELINE : fables=3 exercices=9 tentatives=23 score_moyen=9.10 score_total=182.00 duree=1533 reussies=11 en_attente=3` |
| 8 | `npx tsc --noEmit` | **0** | **0 erreur** de typage (journal `/tmp/rapport/tsc-final.txt`) |
| 9 | `npm run lint` | **1** | **15 erreurs, 0 avertissement** — **toutes préexistantes** dans `src/components/**` : `enseignant/gestion-exercices.tsx` (3), `blocs/editeur-pedagogique.tsx`, `blocs/editeurs-types.tsx`, `blocs/rendu-parcours-fable.tsx` (1), `exercice/joueur-exercice.tsx` (1). Règles React Compiler/Next : appel de fonction impure pendant le rendu, accès aux `ref` pendant le rendu, réaffectation après le rendu. **Aucun de ces fichiers n'appartient à la reproduction** (0 occurrence de `scripts/` ou `tests/` dans la sortie du linter) → à traiter dans une tâche dédiée, non corrigé ici |
| 10 | `npx next build` (avec simulation des fontes, cf. §4) | **0** | `✓ Compiled successfully in 10.3s`, `✓ Generating static pages (32/32)`, table de routes : **31 routes API** + **16 pages** (+ `/_not-found`, `/icon.svg`). Journal `/tmp/rapport/build-final.txt` |
| 11 | `npx next start -H 0.0.0.0 -p 3000` | — | `✓ Ready in 114ms` ; `GET /api/health` → `{"ok":true}` (exécute réellement `select 1`) |
| 12 | `node tests/e2e-fablio.mjs` | **0** | **113/113 vérifications réussies** (≈2,5 s) sur le build de production courant — journaux `/tmp/rapport/e2e-final.txt`, `/tmp/e2e-final.txt`. La suite a été enrichie des tests des correctifs (§ nouvelle section 3.1 : ordre des blocs, ordre renvoyé, insertion positionnée, duplication, déplacement haut/bas, diagnostic `/api/health`) |
| 13 | `node scripts/reinitialiser-demo.mjs --confirmer` | 0 | Base remise à l'état du seed ; **idempotent** (relance → même état final) |
| 14 | `npm audit --omit=dev` | 1 | **3 vulnérabilités : 1 critique, 2 hautes** — `next` 16.2.6 (direct, critique : contournement de middleware, RCE via l'optimisation d'images, SSRF, DoS, confusions de cache), `postcss` (haute) et `sharp` 0.34.5 (haute, libvips/libheif/librsvg) ; correctif proposé **`next@16.4.1`**. **Non corrigé ici** (reproduction fidèle de l'état du dépôt) — action recommandée côté exploitation, voir `docs/replication-status.md` §3.9 |

### 2.1 Détail de la suite E2E (18 sections, 110 vérifications)

| Section | Vérifications |
|---|---|
| 1. Pages publiques et sonde de santé | 7 |
| 2. Sessions et cloisonnement (401 sans cookie) | 5 |
| 3. Connexion et inscriptions | 6 |
| 4. Codes de parrainage et données de démonstration | 3 |
| 5. Règles de notation (moteur `noterExercice`) via l'API | 11 |
| 6. Correction manuelle (question ouverte et H5P) | 5 |
| 7. Limite de tentatives (`maxTentatives`) | 5 |
| 8. Création et validation de fables | 6 |
| 9. Blocs pédagogiques (invariant d'ordre, publication, cascade) | 18 |
| 10. Suppression du bloc ≠ suppression de l'exercice | 4 |
| 11. Cloisonnement enseignant ↔ élève (rattachement et ciblage) | 7 |
| 12. Statistiques et export CSV | 11 |
| 13. Réinitialisation du PIN par l'enseignant | 5 |
| 14. Récupération de mot de passe enseignant (anti-énumération) | 6 |
| 15. Synthèse vocale (`/api/tts`) | 2 |
| 16. Pages authentifiées (rendu serveur) | 5 |
| 17. Déconnexion | 2 |
| 18. Nettoyage des artefacts de test | 2 |
| **Total** | **110** |

Points de contrat explicitement assertés : messages et statuts HTTP exacts, réponse
d'authentification générique, aucun hachage renvoyé par `/api/auth/moi`, invariants
d'ordre des blocs, refus de publication d'un parcours incomplet avec `detailsValidation`,
ciblage par code de classe (403 en soumission), notation additive du QCM, arrondi au
quart, correction en attente (`null`), BOM et en-têtes du CSV, révocation de session.

---

## 3. Sondes manuelles ciblées (au-delà de la suite)

| Sonde | Méthode | Résultat |
|---|---|---|
| **Signale l'absence de `DATABASE_URL`** | serveur relancé sans la variable (port 3100, `.env` écarté puis restauré) | `/`, `/api/health`, `/api/enseignant/fables` → **500** ; journal : `Error: DATABASE_URL is required`. Aucun repli silencieux sur une base par défaut |
| **Diagnostic du transport de courriel** | `GET /api/health` avec puis sans `RESEND_API_KEY` | `{"ok":true,"courriel":"resend"}` puis `{"ok":true,"courriel":"journal"}` — aucune donnée secrète exposée |
| **Base non migrée (`blocs_fable` absente)** | `ALTER TABLE blocs_fable RENAME TO blocs_fable_masquee` (puis restauration) | Lectures **200** : la page élève retombe sur le rendu historique, `GET …/blocs` → `{"blocs":[]}` ; seule la **création** échoue en **400** avec le message pointant vers `scripts/setup-db.mjs` ; `/api/health` → 200. Aucun 500 |
| **Anti-énumération (mot de passe)** | demande sur un compte existant vs inconnu | Réponses **identiques octet pour octet** (empreinte MD5 `169486e762d3` des deux corps) ; la réponse ne contient jamais de jeton |
| **Quota de récupération** | 4 demandes consécutives | Les **3 premières** créent un jeton ; la 4ᵉ renvoie `200` mais **ne crée rien** (vérifié en base) → **3 demandes / 15 min / compte** |
| **Un seul jeton actif** | 2ᵉ demande puis test du 1ᵉʳ lien | Le lien précédent devient **invalide** ; le dernier fonctionne |
| **Parcours complet de réinitialisation** | demande → lien journalisé (43 caractères) → `GET` validation (`valide:true`) → `POST` nouveau mot de passe | Ancien mot de passe **401**, nouveau **200**, rejeu du même jeton **refusé** ; **toutes les sessions du compte sont supprimées** (5 → 0 ; seule une reconnexion crée une session) |
| **Réinitialisation du PIN élève** | `PATCH /api/enseignant/stats/eleves/[id]` | Ancienne valeur refusée, nouvelle acceptée ; un autre enseignant reçoit **404** |
| **Réponse de l'optimiseur d'images** | `GET /_next/image?url=%2Ficon.svg&w=64&q=75` | **400** `"url" parameter is valid but image type is not allowed` — comportement Next par défaut pour un SVG (optimisation SVG désactivée). L'optimisation d'images distantes n'est **pas** testable sans réseau sortant |
| **Méthode non implémentée** | `GET /api/enseignant/exercices/44444444-…` | **405** (aucun handler `GET` : à documenter pour les intégrateurs) |
| **Page privée sans session** | `GET /enseignant` sans cookie | **200** sans aucune donnée privée (seul `<title>`), puis `<meta http-equiv="refresh" content="1;url=/connexion?role=enseignant">` (redirection par streaming de Next 16, `digest NEXT_REDIRECT … 307`). Le garde-fou serveur fonctionne ; le testeur doit attendre un 200 + méta-redirection, **pas** un 307 |
| **Lecture à voix haute hors ligne** | `POST /api/tts {texte:"Bonjour les élèves."}` | **502** avec message invitant à utiliser la voix du navigateur ; aucun plantage serveur (journal propre) |
| **Export CSV, octets réels** | `GET /api/enseignant/export/resultats.csv` | `200 text/csv; charset=utf-8`, **BOM `EF BB BF`**, 24 lignes = en-tête + 23 tentatives, séparateur `;` |
| **Ordre des blocs — AVANT correction** (constat d'audit) | fable neuve + 4 créations successives (`texte`, `image`, `audio`, `video`), état relu après chaque appel, puis suppression d'un bloc ; preuve SQL indépendante sur les valeurs intermédiaires (transaction annulée) | `T@0` → `I@0 T@1` → `A@0 T@1 I@2` → `V@0 I@1 T@2 A@3` ; après suppression : `A@0 I@1 V@2`. Nouveau bloc **en tête**, blocs existants **inversés**. |
| **Ordre des blocs — APRÈS correction** | même sonde, sur le build corrigé | `T@0` → `T@0 I@1` → `T@0 I@1 A@2` → `T@0 I@1 A@2 V@3` ; `position: 1` place bien le bloc en 1 ; suppression → `T@0 T@1 A@2 V@3` ; duplication du bloc @0 → **ordre 1** (juste après la source) ; invariant de contiguïté vrai après **chaque** opération. ✅ `docs/correctifs-appliques.md` §2 |
| **Courriel de réinitialisation (cas nominal)** | serveur démarré avec le double de test Resend (`tests/intercepteur-resend.cjs`) répondant **200**, `RESEND_API_KEY` et `COURRIEL_EXPEDITEUR` définis | Un message réellement formé est capturé : `from`/`to`/`subject` conformes, **lien de réinitialisation avec un jeton de 43 caractères**, en-tête `Authorization` présent, **clé d'idempotence** transmise. Le lien capturé a ensuite été utilisé pour de vrai : `GET …?jeton=…` → `valide:true`, `POST` → mot de passe changé (ancien 401 / nouveau 200), rejeu refusé |
| **Courriel de réinitialisation (échec Resend 403)** | même montage, réponse simulée **403** « You can only send testing emails to your own email address » | Réponse HTTP au navigateur **inchangée** (anti-énumération), **aucun jeton renvoyé** ; le journal contient la raison exacte **et le message complet avec le lien**, qui a permis de rétablir le mot de passe du compte → le compte n'est plus perdu en cas d'échec d'envoi |
| **Origine du lien de réinitialisation** | requêtes avec `Host`/`x-forwarded-host` (hôte de prévisualisation, proxy) | Le lien utilise l'hôte public ; avec `NEXT_PUBLIC_URL_SITE`, il est figé sur le domaine configuré. Plus de lien `http://0.0.0.0:…` (défaut corrigé) |
| **`npx drizzle-kit push` (config Vercel `push && build`)** | exécuté en **non interactif** (comme en CI) sur la base de démonstration, puis sur une base **vierge**, puis relancé | Avant correction : **échec** (`Interactive prompts require a TTY terminal` — il voulait ajouter une 2ᵉ contrainte unique) → le build serait tombé. Après correction : `[✓] Changes applied` sans question, relance `[i] No changes detected` (**idempotent**), base vierge → **les 9 tables + 25 index** créés, et **parité exacte** (index et colonnes) avec la base produite par `scripts/setup-db.mjs` |
| **Optimisation de session** | comptage des requêtes SQL via `log_statement='all'` sur PostgreSQL (3 mesures par route, valeurs stables) | `GET /eleve` : **9 → 7** requêtes ; `GET /api/eleve/progression` : **8 → 7** ; `GET /enseignant` : 6 ; `GET /api/enseignant/stats/synthese` : 5. Purge des sessions expirées vérifiée |
| **Réordonnancement explicite = remède** | `PUT …/blocs/ordre` puis relecture | L'ordre demandé est bien appliqué (`invariant contigu` vérifié côté serveur) — c'est le chemin utilisé par l'éditeur et par la suite E2E |
| **Rendu élève avant/après migration des blocs** | même session élève, `GET /eleve/fables/[id]` | Avant : marqueur « Texte de la fable » **absent** (rendu historique, 54 901 o) ; après : **présent** (rendu par blocs, 54 366 o). Les deux réponses **200**, aucun 500 → la migration ne casse pas les fables non migrées |

---

## 4. Note sur les fontes (contrainte d'environnement)

`src/app/layout.tsx` utilise `next/font/google` : sans accès à `fonts.googleapis.com`,
`next build` échoue. La reproduction utilise donc les **fichiers `.woff2` réels** des
trois familles (Baloo 2, Nunito, Literata), servis localement, et la variable
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/home/user/tools/font-css-mock.cjs`
(`scripts/fonts-hors-ligne.mjs --serve`). Cette variable est **uniquement une aide de
build hors ligne** : elle n'existe pas dans le dépôt source et n'a aucun effet à
l'exécution. Avec un accès réseau normal, `next build` fonctionne sans elle.

---

## 5. Tests non exécutés (blocages et raisons exactes)

| Test | Raison exacte | Statut |
|---|---|---|
| Envoi réel d'un e-mail via **Resend** (vers une vraie boîte) | `api.resend.com` inaccessible depuis l'environnement d'analyse (réseau sortant limité à GitHub/npm/PyPI) **et** aucune clé réelle ne doit être demandée ni utilisée | ⚠️ non exécutable — **mais** la requête HTTP réellement émise par l'application a été interceptée et vérifiée (double de test) : composition, destinataire, expéditeur, en-tête d'authentification, clé d'idempotence, et exploitation du lien reçu. Les deux chemins (succès 200 / échec 403) sont couverts |
| **OpenAI TTS** (`gpt-4o-mini-tts`) et repli **Google Translate TTS** | Aucune clé + `translate.google.com` → `ECONNRESET` | ❌ non exécutable — le comportement d'erreur (**502**) et le repli navigateur ont été testés |
| Widgets tiers dans un **vrai navigateur** (iframe YouTube + `iframe_api`, H5P `postMessage`) | Aucun navigateur headless disponible ; ces appels partent du poste client, pas du serveur | ⚠️ non exécuté — vérifié au niveau du code et du HTML servi (attributs `sandbox`, hauteur, URL d'intégration, gestion des messages) |
| **Déploiement Vercel / Neon** et variables de production | Le mandat interdit de modifier ou sonder la production ; aucune valeur réelle n'est demandée ni utilisée | ⚠️ non exécuté — procédure documentée (`docs/environment-variables.md` §4) |
| Optimisation d'images **distantes** | Réseau sortant bloqué (l'appel se fait côté serveur) | ⚠️ non exécuté |
| Comportement **multi-instances** (verrous `FOR UPDATE`) | Une seule instance ici | ⚠️ non exécuté |
| Parcours **Moodle → Fablio** (migration historique) | Aucun accès à l'instance Moodle ni aux données d'origine | ⚠️ non exécuté — `scripts/setup-db.mjs --supprimer-moodle` présent mais non utilisé |

---

## 6. Hygiène des données de test

- La suite E2E crée à chaque exécution **un enseignant de test** (`prof.<suffixe>@fablio.test`),
  **un élève de test** (`max<suffixe>`), des tentatives et des sessions. Elle nettoie sa
  fable de test, mais **pas** ces comptes (aucune route API de suppression de compte).
- Nettoyage reproductible : `node scripts/reinitialiser-demo.mjs` (simulation) puis
  `node scripts/reinitialiser-demo.mjs --confirmer`. Le script refuse de s'exécuter si
  l'enseignant de démonstration est absent ou si la base contient des comptes hors
  périmètre (démonstration + `prof.*@fablio.test`).
- **État final vérifié** : `enseignants=1 · eleves=3 · tentatives=23 · sessions=0 ·
  fables=3 · exercices=9 · blocs=16` ; mot de passe de démonstration `demo1234` rétabli
  (ancien mot de passe de test → **401**, nouveau → **200**) ; PIN des élèves `1234`.
- Après nettoyage : `/api/health` 200, `/` 200, connexion enseignant 200, `/enseignant`
  200, `/enseignant/statistiques` 200, export CSV 24 lignes, connexion `lina` 200,
  `/eleve` 200, parcours par blocs 200, `/api/eleve/progression` → `pointsCumules 82.5`.
- Les jarres `ke.txt`/`kl.txt` du dépôt référencent des sessions **désormais
  inexistantes** (elles ont été supprimées) : ces fichiers ne sont plus exploitables.

---

## 7. Limites de la campagne

1. Les tests portent sur **une instance unique**, avec une latence quasi nulle — les
   problèmes de concurrence et de charge ne sont pas couverts. Les mesures de requêtes
   SQL (section 3) comptent les **allers-retours**, pas la latence réseau réelle.
2. Aucun test **visuel** (rendu CSS/responsive) automatisé : la validation responsive
   repose sur la lecture du code Tailwind et sur le HTML servi, pas sur une capture
   d'écran.
3. Les dépendances externes réelles (e-mail, TTS) sont hors d'atteinte de
   l'environnement : la campagne valide les **chemins de repli** du projet, pas les
   intégrations distantes.
4. Le linter signale **15 erreurs préexistantes** (React Compiler) dans les composants
   d'édition d'exercices et de rendu de parcours : elles n'empêchent ni le build ni
   l'exécution, mais elles dégradent la maintenabilité.
5. La suite E2E n'est pas idempotente sur deux familles de cas (quota de récupération et
   limite de tentatives) : elle gère le cas en créant un élève neuf à chaque exécution.
   **Ne pas la lancer deux fois en moins de 15 minutes sur le même compte de
   démonstration pour ces sections** (c'est déjà pris en compte dans la suite).
