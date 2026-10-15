# Fablio — Correctifs et optimisations appliqués

> Ce document décrit **uniquement des modifications réellement écrites, compilées,
> exécutées et testées** dans ce dépôt. Chaque entrée indique : le symptôme observé,
> la cause identifiée dans le code, la modification, la **preuve d'exécution** et le
> risque/limite.
>
> Toutes les commandes de validation : `npx tsc --noEmit` (**0 erreur**),
> `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=… npx next build` (**succès**),
> `node tests/e2e-fablio.mjs` (**113/113**).

---

## 1. 🔴 « Aucun e-mail de récupération n'est reçu » — cause et correction

### 1.1 Ce qui a été constaté

Trois causes possibles ont été reproduites **sur le code d'origine** ; elles
s'additionnaient et aucune n'était visible par l'utilisateur :

| # | Cause | Effet pour l'enseignant |
|---|---|---|
| 1 | `RESEND_API_KEY` absente → repli « journalisation serveur » | Aucun courriel ; le lien existe uniquement dans les journaux Vercel |
| 2 | Expéditeur par défaut `onboarding@resend.dev` | Resend **refuse tout destinataire autre que le titulaire du compte** → erreur 403 « You can only send testing emails to your own email address » |
| 3 | Aucun mécanisme de secours à l'échec | Le lien généré était **définitivement perdu** (seul un `échec Resend 403` était journalisé) : compte irrécupérable |
| 4 | Lien construit à partir de l'URL de la requête | Constaté à l'exécution : lien `http://0.0.0.0:3000/…` → **inutilisable** |

### 1.2 Modifications

| Fichier | Modification |
|---|---|
| `src/lib/courriel.ts` | Réécrit : résultat d'envoi **structuré** (`envoye \| journalise \| echec` + raison lisible), **1 nouvelle tentative** sur incident (réseau, 429, 5xx) et **clé d'idempotence** (`Idempotency-Key`) pour ne jamais envoyer deux fois le même message, **journalisation du message complet en cas d'échec** (le lien reste récupérable par l'administrateur), **avertissements de configuration** (clé absente, adresse de test `resend.dev`, expéditeur sans « @ ») |
| `src/lib/api.ts` | Nouvelle fonction `originePublique(req)` : `NEXT_PUBLIC_URL_SITE` → `x-forwarded-host`/`x-forwarded-proto` → `host` → `req.url`, avec avertissement unique si rien n'est configuré |
| `src/app/api/auth/mot-de-passe/demande/route.ts` | Utilise `originePublique()` et **trace le résultat** : `[fablio:recuperation] … livraison=envoye\|journalise\|echec …` |
| `src/app/api/health/route.ts` | Expose `courriel: "resend" \| "journal"` (indicateur d'exploitation, **aucune donnée secrète**) : diagnostic immédiat de « pourquoi personne ne reçoit de mail » |
| `.env.example` | Avertissement explicite : `RESEND_API_KEY` **et** `COURRIEL_EXPEDITEUR` (domaine vérifié) sont indispensables pour un envoi réel |

> **Sécurité conservée** : la réponse HTTP reste **identique octet pour octet** que le
> compte existe ou non, et **aucun jeton n'est jamais renvoyé au navigateur**
> (revérifié).

### 1.3 Preuve d'exécution

Environnement d'analyse sans accès à `api.resend.com` → un **double de test**
(`tests/intercepteur-resend.cjs`, chargé par `NODE_OPTIONS`, aucun code du projet
modifié) intercepte l'appel et compare le message réellement émis.

**A. Cas nominal (Resend répond 200)**

```bash
NODE_OPTIONS="--require tests/intercepteur-resend.cjs" RESEND_API_KEY=… \
  COURRIEL_EXPEDITEUR='Fablio <no-reply@ecole-demo.tn>' \
  COURRIELS_CAPTURE=/tmp/courriels-captures.jsonl npx next start -p 3000
curl -X POST /api/auth/mot-de-passe/demande -d '{"email":"demo.enseignant@fablio.tn"}'
```

Résultat observé :

```
from    : Fablio <no-reply@ecole-demo.tn>
to      : ['demo.enseignant@fablio.tn']
subject : Fablio — réinitialisation de votre mot de passe
lien    : http://127.0.0.1:3000/mot-de-passe/reinitialiser?jeton=TIzMafy…   (43 caractères)
en-tête Authorization présent : True      clé d'idempotence : fbe23ed1…
[fablio:courriel] statut=envoye transport=resend id=simule-…
[fablio:recuperation] demande traitée — livraison=envoye … détail=Message accepté par Resend.
GET  /api/auth/mot-de-passe/reinitialiser?jeton=… → {"valide":true,…}
POST /api/auth/mot-de-passe/reinitialiser            → {"ok":true,…}
connexion avec l'ancien mot de passe → 401 · avec le nouveau → 200
rejeu du même jeton → « Ce lien a déjà été utilisé… »
```

**B. Cas dégradé reproduit (Resend 403 = « adresse de test »)**

```bash
RESEND_SIMULE_STATUT=403 RESEND_SIMULE_CORPS='{"statusCode":403,"message":"You can only send testing emails to your own email address."}' …
```

Résultat observé :

```
réponse HTTP au navigateur : {"ok":true,"message":"…vient d'être envoyé…"}   (inchangée, anti-énumération)
[fablio:courriel] tentative 1/2 échouée — Resend 403 {"statusCode":403,…}    (arrêt immédiat : inutile d'insister)
[fablio:courriel] ⚠ ÉCHEC D'ENVOI — message journalisé pour transmission manuelle
  Raison  : Resend 403 …
  Message (à transmettre manuellement si nécessaire) : … lien complet …
[fablio:recuperation] … livraison=echec … détail=Resend 403 …
```

Le lien extrait du journal a ensuite été utilisé **pour de vrai** : validation `valide:true`,
nouveau mot de passe accepté, session rétablie → **le compte n'est plus jamais
définitivement perdu**, même si Resend refuse l'envoi.

**C. Origine du lien** : avec en-têtes de proxy, le lien prend l'hôte public ; avec
`NEXT_PUBLIC_URL_SITE`, il est figé sur le domaine configuré. Vérifié : plus de lien
`http://0.0.0.0:…`.

### 1.4 Ce qui reste à faire côté exploitation (hors code)

Pour qu'un enseignant reçoive réellement son courriel sur Vercel :
1. créer/vérifier un **domaine** dans Resend (SPF + DKIM) ;
2. définir `RESEND_API_KEY` **et** `COURRIEL_EXPEDITEUR` sur un domaine vérifié ;
3. définir `NEXT_PUBLIC_URL_SITE` = URL publique du site ;
4. contrôler `GET /api/health` → `{"ok":true,"courriel":"resend"}`.

---

## 2. 🟠 Ordre des blocs inversé à chaque création — corrigé

### 2.1 Cause

`normaliserOrdres()` (`src/lib/blocs/service.ts`) décalait les rangs vers le négatif
(`ordre = -ordre - 1`) **puis** renumérotait avec `ROW_NUMBER() OVER (ORDER BY ordre,
cree_le)`. Les valeurs négatives étant **décroissantes**, le tri s'inversait : chaque
création/suppression retournait le parcours et le nouveau bloc arrivait en tête.

### 2.2 Correction

- Décalage **monotone** vers le haut (`ordre + 1 000 000`), qui ne modifie pas le tri ;
- départage déterministe `ORDER BY ordre, cree_le, id` ;
- l'insertion à une position donnée utilise **un seul `UPDATE … SET ordre = ordre + 1`**
  (PostgreSQL évalue les lignes avec leurs valeurs d'origine : plus de collision, plus
  d'inversion) au lieu de la double boucle négative ;
- suppression d'une fonction morte et trompeuse (`blocsVerrouilles()`, jamais appelée :
  elle renvoyait la transaction **après** sa fermeture, donc sans verrou).

### 2.3 Preuve d'exécution (API réelle, fable neuve)

```
POST texte  → ordre renvoyé 0   →  T@0                        (contigu: true)
POST image  → ordre renvoyé 1   →  T@0 I@1                    (contigu: true)
POST audio  → ordre renvoyé 2   →  T@0 I@1 A@2                (contigu: true)
POST video  → ordre renvoyé 3   →  T@0 I@1 A@2 V@3            (contigu: true)
POST position:1                 →  T@0 T@1 I@2 A@3 V@4        (contigu: true)
suppression du bloc @2          →  T@0 T@1 A@2 V@3            (contigu: true)
duplication du bloc @0          →  ordre renvoyé 1 (juste après la source)
```

Avant correction, la même sonde donnait `T@0` → `I@0 T@1` → `A@0 T@1 I@2` →
`V@0 I@1 T@2 A@3` (nouveau bloc en tête, anciens inversés).

Tests automatisés ajoutés/renforcés dans `tests/e2e-fablio.mjs` (section 9) :
ordre de création préservé, ordre renvoyé par le `POST` exact, insertion positionnée,
duplication **juste après** la source, déplacement vers le haut/bas et invariant de
contiguïté après chaque opération. **113/113 vérifications réussies.**

### 2.4 Données existantes

Aucune migration de données n'est nécessaire : l'invariant `0..n-1` était maintenu
(seul l'**ordre relatif** était faux). Les parcours déjà rédigés qui paraissent
inversés doivent simplement être **réordonnés une fois** dans l'éditeur (l'action
« déplacer » ou le glisser-déposer suffit) ; les parcours de démonstration migrés sont
déjà dans le bon ordre.

---

## 3. 🟠 `drizzle-kit push` en production (config Vercel) — fiabilisé

### 3.1 Symptôme reproduit

La configuration Vercel enchaîne `npx drizzle-kit push && npm run build`. Reproduit
localement sur la base issue de `scripts/setup-db.mjs` :

```
· You're about to add enseignants_email_unique unique constraint to the table …
  Do you want to truncate enseignants table?
Error: Interactive prompts require a TTY terminal (…)   ← build EN ÉCHEC en CI
```

**Cause** : PostgreSQL nomme `<table>_<colonne>_key` une contrainte `UNIQUE` déclarée en
ligne, alors que Drizzle attend `<table>_<colonne>_unique`. `drizzle-kit push` croyait
donc la contrainte absente et proposait d'en ajouter une **seconde** — avec une question
interactive qui, sans TTY, **arrêtait le build**.

### 3.2 Correction

- `scripts/setup-db.mjs` : les contraintes sont désormais nommées comme Drizzle les
  attend, et un bloc **idempotent** renomme celles des bases déjà créées (production
  incluse) ;
- `src/db/schema.ts` : index ajoutés sur `sessions` (voir §4), alignés sur le SQL.

### 3.3 Preuve d'exécution

| Vérification | Résultat |
|---|---|
| `npx drizzle-kit push` sur la base de démonstration | `[✓] Changes applied` (aucune modification, **exit 0**) |
| Relance | `[i] No changes detected` → **idempotent** |
| `npx drizzle-kit push` sur une base **vierge** | Crée **les 9 tables** + **25 index** |
| Comparaison base « setup-db.mjs » ↔ base « drizzle-kit push » | **Index identiques** et **colonnes identiques** (diff vide) |
| `npm ci` (cohérence du lockfile committé) | OK |

> ⚠️ **Si le build Vercel échoue un jour avec `Interactive prompts require a TTY
> terminal`**, cela signifie que `drizzle-kit push` détecte une différence de schéma
> (ex. des tables Moodle résiduelles à supprimer). Dans ce cas : lancer **une fois**
> `DATABASE_URL="…" npx drizzle-kit push` depuis un poste avec terminal, lire les
> instructions proposées, puis relancer le déploiement.

---

## 4. 🟡 Optimisations de fonctionnement (mesurées)

| Optimisation | Détail | Mesure avant → après |
|---|---|---|
| **1 requête SQL au lieu de 2 pour la session** | `lireSession()` joint désormais l'utilisateur à la session (`LEFT JOIN`) au lieu de deux allers-retours ; une session orpheline (utilisateur supprimé) est supprimée au passage | **`GET /eleve` : 9 → 7 requêtes SQL** ; `GET /api/eleve/progression` : 8 → 7 ; `GET /enseignant` : 6 ; `GET /api/enseignant/stats/synthese` : 5 |
| **Purge des sessions expirées** | `ouvrirSession()` supprime les sessions expirées (index sur `expire_le`), best-effort et non bloquant : la table `sessions` ne grossit plus indéfiniment (avant : **aucun** nettoyage, une ligne par connexion conservée 30 jours) | Suppression effective vérifiée |
| **3 index sur `sessions`** | `enseignant_id`, `eleve_id`, `expire_le` : la révocation des sessions lors d'une réinitialisation de mot de passe (`DELETE … WHERE enseignant_id = …`) ne fait plus de scan complet | Index présents (vérifié dans `pg_indexes`) |
| **Diagnostic de déploiement** | `GET /api/health` expose le transport de courriel actif | `{"ok":true,"courriel":"resend"}` / `"journal"` |

**Méthode de mesure** (reproductible) : `log_statement = 'all'` sur PostgreSQL local, puis
comptage des `execute <unnamed>` émis pendant une requête HTTP. Mesures répétées 3 fois,
valeurs identiques. Script : `/tmp/mesure.sh` (hors dépôt).

---

## 5. Hygiène du dépôt

| Élément | Action |
|---|---|
| `ke.txt`, `kl.txt` (jarres de cookies **committées**) | **Supprimés du dépôt** : ils contenaient des jetons de session valides. Le `.gitignore` refuse désormais `*cookies.txt`, `cookies*.txt`, `ke.txt`, `kl.txt` |
| `package-lock.json` | **Committé** : le dépôt n'en avait aucun, chaque `npm install` (et donc chaque build Vercel) pouvait résoudre des versions différentes. `npm ci` validé |
| Documentation | `docs/` (architecture, inventaire d'API, logique métier, variables d'environnement, état de reproduction, rapport de tests, correctifs) |

---

## 6. Ce qui n'a **pas** été modifié (et pourquoi)

| Sujet | Raison |
|---|---|
| **Vulnérabilités `npm audit`** (`next` 16.2.6 critique, `postcss`, `sharp`) | Correctif = montée de version majeure de Next (16.4.1) : cela change le framework exécuté par la production. **À décider et planifier par le propriétaire** (voir `docs/replication-status.md` §3.9) |
| **15 erreurs ESLint préexistantes** (`src/components/**`, règles React Compiler : pureté, `ref` pendant le rendu, réassignation après rendu) | Aucun impact sur le build ni sur l'exécution ; corriger ces règles **sans navigateur pour valider le rendu** serait plus risqué que le gain. À traiter dans une tâche dédiée, composant par composant |
| **Absence d'anti-force-brute sur la connexion / le PIN élève** | Décision produit (risque accepté ou non) : nécessite de choisir une stratégie (verrouillage temporaire, captcha, journalisation) |
| **Dossier `public/` absent** (illustrations 404) | Les fichiers n'existent pas dans le dépôt : impossible de les inventer. À fournir par le propriétaire |
| **Publication possible via `POST /fables {publie:true}`** | Changement de contrat d'API : à valider avec le propriétaire (l'UI n'utilise pas ce chemin) |
| **Restriction des hôtes d'images (`remotePatterns: **`)** | Risque de casser les illustrations existantes des enseignants : à décider |
