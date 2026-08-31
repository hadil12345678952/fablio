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
| 🧩 **Activités H5P** | Intégration par code `<iframe>` ou URL (h5p.org, h5p.com, Lumi, Moodle), redimensionnement automatique, entrée dans le suivi |
| 🖼️ **Images par lien** | Liens directs ou de partage **Google Drive / Dropbox**, convertis automatiquement en URL affichable |

- **Stack** : Next.js 16 (App Router) · React 19 · PostgreSQL + Drizzle ORM ·
  Tailwind CSS v4 · Recharts · bcrypt · sessions par cookie httpOnly.
- **Public** : enseignants du primaire et élèves de 7 à 10 ans.

## Démarrage local

```bash
npm install
cp .env.example .env        # renseigner DATABASE_URL (PostgreSQL local)
npx drizzle-kit push        # crée les 7 tables
node scripts/seed.mjs       # données de démonstration (optionnel)
npm run dev                 # http://localhost:3000
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
| `npx drizzle-kit push` | applique le schéma à la base de `DATABASE_URL` |
| `node scripts/seed.mjs` | charge la démonstration (idempotent) |
| `npx tsc --noEmit` | contrôle des types |

## Déploiement en production

Voir le manuel complet **[DEPLOIEMENT.md](./DEPLOIEMENT.md)** (Vercel + Neon,
schéma, seed, variables d'environnement, dépannage).

## Structure

```
src/db/schema.ts        modèle de données (7 tables, relations, index)
src/lib/exercices.ts    moteur d'exercices (payloads, notation, mélanges)
src/lib/auth.ts         sessions, hachage bcrypt, gardes de rôle
src/lib/queries.ts      requêtes métier partagées
src/lib/statistiques.ts agrégations + export CSV
src/app/api/…           22 endpoints REST
src/app/enseignant/…    tableau de bord, fables, codes, élèves, statistiques
src/app/eleve/…         bibliothèque, lecture, exercices, profil
src/components/…        joueur d'exercices (6 types), éditeurs, graphiques
```

Projet open source, conçu dans le cadre d'un master professionnel en
technologies éducatives.
