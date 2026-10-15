# Manuel de déploiement — Fablio sur Vercel + Neon (PostgreSQL)

Ce guide décrit **pas à pas** la mise en production de Fablio sur **Vercel** avec une
base **PostgreSQL Neon** (serverless). Aucune modification de code n'est nécessaire :
l'application lit tout depuis la variable d'environnement `DATABASE_URL`.

> **⚠️ Avertissement sécurité — à faire AVANT toute chose**
> La chaîne de connexion de la base (utilisateur + mot de passe) a été communiquée en
> clair. **Quiconque la possède peut lire et modifier votre base.** Régénérez le mot
> de passe avant le déploiement :
> 1. Ouvrez <https://console.neon.tech> → votre projet → **Settings → Roles**
>    (ou **Branches → role `neondb_owner`**).
> 2. Cliquez sur **Reset password** et copiez le nouveau mot de passe.
> 3. Reconstituez la chaîne de connexion (voir §2.1) avec ce nouveau mot de passe.
> 4. N'inscrivez cette chaîne **nulle part dans le code** : uniquement dans les
>    réglages Vercel (§4) et votre `.env` local (déjà exclu par `.gitignore`).

---

## 1. Architecture de production

```
Navigateur (élèves / enseignant)
        │  HTTPS
        ▼
┌───────────────────────┐        TCP + SSL (pg.Pool, pool=5)
│   Vercel (serverless) │ ─────────────────────────────────▶ Neon « pooler »
│  Next.js : pages +    │     pooled connection (PgBouncer)   (PostgreSQL)
│  API routes           │
└───────────────────────┘
        ▲ Build : `next build` (pas besoin de la base — toutes les pages
        │ sont dynamiques ; la base n'est contactée qu'à l'exécution)
   GitHub (push = redéploiement automatique)
```

Points clés déjà en place dans le code :

- `src/db/index.ts` : active SSL automatiquement quand l'URL contient `sslmode=require`
  ou un hôte `neon.tech`, et limite le pool à `PG_POOL_MAX` (5 par défaut).
- `drizzle.config.ts` : lit `DATABASE_URL` pour les migrations de schéma.
- `.gitignore` : exclut `.env` et tous les fichiers d'environnement.
- `/api/health` : sonde de santé qui teste réellement la connexion SQL (`select 1`).

---

## 2. Préparer la base Neon

### 2.1 Récupérer la chaîne de connexion « pooled »

Dans **Neon Console → Dashboard → Connection Details**, choisissez
**« Pooled connection »** (important en serverless : les connexions passent par le
pooler PgBouncer de Neon). La forme est :

```
postgresql://neondb_owner:<MOT-DE-PASSE>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
```

- Gardez `?sslmode=require`.
- Si `&channel_binding=require` provoque une erreur de connexion avec certaines
  versions de `pg`, vous pouvez le retirer (voir Dépannage §8).

### 2.2 Appliquer le schéma — **méthode garantie (provisionnement complet)**

Depuis votre poste de développement, **à la racine du projet**, avec votre
chaîne Neon (entre guillemets) :

```bash
# macOS / Linux
DATABASE_URL="postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require" \
  node scripts/setup-db.mjs

# Windows PowerShell
$env:DATABASE_URL="postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require"
node scripts/setup-db.mjs
```

`scripts/setup-db.mjs` crée **toutes** les tables attendues par le code
(`enseignants`, `codes_parrainage`, `eleves`, `fables`, `exercices`,
`tentatives`, `sessions`, **`blocs_fable`**) plus les index, dans **une seule
commande idempotente** (relançable sans risque). Sécurité supplémentaire :
même sans cela, les pages de l'application **ne plantent plus** (fallback
historique automatique) — mais la création de blocs nécessite le schéma.

> Si une ancienne base contient les tables Moodle : exportez-les d'abord
> (cf. `MOODLE_REMOVAL.md`), puis
> `DATABASE_URL="…" node scripts/setup-db.mjs --supprimer-moodle`.

Alternative Drizzle (équivalente) : `DATABASE_URL="…" npx drizzle-kit push`.

> 🔴 **À FAIRE UNE FOIS avant le premier déploiement du correctif sur une base
> EXISTANTE** (celle qui tourne aujourd'hui en production) : le nom des contraintes
> `UNIQUE` a changé pour correspondre à Drizzle. Tant que la base n'est pas alignée,
> `npx drizzle-kit push` (que le build Vercel enchaîne) cherche à ajouter une seconde
> contrainte identique et **pose une question** → sans terminal, il **fait échouer le
> build**. La mise à niveau est idempotente et sans effet sur les données :
>
> ```bash
> DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" node scripts/setup-db.mjs
> ```
>
> (Cette commande renomme `enseignants_email_key` → `enseignants_email_unique`,
> `codes_parrainage_code_key` → `codes_parrainage_code_unique`, crée les index manquants
> de `sessions` et ne touche à aucune donnée.)
> Vérification après coup : `DATABASE_URL="…" npx drizzle-kit push` doit répondre
> `[i] No changes detected`. Si la base a été créée par `drizzle-kit push`, elle est
> déjà alignée : rien à faire.
>
> ✅ **Cohérence `setup-db.mjs` ↔ Drizzle** : les noms de contraintes ont été alignés
> (`enseignants_email_unique`, `codes_parrainage_code_unique`) et les index de `sessions`
> ajoutés au schéma. Vérifié en non interactif : `npx drizzle-kit push` ne propose plus
> **aucune** modification sur une base déjà créée par `setup-db.mjs`
> (`[i] No changes detected`), et sur une base vierge il crée les **9 tables** et les
> **25 index** — identiques, colonne par colonne et index par index.
>
> ⚠️ Si un build échoue avec `Interactive prompts require a TTY terminal`, c'est que
> `drizzle-kit push` détecte une différence de schéma (par exemple des **tables Moodle
> résiduelles** qu'il veut supprimer) et pose une question : lancez alors **une fois**
> `DATABASE_URL="…" npx drizzle-kit push` depuis un poste avec terminal, lisez ce qui est
> proposé, puis relancez le déploiement. Pour supprimer les tables Moodle volontairement :
> `DATABASE_URL="…" node scripts/setup-db.mjs --supprimer-moodle`.

### 2.2 bis Vérifier la récupération de mot de passe (enseignants)

```bash
curl -s https://VOTRE-SITE/api/health      # → {"ok":true,"courriel":"resend"|"journal"}
```

- `"journal"` : **aucun** courriel ne partira (le lien n'existe que dans les journaux) ;
- `"resend"` : envoi actif — vérifiez que `COURRIEL_EXPEDITEUR` utilise un **domaine
  vérifié** dans Resend (l'adresse de test `onboarding@resend.dev` n'accepte que
  l'adresse du titulaire du compte) ;
- définissez aussi `NEXT_PUBLIC_URL_SITE` pour que le lien du courriel pointe vers votre
  domaine. Détails : `docs/correctifs-appliques.md` §1 et `RECUPERATION.md`.

### 2.3 (Recommandé si l'app contenait déjà des fables) Migrer le parcours

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
  node scripts/migrer-blocs.mjs --execute
```

Convertit l'ancien contenu (texte → bloc TEXTE, image → bloc IMAGE,
exercices → blocs EXERCICE) — idempotent, `--verify` pour contrôler,
`--rollback` pour annuler.

### 2.4 (Optionnel) Données de démonstration

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" node scripts/seed.mjs
```

Crée : enseignant `demo.enseignant@fablio.tn` / `demo1234`, classes
`CE2A-DEMO1` / `CE2B-DEMO2`, élèves `lina`/`samy`/`nour` (PIN `1234`).

---

## 3. Mettre le code sur GitHub

```bash
git init
git add .
git status        # vérifier que .env n'apparaît PAS (il est dans .gitignore)
git commit -m "Fablio v1"
git branch -M main
git remote add origin https://github.com/<vous>/fablio.git
git push -u origin main
```

> Le fichier `.env` local **ne doit jamais être poussé**. Si c'était déjà fait :
> `git rm --cached .env && git commit -m "Retire .env"` puis regénérez vos secrets.

---

## 4. Créer et configurer le projet Vercel

1. Sur <https://vercel.com> → **Add New → Project** → **Import** votre dépôt GitHub.
2. Framework détecté automatiquement : **Next.js**. **Ne touchez à rien** :
   `vercel.json` à la racine fixe déjà `Install: npm ci` (lockfile versionné) et
   `Build: node scripts/vercel-build.mjs`. Ce script de build **ne pousse le
   schéma qu'en production** — voir l'encadré ci-dessous, à lire avant le premier
   déploiement.
3. **Avant de cliquer « Deploy »**, ouvrez la section **Environment Variables** et
   ajoutez, pour les 3 environnements (Production, Preview, Development) :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | `postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require` *(votre chaîne Neon §2.1)* |
   | `NEXT_PUBLIC_URL_SITE` *(fortement conseillé)* | `https://<votre-domaine>` — fige les liens de courriel sur le domaine public au lieu de suivre l'en-tête de la requête |
   | `RESEND_API_KEY` + `COURRIEL_EXPEDITEUR` *(pour les courriels réels)* | clé Resend **et** adresse sur un domaine vérifié (SPF/DKIM). Sans elles, le lien de récupération est **journalisé** et non envoyé — `GET /api/health` répond `courriel:"journal"` |
   | `PG_POOL_MAX` *(optionnel)* | `5` |
   | `OPENAI_API_KEY` *(optionnel)* | clé OpenAI pour une synthèse vocale de meilleure qualité. **Sans cette clé, la lecture à voix haute fonctionne quand même** (service gratuit + voix du navigateur). |

4. Cliquez sur **Deploy**. Le build dure ~1 min : il est **entièrement hors réseau**
   (les polices sont auto-hébergées dans `src/app/polices/` depuis l'audit du
   15/10/2026 — plus aucun téléchargement depuis Google Fonts, donc plus de build
   qui échoue parce qu'un hôte tiers est injoignable).

> 🔴 **Aperçus (preview) et base de données — à lire avant de tester une branche.**
> Une *commande de build* s'exécute aussi pour chaque déploiement d'aperçu, et
> **Vercel partage les variables d'environnement de production avec les aperçus par
> défaut**. Avant l'audit du 15/10, la commande conseillée était
> `npx drizzle-kit push && npm run build` : la moindre branche testée envoyait donc
> un **DDL sur la base de production** (avec, dans le pire des cas, une question de
> troncature de table). C'est corrigé par `scripts/vercel-build.mjs`, qui ne pousse
> le schéma que si `VERCEL_ENV=production` (`FABLIO_SCHEMA_PUSH=1|0` pour forcer).
> **Il reste un second risque, que seul le propriétaire peut fermer** : les *données*
> d'un aperçu (seed, comptes de démo, inscriptions d'élèves de test) s'écrivent
> dans la base pointée par `DATABASE_URL`. Pour des aperçus sans risque :
>
> ```bash
> # une branche Neon par PR (Neon → Branching, ou CLI)
> neon branches create --project-id <id> --parent-endpoint-id <ep> --name preview-<slug>
> # puis, dans Vercel : Environment Variables → Preview → DATABASE_URL = URL de la branche
> ```
>
> Ne lancez **jamais** `npm run db:seed` avec une `DATABASE_URL` de production :
> il réinitialise les comptes de démonstration, donc le mot de passe enseignant correspondant.

> 🟠 **Contrôle d'origine (CSRF)** : `src/middleware.ts` refuse (403) toute requête
> **mutante** sur `/api/**` dont l'en-tête `Origin` ne désigne pas l'hôte public. Les
> requêtes sans `Origin` (curl, applications natives, tests) sont acceptées. Si un
> client légitime doit appeler l'API depuis un autre domaine (app mobile, LMS),
> c'est ce contrôle qu'il faut adapter — **et non** le désactiver.

> 🟡 **Anti-force-brute** : après 5 échecs, la connexion répond `429` avec
> `Retry-After` (10 min pour un enseignant, 5 min par élève). En cas de test de
> charge sur la connexion, posez `FABLIO_CONNEXION_LIMITATION=off` sur l'environnement
> de prévisualisation. Le bornage a besoin de la table `tentatives_connexion`
> (créée par `npm run db:push` ou `node scripts/setup-db.mjs`) ; si elle manque, la
> connexion **continue de fonctionner** (dégradation ouverte) et `GET /api/health`
> l'indique dans `bornage` et `schemaManquant`.

> Les variables `DATABASE_URL` côté serveur ne sont **jamais exposées au navigateur**
> (seules les variables préfixées `NEXT_PUBLIC_` le sont — nous n'en utilisons aucune).

---

## 5. Vérifications post-déploiement

Remplacez `https://<votre-projet>.vercel.app` dans :

| Contrôle | Commande / action | Attendu |
|---|---|---|
| Sonde DB | `curl https://<…>.vercel.app/api/health` | `{"ok":true}` — prouve que Vercel↔Neon fonctionne |
| Accueil | ouvrir `/` | page d'accueil avec l'illustration |
| Connexion enseignant | `/connexion` avec `demo.enseignant@fablio.tn` / `demo1234` (si seed) | tableau de bord avec statistiques |
| Inscription élève | `/inscription?role=eleve`, code `CE2A-DEMO1` | accès à la bibliothèque de fables |
| Soumission | faire un QCM → « Valider ma réponse » | feedback immédiat + score |
| Export | `/enseignant/statistiques` → Export CSV | téléchargement d'un CSV |

Si `/api/health` renvoie `{"ok":false}`, voir Dépannage §8.

---

## 6. Cycle de vie : mises à jour

- **Code** : `git push` → Vercel redéploie automatiquement (production sur `main`,
  URL de *preview* unique pour chaque branche/PR).
- **Schéma de base de données** : modifiez `src/db/schema.ts`, puis **depuis votre
  poste** (avec l'URL Neon) : `DATABASE_URL="…" npx drizzle-kit push`, et commitez le
  code correspondant. L'ordre compte : poussez le schéma **avant** le code qui
  l'utilise.
- **Depuis l'audit du 15/10/2026**, la commande de build est
  `node scripts/vercel-build.mjs` (fixée dans `vercel.json`) : elle pousse le schéma
  **uniquement en `VERCEL_ENV=production`** et ne pose donc plus jamais de question
  depuis un aperçu. Si vous préférez gérer les schémas entièrement à la main, mettez
  `FABLIO_SCHEMA_PUSH=0` : le build se contente alors de compiler, et c'est à vous
  de lancer `npx drizzle-kit push` depuis votre poste **avant** de déployer le code
  qui utilise le nouveau schéma.
- Un push **avec** différence destructive (suppression de table/colonne) exige un
  terminal et fait échouer le build (§2.2) : relisez alors la différence depuis un
  poste, appliquez-la à la main, puis relancez le déploiement.
- **Logs** : Vercel → projet → **Logs / Functions** ; côté base : Neon → **Monitoring**.

---

## 7. Domaine personnalisé

Vercel → **Settings → Domains → Add** (ex. `fablio.mon-ecole.tn`) → suivez les
enregistrements DNS indiqués (`CNAME vers cname.vercel-dns.com`). HTTPS automatique.

---

## 8. Dépannage (erreurs fréquentes)

| Symptôme | Cause probable | Solution |
|---|---|---|
| `/api/health` → `{"ok":false}` / erreurs 500 au login | `DATABASE_URL` absente ou faute de frappe | Vercel → **Settings → Environment Variables**, corriger, **Redeploy** |
| `self signed certificate` / `SSL required` | SSL non activé | déjà géré dans `src/db/index.ts` ; vérifiez que l'URL contient bien `sslmode=require` |
| `SASL / channel binding requires SSL` ou erreur proche | paramètre `&channel_binding=require` mal supporté | retirez-le de la chaîne : gardez seulement `?sslmode=require` |
| `Too many connections` | pool direct sans pooler | utilisez l'URL **« Pooled connection »** (hôte contenant `-pooler`) |
| Première requête lente (3–5 s) | Neon *scale-to-zero* (offre gratuite endort la base) | normal ; désactiver l'autosuspend dans Neon **Settings → Compute**, ou planifier un ping quotidien sur `/api/health` |
| `relation "…" does not exist` ou pages 500 après déploiement | schéma non provisionné | `DATABASE_URL="…" node scripts/setup-db.mjs` puis, si fables existantes, `node scripts/migrer-blocs.mjs --execute` (§2.2–2.3). **Inofensif entre-temps : l'app bascule en affichage historique** |
| Build Vercel échoue sur `@/db` « DATABASE_URL is required » | variable manquante au build | l'app ne devrait pas en avoir besoin au build (pages dynamiques) ; si besoin, mettez la variable aussi pour l'environnement **Build** |
| Pages blanches après modif du schéma | code déployé avant le schéma | repoussez le schéma, puis **Redeploy** |
| L'image d'une fable ne s'affiche pas | fichier Drive non partagé | Drive → **Partager → Tous les utilisateurs disposant du lien**. Fablio convertit ensuite le lien automatiquement |
| Bouton « Écouter » muet | service TTS bloqué par le réseau de l'école | l'application bascule seule sur la voix du navigateur ; sinon renseignez `OPENAI_API_KEY` |
| Activité H5P vide | le site hôte interdit l'intégration (`X-Frame-Options`) | utilisez h5p.org / h5p.com / Lumi, ou autorisez `frame-ancestors *` sur votre hébergeur |
| Vidéo YouTube sans pause automatique | lien Drive ou Vimeo | seuls YouTube et les fichiers `.mp4` permettent la pause pilotée |

---

## 9. Rappels de bonnes pratiques

1. Secrets **uniquement** dans l'interface Vercel (ou `.env` local ignoré par Git).
2. Mot de passe Neon régénéré après tout partage (cf. avertissement d'ouverture).
3. URL **pooled** côté application, URL directe acceptable pour `drizzle-kit push`.
4. Sessions Fablio : cookie `httpOnly` + `secure` automatique en production.
5. Offre gratuite suffisante pour une classe (Vercel Hobby + Neon Free) ; le
   « réveil » à froid Neon est le seul temps d'attente perceptible.

Bon déploiement, et bon courage pour la soutenance de master !
