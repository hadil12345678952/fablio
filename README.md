# Fablio — Les fables prennent vie en classe

Plateforme web éducative (français) pour l'apprentissage des fables à l'école
primaire : l'enseignant crée fables et exercices (**8 types**), les élèves
rejoignent la classe avec un **code de parrainage** (sans email), et l'enseignant
suit les performances grâce à des **statistiques détaillées** (graphiques,
erreurs fréquentes, export CSV/PDF).

### Fonctionnalités multimédia

| Fonction | Détail |
|---|---|
| 🔊 **Lecture à voix haute** | Bouton « Écouter la fable » : API serveur `/api/tts` (OpenAI si `OPENAI_API_KEY`, sinon service gratuit sans clé, repli sur la voix du navigateur) |
| 🎬 **Vidéo interactive** | YouTube / Vimeo / Drive / MP4 ; l'enseignant place des questions à des instants précis, la vidéo se met en pause |
| 🧩 **Activités H5P** | Intégration par code `<iframe>` ou URL (h5p.org, h5p.com, Lumi), redimensionnement automatique, entrée dans le suivi |
| 🖼️ **Images par lien** | Liens directs ou de partage **Google Drive / Dropbox**, convertis automatiquement en URL affichable |

- **Stack** : Next.js 16 (App Router) · React 19 · PostgreSQL + Drizzle ORM ·
  Tailwind CSS v4 · Recharts · bcrypt · sessions par cookie httpOnly ·
  **polices auto-hébergées** (le build ne dépend d'aucun service externe).
- **Sécurité** : bornage anti-force-brute des deux connexions (compteur en base,
  fenêtre glissante, 429 + `Retry-After`), contrôle d'origine (CSRF) sur toutes les
  méthodes mutantes de `/api`, en-têtes de sécurité HTTP, jetons de réinitialisation
  hachés et à usage unique, `npm audit --omit=dev` **à zéro**.
- **Public** : enseignants du primaire et élèves de 7 à 10 ans.

## Démarrage local

```bash
npm ci                       # lockfile versionné : installation reproductible
cp .env.example .env           # renseigner DATABASE_URL (PostgreSQL local)
npm run db:setup               # ou : npx drizzle-kit push — crée les 10 tables
npm run db:seed                # données de démonstration (optionnel)
npm run db:blocs               # parcours par blocs à partir des fables existantes
npm run dev                    # http://localhost:3000
```

Comptes de démonstration (après seed) :

| Rôle | Identifiants |
|---|---|
| Enseignant | `demo.enseignant@fablio.tn` / `demo1234` |
| Codes de classe | `CE2A-DEMO1`, `CE2B-DEMO2` |
| Élèves | `lina`, `samy`, `nour` — code secret `1234` |

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run db:setup` | applique le DDL idempotent (bases existantes incluses) |
| `npm run db:push` | applique le schéma Drizzle à la base de `DATABASE_URL` |
| `npm run db:seed` | charge la démonstration (idempotent) |
| `npm run db:blocs` | migre les fables vers le parcours par blocs |
| `npm run demo:reset` | remet la base de démo dans l'état du seed |
| `npm run typecheck` / `npm run lint` | types (0 erreur) et ESLint (0 erreur) |
| `npm run test:e2e` | **suite fonctionnelle de bout en bout** (138 vérifications, serveur réel) |
| `npm run audit:deps` | audit de sécurité des dépendances de production |

## Déploiement en production

Voir le manuel complet **[DEPLOIEMENT.md](./DEPLOIEMENT.md)** (Vercel + Neon,
schéma, seed, variables d'environnement, dépannage).

## Structure

```
src/middleware.ts       contrôle d'origine (CSRF) sur /api — edge, sans accès à la base
src/db/schema.ts        modèle de données (10 tables, relations, index)
src/lib/exercices.ts    moteur d'exercices (payloads, notation, mélanges)
src/lib/auth.ts         sessions, hachage bcrypt, gardes de rôle
src/lib/securite.ts     bornage anti-force-brute (fenêtre glissante, en base)
src/lib/queries.ts      requêtes métier partagées
src/lib/statistiques.ts agrégations + export CSV
src/app/api/…           22 endpoints REST
src/app/enseignant/…    tableau de bord, fables, codes, élèves, statistiques
src/app/eleve/…         bibliothèque, lecture, exercices, profil
src/components/…        joueur d'exercices (6 types), éditeurs, graphiques
```

Déploiement : la commande de build est `node scripts/vercel-build.mjs` (voir
`vercel.json`) — le push de schéma **ne s'exécute qu'en production**, jamais depuis
un aperçu, pour qu'une branche testée n'écrive jamais dans la base réelle.

Projet open source, conçu dans le cadre d'un master professionnel en
technologies éducatives. (⚠ aucun fichier `LICENSE` n'est encore présent : voir
`docs/AUDIT-2026-10.md` §2.1.)
