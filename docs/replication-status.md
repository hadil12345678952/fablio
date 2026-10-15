# Fablio — État de la reproduction

> Objectif de la mission : reproduire le projet **à l'identique dans son comportement**
> dans le Workspace, sans modifier le dépôt source ni la production, et sans jamais
> déclarer validé ce qui n'a pas été exécuté.
>
> Ce document liste **ce qui a été reproduit et vérifié**, **ce qui diffère**, **les
> défauts constatés dans la source** et **les points bloqués**.
>
> 📌 **Mise à jour du 15/10/2026** : le dépôt a été **modifié depuis** (à la demande du
> propriétaire) pour corriger la récupération de mot de passe, l'ordre des blocs, la
> fiabilité du `drizzle-kit push` de la configuration Vercel et quelques optimisations.
> Les §3.1, §3.5 et §3.9 ci-dessous sont donc **conservés comme constats d'audit** mais
> leur statut a changé : voir **`docs/correctifs-appliques.md`** (ce qui est corrigé,
> comment, et ce qui reste volontairement inchangé).

---

## 1. Ce qui a été reproduit

| Élément | Statut | Preuve / moyen |
|---|---|---|
| Code applicatif | **Identique à la source** | `git diff --stat HEAD` **vide** : aucun fichier du dépôt modifié ; le HEAD local est `b343227` (« FIX PASS RECOVERY ») sur la branche de travail |
| Framework et dépendances | **Identiques** (`next` 16.2.6, `react`/`react-dom` 19.2.6, `drizzle-orm` 0.45.2, `pg` 8.20.0, `bcryptjs` 3.0.3, `tailwindcss` 4.1.17, `typescript` 5.9.3) | `npm install` puis `node -e "require('…/package.json').version"` |
| Schéma de base (9 tables, index, clés étrangères, contraintes) | **Identique** | `node scripts/setup-db.mjs` (DDL du dépôt) exécuté sur un PostgreSQL **16.2** local |
| Données de démonstration | **Identiques** | `node scripts/seed.mjs` → 3 fables, 9 exercices, 3 élèves, 2 codes, 23 tentatives |
| Parcours par blocs (migration en cours dans la source) | **Appliqué** | `node scripts/migrer-blocs.mjs --execute` → 16 blocs (texte 3, image 3, vidéo 1, exercices 9) ; `--verify` OK ; `5/5/6` blocs par fable |
| Contrats d'API (31 routes internes) | **Identiques et vérifiés un par un** | `docs/api-inventory.md` + suite E2E (110/110) |
| Authentification (sessions en base, cookies, bcrypt, révocation) | **Identique** | Suite E2E sections 2, 3, 17 ; récupération de mot de passe section 14 |
| Rendu serveur des pages (31 routes API, 16 pages) | **Identique** | Build de production + requêtes HTTP réelles (voir `docs/test-report.md`) |
| UI responsive / composants React / Tailwind 4 | **Identiques** (aucune simplification) | Aucun fichier de composant modifié ; les mêmes composants sont servis par le même build |
| Export CSV (BOM, séparateur, colonnes) | **Identique** | Suite E2E section 12 + inspection des octets |
| Moteur de notation (8 types) | **Identique et éprouvé** | Suite E2E section 5 (11 vérifications) |
| Réponses d'erreur et messages français | **Identiques** | Assertions de la suite (messages/statuts exacts) |

### Ce que la reproduction ajoute (fichiers **non suivis** par Git, aucun impact sur le comportement)

| Fichier | Rôle |
|---|---|
| `tests/e2e-fablio.mjs` | Suite E2E maison : 18 sections, **110 vérifications**, sans dépendance (fetch + cookies), code de sortie 1 en cas d'échec |
| `scripts/reinitialiser-demo.mjs` | Remet la base de démonstration dans l'état du seed après une campagne de tests (simulation par défaut, `--confirmer` pour appliquer) |
| `scripts/pg-local.sh` | Gestion d'un cluster PostgreSQL local isolé (`init\|start\|stop\|status`) |
| `scripts/fonts-hors-ligne.mjs` | Prépare les fontes réelles + simule les réponses de `fonts.googleapis.com` (l'environnement d'analyse n'a **aucun accès réseau sortant** hormis GitHub/npm/PyPI ; sans cette simulation, `next build` échoue sur `next/font/google`) |
| `package-lock.json` | Généré par `npm install` : **le dépôt source n'a pas de lockfile** (voir §3) |
| `.env` | Configuration locale (`DATABASE_URL` locale uniquement), **exclu par `.gitignore`** |

---

## 2. Écarts de comportement entre la reproduction et une production

| Point | Reproduction | Production (Vercel/Neon) | Impact |
|---|---|---|---|
| Base de données | PostgreSQL 16.2 **locale** (cluster jetable) | Neon (PostgreSQL managé) | Aucun écart applicatif attendu : même DDL, mêmes requêtes ; SSL activé automatiquement pour les hôtes `neon.tech` |
| Pool de connexions | `PG_POOL_MAX` par défaut (5), sur un serveur unique | Pooler Neon, plusieurs instances serverless | En production, 5 connexions **par instance** ; à surveiller si le nombre d'instances augmente |
| Topologie | Un seul serveur `next start` | Fonctions serverless, plusieurs régions | Les opérations multi-requêtes utilisent `FOR UPDATE` dans des transactions — vérifié uniquement avec une seule instance |
| E-mails (Resend) | `RESEND_API_KEY` absente → le lien de réinitialisation est **journalisé** | Envoi réel | Parcours testé jusqu'au bout par le journal ; l'envoi réel n'est pas vérifiable ici |
| Synthèse vocale | OpenAI indisponible (pas de clé) puis Google Translate injoignable → **502** explicite + voix du navigateur | OpenAI ou Google | Le repli est celui prévu par le code ; le rendu audio réel n'est pas validable hors ligne |
| Images du site | `/images/hero-livre-magique.png` et `/images/fables/*.jpg` → **404** | Idem depuis ce dépôt : **le dossier `public/` n'existe pas dans la source** | Voir §3 — les illustrations référencées par le code et le seed sont absentes |
| Polices | Fichiers `woff2` réels servis localement via la simulation | Google Fonts au build | Aucun écart visuel : les **mêmes fichiers de fontes** sont utilisés |
| Widgets tiers (YouTube, H5P) | HTML/JS servis ; le navigateur de l'utilisateur peut charger les CDN | Identique | Les appels sortants du *navigateur* vers YouTube/H5P ne sont pas testables dans le bac à sable (aucun navigateur headless) |

---

## 3. Défauts et anomalies constatés lors de l'audit

> Le statut de chaque point est indiqué en tête de section : **✅ corrigé** (voir
> `docs/correctifs-appliques.md`), **à décider** (dépend d'un choix du propriétaire) ou
> **à traiter** (tâche dédiée).

### 3.1 ✅ CORRIGÉ — Ordre des blocs : chaque création plaçait le nouveau bloc en tête et inversait les autres

`normaliserOrdres()` (`src/lib/blocs/service.ts`, appelée seulement par la création et la
suppression de bloc) écrit d'abord `ordre = -ordre - 1` (valeurs négatives **décroissantes**)
puis renumérote avec `ROW_NUMBER() OVER (ORDER BY ordre, cree_le)` : le tri de la seconde
passe **inverse l'ordre relatif** au lieu de le préserver. Comme le nouveau bloc est inséré
**à la fin** avant la normalisation, il se retrouve **en position 0**.

Preuve d'exécution sur une fable neuve (état lu après chaque opération) :

```
POST texte   (ordre renvoyé 0)   après création texte    → T@0
POST image   (ordre renvoyé 0)   après création image    → I@0 T@1
POST audio   (ordre renvoyé 0)   après création audio    → A@0 T@1 I@2
POST video   (ordre renvoyé 0)   après création video    → V@0 I@1 T@2 A@3
suppression du bloc @2 (T)                              → A@0 I@1 V@2
```

Autres observations : une création avec `position: 1` finit à `ordre: 2` (le placement
demandé est écrasé) ; le `ordre: 0` renvoyé par le `POST` est **exact** (le bloc est bien
en tête) et non une valeur périmée.

- **Ce qui reste correct** : l'invariant de contiguïté `0..n-1` est maintenu, aucune donnée
  n'est corrompue, et `PUT …/blocs/ordre` / `POST …/deplacer` rétablissent explicitement
  l'ordre voulu (c'est ce que fait la suite E2E, et c'est ainsi que les données de
  démonstration migrées sont dans le bon ordre : le script de migration écrit directement
  en base, ordre explicitement calculé).
- **Impact en production** : visible pendant la **rédaction** du parcours (chaque ajout
  remonte en tête et réordonne le reste) ; le rendu élève reste correct une fois le
  parcours réordonné.
- **Correctif appliqué** (`docs/correctifs-appliques.md` §2) : décalage **monotone**
  (`ordre + 1 000 000`) au lieu du décalage négatif, départage `ORDER BY ordre, cree_le,
  id`, et insertion positionnée en un seul `UPDATE … SET ordre = ordre + 1`.
  Après correction, une fable neuve se construit `T@0` → `T@0 I@1` → `T@0 I@1 A@2` →
  `T@0 I@1 A@2 V@3`, l'insertion `position: 1` place bien le bloc en 1 et la duplication
  insère juste après sa source (vérifié par l'API, tests **113/113**).

### 3.2 Dossier `public/` absent → illustrations manquantes

- Le dépôt ne contient **aucun fichier image** (seul `src/app/icon.svg`) et aucune règle
  `.gitignore` ne masque `public/` : le dossier n'a jamais été committé.
- Conséquences vérifiées : `/images/hero-livre-magique.png` → **404** (accueil),
  `/images/fables/cigale-fourmi.jpg` (et les autres) → **404** (illustrations du seed).
  L'interface reste fonctionnelle (le composant d'image affiche un cadre vide).
- **Question ouverte** : ces fichiers existent-ils ailleurs (poste du propriétaire,
  bucket) ? Sinon, il faut les fournir ou retirer les références.

### 3.3 Aucun fichier de verrouillage de dépendances

- Pas de `package-lock.json`, pas de `pnpm-lock.yaml`/`yarn.lock` : `npm install` peut
  résoudre des versions différentes à chaque installation. Les versions réellement
  installées ici sont figées dans le `package-lock.json` **généré** (non committé).
- Recommandation : committer un lockfile et installer avec `npm ci` pour des
  déploiements reproductibles.

### 3.4 Jarres de cookies versionnées (`ke.txt`, `kl.txt`)

- Deux fichiers suivis par Git contiennent des **jetons de session locaux**
  (`fablio_session=…` pour `127.0.0.1`) issus de tests du propriétaire. Ce ne sont pas
  des clés d'API, mais un jeton de session valide n'a rien à faire dans un dépôt.
- Recommandation : `git rm ke.txt kl.txt` + règle `.gitignore` pour les jarres de cookies.
- Remarque : après nettoyage de la base de démonstration, ces jetons ne correspondent
  plus à aucune session (vérifié : les sessions ont été supprimées).

### 3.5 À décider — Publication possible à la création d'une fable

`POST /api/enseignant/fables` accepte `publie: true` **sans** appliquer
`validerFablePourPublication` (la validation stricte n'est branchée que sur la bascule
`PUT … {publie:true}`). **Non modifié** : changer ce comportement modifie le contrat de
l'API pour un usage non employé par l'interface — à trancher par le propriétaire.

### 3.6 Absence de limitation de débit sur l'authentification

Seule la récupération de mot de passe est limitée (**3 demandes / 15 min / compte**,
vérifié). Les tentatives de connexion enseignant et le PIN élève (4 à 12 caractères) ne
sont pas limitées — aucun mécanisme anti-force brute trouvé. À trancher avec le
propriétaire (risque accepté ou non).

### 3.7 Parcours « mot de passe oublié » élève inexistant

Aucun e-mail n'est demandé aux élèves : la réinitialisation passe obligatoirement par
l'enseignant (`PATCH /api/enseignant/stats/eleves/[id]`, vérifié). C'est cohérent avec le
modèle (classe + PIN) et documenté dans `RECUPERATION.md`, mais mérite d'être su
explicitement.

### 3.8 Détails d'API à connaître

- `GET /api/enseignant/exercices/[id]` n'existe pas → **405** (vérifié à l'exécution ; les
  exercices se lisent via `GET /api/enseignant/fables/[id]`).
- Les pages privées répondent **200** avec une coquille HTML **sans aucune donnée**
  (`<title>` seulement) puis un `<meta http-equiv="refresh" content="1;url=/connexion…">`
  émis par Next 16 (redirection par streaming, `digest NEXT_REDIRECT … 307`). Le
  cloisonnement est donc bien assuré côté serveur (`redirect()` dans les layouts), mais
  un testeur doit s'attendre à un **200 sans redirection HTTP**, pas à un 307.
- `next.config.ts` autorise **tout hôte** dans `remotePatterns` des images : l'optimiseur
  Next peut servir de proxy d'images ouvert. À restreindre si ce n'est pas voulu.

### 3.9 À traiter — Vulnérabilités de dépendances (priorité haute)

`npm audit --omit=dev` sur l'installation reproduite (versions **figées par le
`package.json` du dépôt**) :

```
3 vulnerabilities (2 high, 1 critical)
- next   (dépendance directe, 16.2.6) : sévérité CRITIQUE
- postcss (transitive)               : sévérité haute
- sharp   (transitive, 0.34.5)       : sévérité haute (libvips/libheif/librsvg)
Correctif proposé : next@16.4.1 (même majeure, hors de la plage déclarée « 16.2.6 » exacte)
```

Les avis listés pour `next` couvrent notamment un contournement de middleware/proxy en
App Router, une exécution de code à distance via l'API d'optimisation d'images, des
SSRF (rewrites et optimisation d'images), des dénis de service et des confusions de
cache. Comme le projet **est déployé** et utilise `next/image` sur des URL
fournisseurs/enseignants, ce point mérite une mise à jour rapide de Next (16.4.1 ou
version corrigée ultérieure) **puis un redéploiement** ; c'est le seul point de cette
reproduction qui appelle une action corrective immédiate côté exploitation.
**Non appliqué ici** : une montée de version de Next change le framework exécuté par la
production ; elle doit être **décidée et testée par le propriétaire** avant redéploiement
(voir `docs/correctifs-appliques.md` §6).

---

## 4. Points bloqués / non validables dans cet environnement

| Sujet | Raison exacte du blocage | Ce qui a été validé à la place |
|---|---|---|
| Envoi réel d'e-mails (Resend) | Aucune clé `RESEND_API_KEY` et **aucun accès réseau sortant** vers `api.resend.com` (l'environnement n'autorise que GitHub, npm et PyPI) | Le chemin de repli officiel : le lien est journalisé côté serveur ; le parcours complet (demande → jeton → changement → révocation des sessions) a été exécuté de bout en bout |
| Synthèse vocale OpenAI / Google | Même absence de clé et de réseau (`translate.google.com` → `ECONNRESET`) | `/api/tts` renvoie **502** avec un message explicite, le client bascule sur la voix du navigateur (code + test automatisé) |
| Widgets tiers en conditions réelles (YouTube iframe API, H5P) | Aucun navigateur headless disponible pour exécuter le JS client tiers | Les attributs d'iframe (`sandbox`), le protocole `postMessage`, la hauteur initiale et les URL d'intégration ont été vérifiés dans le code et le HTML servi |
| Déploiement Vercel / base Neon | Le mandat interdit de toucher à la production ; aucune valeur d'environnement de production ne doit être demandée ou utilisée | Le déploiement est décrit pas à pas (`DEPLOIEMENT.md` + `docs/environment-variables.md` §4) |
| Valeurs d'environnement de production (quelles clés existent réellement ?) | Non accessibles depuis le Workspace, et il ne faut pas les demander | Inventaire exhaustif des **noms** et des replis (`docs/environment-variables.md`) |
| Rendu des illustrations | Fichiers absents du dépôt (§3.2) | La dégradation (404 → cadre vide) a été constatée et ne casse aucune page |
| Optimiseur d'images sur des hôtes distants | Aucun accès réseau sortant | Le comportement local est vérifié : un SVG est refusé (`"image type is not allowed"`, 400 — comportement Next par défaut) |
| Comportement multi-instances (verrous `FOR UPDATE`) | Une seule instance ici | Les transactions et verrous ont été lus dans le code et vérifiés sur une instance unique |

---

## 5. État final de la base de démonstration (après nettoyage)

```
enseignants : 1      (demo.enseignant@fablio.tn / demo1234 — mot de passe rétabli)
élèves      : 3      (lina, samy, nour — code secret 1234)
codes       : 2      (CE2A-DEMO1, CE2B-DEMO2)
fables      : 3      (toutes publiées)
exercices   : 9
blocs_fable : 16     (5 / 5 / 6, dans le bon ordre)
tentatives  : 23     (exactement celles du seed)
sessions    : 0      (les jetons des fichiers ke.txt/kl.txt ne sont plus valides)
```

Vérifié après nettoyage : `/api/health` → `{"ok":true}`, connexion enseignant (200),
connexion élève (200), `/eleve` et parcours par blocs (200), export CSV (24 lignes =
en-tête + 23 tentatives), `node scripts/reinitialiser-demo.mjs --confirmer` **idempotent**.

---

## 6. Procédure complète de reproduction (telle qu'exécutée)

```bash
# 1. Dépendances (aucun lockfile en amont → npm install, puis npm ci possible avec le lock généré)
npm install

# 2. Base de données locale (cluster isolé, aucun accès à la production)
bash scripts/pg-local.sh init && bash scripts/pg-local.sh start

# 3. Schéma + données de démonstration + migration des blocs
node scripts/setup-db.mjs
node scripts/seed.mjs
node scripts/migrer-blocs.mjs --dry-run && node scripts/migrer-blocs.mjs --execute && node scripts/migrer-blocs.mjs --verify

# 4. Contrôles statiques et build de production
npx tsc --noEmit
npm run lint
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/home/user/tools/font-css-mock.cjs npx next build   # hors réseau ; inutile avec accès à fonts.googleapis.com

# 5. Démarrage et tests
npx next start -H 0.0.0.0 -p 3000 &
node tests/e2e-fablio.mjs                     # 110/110 attendus

# 6. Remise à zéro de la base de démonstration
node scripts/reinitialiser-demo.mjs --confirmer
```

**Déploiement** : voir `DEPLOIEMENT.md` (fourni par le projet) et
`docs/environment-variables.md` §4 — en résumé : provisionner Neon, définir
`DATABASE_URL` (+ `PG_POOL_MAX`, `NEXT_PUBLIC_URL_SITE`, éventuellement Resend et
OpenAI) dans Vercel, exécuter `scripts/setup-db.mjs` puis `scripts/migrer-blocs.mjs`
depuis un poste de confiance, et **régénérer le mot de passe du rôle Neon** puisque
`DEPLOIEMENT.md` signale qu'une chaîne de connexion a circulé en clair.

---

## 7. En résumé

- **Reproduit et exécuté** : application complète (31 routes API, 16 pages), schéma,
  données de démonstration, parcours par blocs, authentification, notation, statistiques,
  export CSV, récupération de mot de passe, synthèse vocale (chemins de repli).
- **Vérifié par exécution** : `tsc` 0 erreur, build de production OK, **suite E2E 110/110**,
  et une douzaine de sondes manuelles ciblées (`docs/test-report.md`).
- **Non vérifiable ici** : envois réels d'e-mails et de TTS, widgets tiers dans un vrai
  navigateur, déploiement Vercel/Neon, valeurs de production.
- **Corrigé depuis l'audit** (voir `docs/correctifs-appliques.md`) : envoi des courriels de
  récupération (cause + secours + diagnostic), lien de réinitialisation utilisable
  (plus de `http://0.0.0.0:…`), ordre des blocs à la création/suppression, fiabilité de
  `npx drizzle-kit push` dans la configuration Vercel, sessions (1 requête SQL au lieu de
  2, index, purge des expirées), lockfile committé, jarres de cookies retirées du dépôt.
- **Toujours ouverts / à décider** : montée de version de `next` (audit de sécurité),
  15 erreurs ESLint préexistantes des composants React, `public/` absent,
  publication possible via `POST /fables {publie:true}`, absence d'anti-force-brute sur
  la connexion et le PIN élève, restriction des hôtes d'images distantes.
