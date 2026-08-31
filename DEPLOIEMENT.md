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

### 2.2 Appliquer le schéma (création des 7 tables)

Depuis votre poste de développement, **à la racine du projet**, avec votre
chaîne Neon (entre guillemets) :

```bash
# macOS / Linux
DATABASE_URL="postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require" \
  npx drizzle-kit push

# Windows PowerShell
$env:DATABASE_URL="postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

Réponse attendue : `[✓] Changes applied` (7 tables : `enseignants`,
`codes_parrainage`, `eleves`, `fables`, `exercices`, `tentatives`, `sessions`).

> Vérification optionnelle :
> `DATABASE_URL="…" node -e "const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('select count(*) from enseignants')).then(r=>{console.log(r.rows);return c.end()})"`

### 2.3 (Optionnel) Charger les données de démonstration

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" node scripts/seed.mjs
```

Crée : enseignant `demo.enseignant@fablio.tn` / `demo1234`, codes `CE2A-DEMO1` /
`CE2B-DEMO2`, élèves `lina`, `samy`, `nour` (code secret `1234`), 3 fables
publiées et leurs exercices. Idempotent : peut être relancé sans doublons.

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
2. Framework détecté automatiquement : **Next.js**. Laissez les réglages par défaut
   (`Build Command: next build`, `Install: npm install`, `Output: automatique`).
3. **Avant de cliquer « Deploy »**, ouvrez la section **Environment Variables** et
   ajoutez, pour les 3 environnements (Production, Preview, Development) :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | `postgresql://neondb_owner:<MDP>@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require` *(votre chaîne Neon §2.1)* |
   | `PG_POOL_MAX` *(optionnel)* | `5` |
   | `OPENAI_API_KEY` *(optionnel)* | clé OpenAI pour une synthèse vocale de meilleure qualité. **Sans cette clé, la lecture à voix haute fonctionne quand même** (service gratuit + voix du navigateur). |

4. Cliquez sur **Deploy**. Le build dure ~1–2 min (les polices Google sont
   téléchargées au build, c'est normal).

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
| `relation "fables" does not exist` | schéma non poussé | `DATABASE_URL="…" npx drizzle-kit push` (§2.2) |
| Build Vercel échoue sur `@/db` « DATABASE_URL is required » | variable manquante au build | l'app ne devrait pas en avoir besoin au build (pages dynamiques) ; si besoin, mettez la variable aussi pour l'environnement **Build** |
| Pages blanches après modif du schéma | code déployé avant le schéma | repoussez le schéma, puis **Redeploy** |
| L'image d'une fable ne s'affiche pas | fichier Drive non partagé | Drive → **Partager → Tous les utilisateurs disposant du lien**. Fablio convertit ensuite le lien automatiquement |
| Bouton « Écouter » muet | service TTS bloqué par le réseau de l'école | l'application bascule seule sur la voix du navigateur ; sinon renseignez `OPENAI_API_KEY` |
| Activité H5P vide | le site hôte interdit l'intégration (`X-Frame-Options`) | utilisez h5p.org / h5p.com / Lumi, ou autorisez `frame-ancestors *` sur votre Moodle/WordPress |
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
