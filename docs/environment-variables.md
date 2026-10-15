# Fablio — Variables d'environnement et services externes

> Source de vérité : `git grep "process\.env\."` sur `src/`, `scripts/` et
> `drizzle.config.ts`, comparé à `.env.example` et à `DEPLOIEMENT.md`.
> **Recherche exhaustive : 10 variables distinctes**, aucune utilisation de
> `import.meta.env`, aucune autre variable `NEXT_PUBLIC_*`.
>
> 🔒 **Aucune valeur secrète n'est reproduite dans ce document** — seuls les noms,
> les usages et des indications de forme non sensibles.
> Les variables de production (Vercel) ne sont **pas** accessibles depuis le
> Workspace ; rien n'a été tenté pour les obtenir, et la production n'a pas été modifiée.

---

## 1. Inventaire complet

| # | Variable | Rôle | Fichiers consommateurs | Service | Obligatoire ? | Côté | Valeur trouvable en documentation ? |
|---|---|---|---|---|---|---|---|
| 1 | `DATABASE_URL` | Chaîne de connexion PostgreSQL (`postgresql://user:mdp@hote/base`, `?sslmode=require` en managé) | `src/db/index.ts` (lecture applicative), `drizzle.config.ts`, `scripts/setup-db.mjs`, `scripts/seed.mjs`, `scripts/migrer-blocs.mjs` | PostgreSQL (Neon en production) | **OUI** — sans elle, l'application **lève une erreur à l'import** : `Error: DATABASE_URL is required`, toutes les routes répondent **500** (vérifié) | **Serveur** | Non : propre à votre projet (Neon Console → Connection Details → *Pooled connection*) |
| 2 | `PG_POOL_MAX` | Nombre maximal de connexions du pool `pg` par instance/fonction | `src/db/index.ts` (`Number(process.env.PG_POOL_MAX ?? 5)`) | PostgreSQL | non (défaut **5**) | Serveur | Non : valeur d'exploitation |
| 3 | `PGSSL` | Force SSL si `PGSSL=1`, même si l'hôte ne le laisse pas deviner | `src/db/index.ts` | PostgreSQL | non | Serveur | Non |
| 4 | `NODE_ENV` | Active le cookie `Secure` en production (`secure: process.env.NODE_ENV === "production"`) | `src/lib/auth.ts` | Next.js | non (posée par Next) | Serveur | — |
| 5 | `NEXT_PUBLIC_URL_SITE` | Base d'URL utilisée pour **construire le lien de réinitialisation**. **Recommandée en production** : sans elle, le lien est déduit des en-têtes de la requête (`x-forwarded-host`, `host`) — fragile et forgeable ; un lien `http://0.0.0.0:…` a été observé sans elle | `src/app/api/auth/mot-de-passe/demande/route.ts` | — | non | **Serveur** (malgré le préfixe `NEXT_PUBLIC_`, la lecture est faite dans une route serveur) | Non : votre domaine (`https://votre-projet.vercel.app`) |
| 6 | `RESEND_API_KEY` | Clé d'envoi d'e-mails transactionnels (réinitialisation de mot de passe) | `src/lib/courriel.ts` | **Resend** | non — sans clé, le message est **journalisé côté serveur** (secours, **pas** une solution pour l'enseignant) | Serveur | Non : à créer dans le tableau de bord Resend (format `re_…`) |
| 7 | `COURRIEL_EXPEDITEUR` | Expéditeur affiché (ex. `Fablio <no-reply@ecole.tn>`) | `src/lib/courriel.ts` (défaut `Fablio <onboarding@resend.dev>`) | Resend | **oui, en pratique** : l'adresse par défaut est une adresse de **test** — Resend refuse alors tout destinataire autre que le titulaire du compte (403 « You can only send testing emails to your own email address »). Un domaine vérifié est indispensable pour envoyer aux enseignants | Serveur | Non : dépend du domaine vérifié chez Resend |
| 8 | `OPENAI_API_KEY` | Synthèse vocale de meilleure qualité | `src/app/api/tts/route.ts` | **OpenAI** | non — sans clé, Google Translate TTS puis voix du navigateur | Serveur | Non (clé `sk-…` à créer côté OpenAI) |
| 9 | `OPENAI_TTS_MODEL` | Modèle TTS | idem (défaut `gpt-4o-mini-tts`) | OpenAI | non | Serveur | Oui : documentation OpenAI |
| 10 | `OPENAI_TTS_VOICE` | Voix (`alloy`, `nova`, `shimmer`… — défaut `shimmer`) | idem | OpenAI | non | Serveur | Oui : documentation OpenAI |
| 11 | `FABLIO_CONNEXION_LIMITATION` | **Désactive** le bornage anti-force-brute si `off` / `aucun` / `desactive` (défaut : bornage actif) | `src/lib/securite.ts` | — (compteur en base) | non | Serveur | Non : réservé aux tests de charge et au dépannage |
| 12 | `FABLIO_CONNEXION_STRICT` | Si `1` : quand la table `tentatives_connexion` est absente ou la base injoignable, la connexion est **refusée** (429) au lieu de passer en dégradation ouverte | `src/lib/securite.ts` | PostgreSQL | non — **défaut : fail-open**, choix assumé pour ne jamais enfermer une classe derrière une migration manquante | Serveur | Non |
| 13 | `FABLIO_SCHEMA_PUSH` | Force (`1`) ou interdit (`0`) le `drizzle-kit push` exécuté par la commande de build Vercel. Défaut : poussé **uniquement en `VERCEL_ENV=production`**, jamais depuis un aperçu | `scripts/vercel-build.mjs` | Vercel / PostgreSQL | non | Serveur (build) | Non |

### Remarques importantes

- **Une seule variable est obligatoire** : `DATABASE_URL`. Toutes les autres ont un
  repli fonctionnel documenté (dégradation propre, jamais de simulation silencieuse :
  l'absence de clé OpenAI entraîne un appel au service public **réel**, et l'absence
  totale de réseau un **502 explicite** — vérifié).
- `.env.example` du dépôt **correspond exactement** à cet inventaire (il documente en
  plus `PG_POOL_MAX` et `PGSSL` en commentaire) : il n'y a **aucune variable
  utilisée mais non documentée**, ni l'inverse.
- `DATABASE_URL` est lue **à l'import du module** : une valeur absente ou malformée
  produit l'erreur au démarrage de la première requête, pas au build
  (le build **n'a pas besoin** de la base — confirmé : `next build` réussit sans
  connexion à PostgreSQL).
- Le SSL est **activé automatiquement** si l'URL contient `sslmode=require|verify`
  ou un hôte `neon.tech`, `supabase.`, `render.com`, `aivencloud.com`, ou si
  `PGSSL=1`. Aucune autre variable TLS n'existe.

---

## 2. Configuration utilisée dans la reproduction (Workspace)

Fichier **`.env`** (local, **exclu par `.gitignore`** — vérifié : il n'est pas suivi) :

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db"
```

- Ce fichier ne contient **aucun secret réel** : il pointe vers le PostgreSQL local
  de la reproduction (mot de passe local `postgres`, base jetable).
- La production Vercel/Neon n'a **jamais été contactée** ; ses variables restent
  uniquement dans Vercel.
- Les autres variables (Resend, OpenAI) sont **volontairement absentes** dans la
  reproduction afin de tester les chemins de repli.

---

## 3. Variables requises manquantes dans le Workspace

| Variable | Conséquence dans la reproduction | Statut |
|---|---|---|
| `DATABASE_URL` | **Fournie** (instance PostgreSQL locale, schéma + données de démo installés) | ✅ configurée |
| `RESEND_API_KEY` / `COURRIEL_EXPEDITEUR` | Aucun e-mail n'est envoyé ; le lien de réinitialisation est écrit dans les **journaux du serveur** (comportement officiel du projet). Le parcours complet a été testé par ce chemin | ⚠️ non configurée (facultatif) |
| `OPENAI_API_KEY` | `/api/tts` tente Google Translate TTS ; le réseau sortant du bac à sable étant restreint, la route répond **502** et le client bascule sur la voix du navigateur | ⚠️ non configurée (facultatif) |
| `NEXT_PUBLIC_URL_SITE` | Le lien de réinitialisation utilise l'origine de la requête (`http://127.0.0.1:3000`) | ⚠️ non configurée (facultatif) |
| `PG_POOL_MAX`, `PGSSL` | Valeurs par défaut (5 / SSL selon l'URL) | ✅ par défaut |
| `DATABASE_URL` de **production** (Neon) | **Non demandée et non utilisée** : la reproduction travaille sur une base locale isolée | 🔒 hors périmètre |

**Aucune valeur secrète n'est requise pour que la reproduction fonctionne** : elle
tourne intégralement avec la seule variable `DATABASE_URL` locale.

---

## 4. Configurer un déploiement (sans exposer de secret)

1. **Neon** : créer un projet, copier la chaîne *Pooled connection* (format
   `postgresql://…@…-pooler.<region>.aws.neon.tech/<base>?sslmode=require`) —
   voir `DEPLOIEMENT.md` §2.1. Le manuel du dépôt signale explicitement qu'une chaîne
   de connexion de production a circulé en clair : **régénérez le mot de passe du rôle**
   avant tout déploiement (Neon Console → Settings → Roles → *Reset password*).
2. **Vercel** : `Settings → Environment Variables` (Production **et** Preview) :
   - `DATABASE_URL` = chaîne Neon (§ ci-dessus) — **obligatoire** ;
   - `PG_POOL_MAX` = `5` (optionnel, adapté au pooler) ;
   - `NEXT_PUBLIC_URL_SITE` = URL publique du site (recommandé, pour des liens de
     réinitialisation stables) ;
   - `RESEND_API_KEY` + `COURRIEL_EXPEDITEUR` (optionnel) ;
   - `OPENAI_API_KEY` ± `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` (optionnel).
3. **Provisionner le schéma** (une fois, depuis un poste de confiance, sans committer
   la chaîne) :
   ```bash
   DATABASE_URL="…" node scripts/setup-db.mjs          # 9 tables + index (idempotent)
   DATABASE_URL="…" node scripts/migrer-blocs.mjs --dry-run   # puis --execute si besoin
   DATABASE_URL="…" node scripts/seed.mjs              # optionnel (démonstration)
   ```
4. **Vérifier l'état des transports** : `GET /api/health` → `{"ok":true,"courriel":"resend"}`
   (`"journal"` signifie qu'aucun courriel ne sera envoyé, quel que soit l'utilisateur).
5. **Règles d'hygiène appliquées** : aucun secret écrit dans un fichier suivi ;
   `.env` ignoré par Git (vérifié) ; les valeurs ne sont jamais journalisées par
   l'application (les messages de courriel journalisés contiennent un **jeton** — à
   traiter comme une information sensible : voir §5).

---

## 5. Points de vigilance « secrets » relevés lors de l'audit

| Élément | Constat | Recommandation |
|---|---|---|
| `ke.txt`, `kl.txt` (suivis par Git à la racine) | **Jarres de cookies curl** (`#HttpOnly_127.0.0.1 … fablio_session=<hex>`), générées lors de tests locaux. **Ce ne sont pas des clés d'API ni des secrets de production** : le jeton est une session locale de développement, expirant le 2026-10-22. | Supprimer ces deux fichiers du dépôt (`git rm ke.txt kl.txt`) et ajouter `*.txt`-de-cookies au `.gitignore` — une session valide ne doit pas être versionnée. |
| `DEPLOIEMENT.md` | Contient des **exemples** avec `<MOT-DE-PASSE>` ; aucune valeur réelle. Il rappelle que la chaîne de production a circulé en clair et doit être régénérée. | Appliquer l'avertissement du manuel (rotation du mot de passe Neon). |
| Journalisation du lien de réinitialisation | Sans `RESEND_API_KEY` — **et désormais aussi en cas d'échec d'envoi** — le lien complet (donc le jeton **en clair**) est écrit dans les journaux serveur : c'est le filet de sécurité qui évite de perdre un compte. | Sur Vercel, configurer Resend **et** un domaine vérifié ; à défaut, considérer les journaux comme sensibles (accès restreint, rétention limitée). Diagnostic : `GET /api/health` → `courriel` vaut `resend` ou `journal`. |
| `.env.example` | Ne contient que des formes d'exemple (`sk-…`, `re_…`, `postgres:postgres`) ; aucune valeur exploitable. | — |
