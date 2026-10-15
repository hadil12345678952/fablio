# Fablio — dossier de mission (reproduction et analyse)

Ce dossier rassemble les **six livrables** de la mission d'analyse et de reproduction
du projet **Fablio** (plateforme éducative Next.js + PostgreSQL). Le dépôt source et la
production n'ont **pas été modifiés** : le code est identique à l'amont
(`git diff --stat HEAD` vide) et seuls des fichiers **non suivis** ont été ajoutés
(suite de tests, outillage de reproduction).

## Les livrables

| Document | Contenu |
|---|---|
| [`architecture.md`](architecture.md) | Cartographie et architecture technique : pile vérifiée, arborescence, **diagrammes Mermaid** (flux général, séquence de soumission d'exercice, modèle de données, dépendances entre modules), frontend, backend, données, séparation « confirmé par le code » / « vérifié à l'exécution » / « à confirmer » |
| [`api-inventory.md`](api-inventory.md) | **Inventaire exhaustif des API** : 31 routes internes (méthode, entrée, codes, effets de bord), API externes consommées (Resend, OpenAI, Google Translate TTS), appels tiers déclenchés par le navigateur (YouTube, H5P, images, polices), webhooks (aucun) et **appels indirects/dynamiques** |
| [`business-logic.md`](business-logic.md) | **Règles métier reconstruites** : 8 types d'exercices et leur notation, contrôles de soumission, ciblage par classe, publication, moteur de blocs, statistiques, récupération de mot de passe, badges, normalisation des médias, **cas limites et pièges** |
| [`environment-variables.md`](environment-variables.md) | **10 variables d'environnement** (rôle, fichiers consommateurs, service, caractère obligatoire, côté serveur/client, où se procurer la valeur), `.env.example`, configuration de la reproduction, procédure de déploiement et points de vigilance « secrets » |
| [`replication-status.md`](replication-status.md) | **État de la reproduction** : ce qui est reproduit et vérifié, écarts avec une production, **défauts du dépôt source rapportés sans correction**, points bloqués, état final de la base, procédure complète et résumé |
| [`test-report.md`](test-report.md) | **Rapport de tests** : commandes réellement exécutées et résultats (install, `tsc`, `lint`, build, démarrage, suite E2E **113/113**), sondes manuelles ciblées, tests non exécutables avec leur raison exacte, hygiène des données de test |
| [`AUDIT-2026-10.md`](AUDIT-2026-10.md) | **Audit complet du 15/10/2026 et suite de développement** : état des lieux chiffré, architecture confirmée, 11 constats de sécurité cotés et statuts, 14 recommandations priorisées (impact/effort/décideur), préparation du déploiement de prévisualisation Vercel (variables, recettes `curl`), limites de vérification |
| [`correctifs-appliques.md`](correctifs-appliques.md) | **Correctifs et optimisations appliqués** : récupération de mot de passe (envoi réel, secours, diagnostic), ordre des blocs, fiabilité de `drizzle-kit push` (config Vercel), optimisations de sessions mesurées, hygiène du dépôt — et ce qui reste **volontairement** inchangé |

## Démarrage rapide (reproduction)

```bash
npm ci                                                 # lockfile versionné
bash scripts/pg-local.sh init && bash scripts/pg-local.sh start
node scripts/setup-db.mjs && node scripts/seed.mjs     # schéma + données de démonstration
node scripts/migrer-blocs.mjs --execute                # migration des parcours (blocs)
npx tsc --noEmit && npm run lint && npx next build      # contrôles statiques + build
npx next start -H 0.0.0.0 -p 3000                      # serveur de production
node tests/e2e-fablio.mjs                              # 138/138 vérifications
```

> Depuis l'incrément du 15/10 (polices auto-hébergées), `next build` **n'a plus
> besoin d'accéder à `fonts.googleapis.com`** : plus aucune variable de simulation
> n'est nécessaire pour builder hors connexion. `scripts/fonts-hors-ligne.mjs`
> ne sert plus qu'à régénérer les fichiers (`--verser`) depuis Fontsource.

Comptes de **démonstration** (publics dans le dépôt) : enseignante
`demo.enseignant@fablio.tn` / `demo1234` ; élèves `lina`, `samy` (code `CE2A-DEMO1`),
`nour` (code `CE2B-DEMO2`), code secret `1234`.

## Trois points à retenir

1. **Vulnérabilités de dépendances : corrigées.** `next` 16.2.6 (critique : RCE via
   l'optimisation d'images, SSRF, contournements) est monté en **16.4.1** sur la
   branche `arena/ea034f85-fablio` ; `npm audit --omit=dev` est à **zéro**. Le
   détail des autres constats (bornage de connexion, CSRF, en-têtes, DDL envoyé à la
   production depuis un aperçu) et les 14 recommandations restantes sont dans
   [`AUDIT-2026-10.md`](AUDIT-2026-10.md).
2. **Récupération de mot de passe** : le code d'envoi a été corrigé et durci ; pour que
   les enseignants reçoivent **réellement** le courriel, il faut une clé Resend **et un
   expéditeur sur un domaine vérifié** (l'adresse par défaut `onboarding@resend.dev`
   n'envoie qu'au titulaire du compte) → `correctifs-appliques.md` §1.
3. **`public/` était absent du dépôt** (illustrations en 404) : quatre visuels de
   démonstration sont désormais versionnés et **testés** (section 21 de la suite E2E) ;
   à remplacer par les illustrations définitives de l'école sous les mêmes chemins.
